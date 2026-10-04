"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { get, set, del, keys, update as updateCache } from "idb-keyval";
import { validateWorkspace, type Workspace, type Snapshot } from "@/lib/model";
type Cached = Snapshot & { dirty: boolean; updatedAt?: string };
export type RecoverableDraft = Cached & { key: string };
const DRAFT_PREFIX = "jotstead.draft.v1.";
const SESSION_DRAFT = "jotstead.active-draft.v1";
export type SaveStatus =
  "loading" | "saved" | "saving" | "offline" | "error" | "conflict";
const CACHE = "jotstead.workspace.v1";
export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [error, setError] = useState("");
  const [authRequired, setAuth] = useState(false);
  const [serverVersion, setServerVersion] = useState<Snapshot | null>(null);
  const [drafts, setDrafts] = useState<RecoverableDraft[]>([]);
  const draftKey = useRef(""),
    previousKey = useRef<string | null>(null),
    recoveredKey = useRef<string | null>(null),
    recoveredFingerprint = useRef(""),
    latestServer = useRef<Snapshot | null>(null);
  const current = useRef<Workspace | null>(null),
    revision = useRef(0),
    generation = useRef(0),
    savedGeneration = useRef(0),
    busy = useRef(false),
    blocked = useRef(false),
    needsRecovery = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    pending = useRef<{
      data: Workspace;
      baseRevision: number;
      mutationId: string;
      generation: number;
    } | null>(null),
    cacheChain = useRef(Promise.resolve());
  const cache = useCallback((dirty: boolean) => {
    const c: Cached = {
      data: current.current!,
      revision: revision.current,
      dirty,
      updatedAt: new Date().toISOString(),
    };
    const ownKey = draftKey.current;
    const recovered = recoveredKey.current;
    const fingerprint = recoveredFingerprint.current;
    cacheChain.current = cacheChain.current
      .catch(() => {})
      .then(async () => {
        if (dirty) {
          await set(ownKey, c);
        } else {
          await set(CACHE, c);
          await del(ownKey);
          if (recovered) {
            // Atomically archive only the exact recovered draft. A newer edit in its owning tab survives.
            let archived = false;
            await updateCache<Cached | undefined>(recovered, (stored) => {
              if (stored && JSON.stringify(stored.data) === fingerprint) {
                archived = true;
                return { ...stored, dirty: false };
              }
              return stored;
            });
            recoveredKey.current = null;
            if (archived)
              setDrafts((d) => d.filter((x) => x.key !== recovered));
          }
        }
      })
      .catch(() => {
        setError(
          "Device storage is unavailable. Keep this tab open until changes are saved, or export a copy.",
        );
      });
  }, []);
  const recoverConflict = useCallback(async () => {
    setStatus("conflict");
    try {
      const r = await fetch("/api/workspace", { cache: "no-store" });
      if (r.status === 401) {
        setAuth(true);
        throw new Error("Sign in again to review the server version.");
      }
      if (!r.ok)
        throw new Error(
          "Could not load the server version. Retry when connected.",
        );
      const latest: Snapshot = await r.json();
      validateWorkspace(latest.data);
      latestServer.current = latest;
      setServerVersion(latest);
      setError(
        "This workspace changed elsewhere. Your draft is safe on this device. Choose which version to keep.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not fetch server version. Please retry.",
      );
    }
  }, []);
  const flush = useCallback(
    async function save() {
      if (
        !current.current ||
        busy.current ||
        blocked.current ||
        generation.current === savedGeneration.current
      )
        return;
      busy.current = true;
      setStatus("saving");
      const job = pending.current ?? {
        data: current.current,
        baseRevision: revision.current,
        mutationId: crypto.randomUUID(),
        generation: generation.current,
      };
      pending.current = job;
      let succeeded = false;
      try {
        const r = await fetch("/api/workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: job.data,
            baseRevision: job.baseRevision,
            mutationId: job.mutationId,
          }),
        });
        if (r.status === 401) {
          setAuth(true);
          blocked.current = true;
          throw new Error(
            "Your session expired. Sign in again to save your draft.",
          );
        }
        if (r.status === 409) {
          blocked.current = true;
          needsRecovery.current = true;
          await recoverConflict();
          return;
        }
        const body = await r.json();
        if (!r.ok) {
          // Only definitive rejection permits replacing the retry payload. Network/5xx stays idempotent.
          if ([400, 403, 413, 422].includes(r.status)) pending.current = null;
          throw new Error(body.error || "Could not save");
        }
        if (body.revision !== job.baseRevision + 1) {
          blocked.current = true;
          needsRecovery.current = true;
          setServerVersion(body);
          setStatus("conflict");
          setError(
            "A retry found newer server changes. Your local draft is preserved.",
          );
          return;
        }
        latestServer.current = body;
        revision.current = body.revision;
        savedGeneration.current = job.generation;
        pending.current = null;
        setError("");
        cache(generation.current !== savedGeneration.current);
        setStatus("saved");
        succeeded = true;
      } catch (e) {
        setStatus(navigator.onLine ? "error" : "offline");
        setError(
          e instanceof Error
            ? e.message
            : "Save failed. Your draft is stored on this device.",
        );
        cache(true);
      } finally {
        busy.current = false;
        if (
          succeeded &&
          !blocked.current &&
          pending.current === null &&
          generation.current !== savedGeneration.current
        )
          timer.current = setTimeout(() => void save(), 300);
      }
    },
    [cache, recoverConflict],
  );
  const load = useCallback(async () => {
    pending.current = null;
    generation.current = 0;
    savedGeneration.current = 0;
    setStatus("loading");
    setAuth(false);
    blocked.current = false;
    needsRecovery.current = false;
    if (!draftKey.current) {
      try {
        previousKey.current = sessionStorage.getItem(SESSION_DRAFT);
      } catch {}
      draftKey.current = DRAFT_PREFIX + crypto.randomUUID();
      try {
        sessionStorage.setItem(SESSION_DRAFT, draftKey.current);
      } catch {}
    }
    const allKeys = await keys().catch(() => []);
    const available: RecoverableDraft[] = [];
    for (const key of allKeys) {
      if (typeof key !== "string" || !key.startsWith(DRAFT_PREFIX)) continue;
      const d = await get<Cached>(key).catch(() => undefined);
      if (d?.dirty) {
        try {
          validateWorkspace(d.data);
          available.push({ ...d, key });
        } catch {}
      }
    }
    setDrafts(
      available.filter(
        (d) => d.key !== draftKey.current && d.key !== previousKey.current,
      ),
    );
    const clean = await get<Cached>(CACHE).catch(() => undefined);
    const own = available.find(
      (d) => d.key === draftKey.current || d.key === previousKey.current,
    );
    const cached = own || clean;
    recoveredKey.current =
      own?.key === draftKey.current ? null : own?.key || null;
    recoveredFingerprint.current = own ? JSON.stringify(own.data) : "";
    try {
      const r = await fetch("/api/workspace", { cache: "no-store" });
      if (r.status === 401) {
        setAuth(true);
        if (cached?.dirty) {
          current.current = cached.data;
          setWorkspace(cached.data);
          revision.current = cached.revision;
          generation.current = 1;
          blocked.current = true;
        }
        setStatus("error");
        return;
      }
      if (!r.ok) throw new Error("Could not load workspace");
      const s: Snapshot = await r.json();
      validateWorkspace(s.data);
      latestServer.current = s;
      revision.current = s.revision;
      if (cached?.dirty) {
        validateWorkspace(cached.data);
        current.current = cached.data;
        setWorkspace(cached.data);
        generation.current = 1;
        savedGeneration.current = 0;
        if (cached.revision !== s.revision) {
          blocked.current = true;
          needsRecovery.current = true;
          revision.current = cached.revision;
          cache(true);
          setServerVersion(s);
          setStatus("conflict");
          setError(
            "A recovered draft differs from the server. Both versions are available.",
          );
          return;
        }
        cache(true);
        setStatus("saving");
        timer.current = setTimeout(() => void flush(), 50);
      } else {
        current.current = s.data;
        setWorkspace(s.data);
        generation.current = 0;
        savedGeneration.current = 0;
        cache(false);
        setStatus("saved");
      }
    } catch (e) {
      if (cached) {
        current.current = validateWorkspace(cached.data);
        revision.current = cached.revision;
        setWorkspace(current.current);
        generation.current = cached.dirty ? 1 : 0;
        savedGeneration.current = 0;
        setStatus("offline");
        setError(
          "Working from this device’s copy. Changes will save when your server is available.",
        );
      } else {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Could not connect");
      }
    }
  }, [cache, flush]);
  useEffect(() => {
    void load();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);
  useEffect(() => {
    const online = () => {
      if (!blocked.current) void flush();
    };
    const offline = () => setStatus("offline");
    const unload = (e: BeforeUnloadEvent) => {
      if (generation.current !== savedGeneration.current) {
        cache(true);
        e.preventDefault();
      }
    };
    const retry = setInterval(() => {
      if (
        !blocked.current &&
        generation.current !== savedGeneration.current &&
        navigator.onLine
      )
        void flush();
    }, 15000);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("beforeunload", unload);
    return () => {
      clearInterval(retry);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("beforeunload", unload);
    };
  }, [cache, flush]);
  const update = useCallback(
    (mutate: (w: Workspace) => void) => {
      if (!current.current) return;
      const next = structuredClone(current.current);
      mutate(next);
      current.current = next;
      generation.current++;
      setWorkspace(next);
      cache(true);
      if (!blocked.current) {
        setStatus(navigator.onLine ? "saving" : "offline");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(), 700);
      }
    },
    [cache, flush],
  );
  const resolveConflict = useCallback(
    (keepDraft: boolean) => {
      if (!serverVersion) return;
      pending.current = null;
      revision.current = serverVersion.revision;
      blocked.current = false;
      needsRecovery.current = false;
      setServerVersion(null);
      setError("");
      if (keepDraft) {
        generation.current++;
        savedGeneration.current = 0;
        cache(true);
        void flush();
      } else {
        current.current = serverVersion.data;
        setWorkspace(serverVersion.data);
        generation.current = 0;
        savedGeneration.current = 0;
        cache(false);
        setStatus("saved");
      }
    },
    [serverVersion, cache, flush],
  );
  const recoverDraft = useCallback(
    (key: string) => {
      const draft = drafts.find((d) => d.key === key);
      if (!draft) return;
      // Fork the device key before replacing the current view, so this tab's earlier draft also survives.
      if (current.current && generation.current !== savedGeneration.current) {
        const preserved: RecoverableDraft = {
          key: draftKey.current,
          data: current.current,
          revision: revision.current,
          dirty: true,
          updatedAt: new Date().toISOString(),
        };
        setDrafts((d) => [
          ...d.filter((x) => x.key !== preserved.key),
          preserved,
        ]);
      }
      draftKey.current = DRAFT_PREFIX + crypto.randomUUID();
      try {
        sessionStorage.setItem(SESSION_DRAFT, draftKey.current);
      } catch {}
      pending.current = null;
      recoveredKey.current = key;
      recoveredFingerprint.current = JSON.stringify(draft.data);
      current.current = validateWorkspace(draft.data);
      revision.current = draft.revision;
      generation.current++;
      savedGeneration.current = 0;
      setWorkspace(current.current);
      cache(true);
      blocked.current = true;
      needsRecovery.current = true;
      setServerVersion(latestServer.current);
      setStatus("conflict");
      setError(
        "Recovered draft. Review the server version before replacing it.",
      );
      setDrafts((d) => d.filter((x) => x.key !== key));
    },
    [drafts, cache],
  );
  const signOut = useCallback(async () => {
    if (generation.current !== savedGeneration.current)
      throw new Error("Save or export your draft before signing out.");
    await fetch("/api/auth", { method: "DELETE" });
    await del(CACHE);
    current.current = null;
    setWorkspace(null);
    setAuth(true);
    setStatus("loading");
  }, []);
  const retry = useCallback(async () => {
    if (blocked.current && needsRecovery.current) await recoverConflict();
    else await flush();
  }, [recoverConflict, flush]);
  return {
    workspace,
    drafts,
    recoverDraft,
    update,
    status,
    error,
    authRequired,
    load,
    flush: retry,
    resolveConflict,
    serverVersion,
    signOut,
  };
}
