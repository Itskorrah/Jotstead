// @vitest-environment happy-dom
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import { useWorkspace } from "../src/features/workspace/use-workspace";
import { get, set, keys, update as updateCache, del } from "idb-keyval";
import { createSeed } from "../src/lib/seed";
vi.mock("idb-keyval", () => ({
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => {}),
  del: vi.fn(async () => {}),
  keys: vi.fn(async () => []),
  update: vi.fn(async () => {}),
}));
beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(get).mockImplementation(async () => undefined);
  vi.mocked(set).mockImplementation(async () => {});
  vi.mocked(del).mockImplementation(async () => {});
  vi.mocked(keys).mockImplementation(async () => []);
  vi.mocked(updateCache).mockImplementation(async () => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
it("can save corrected edits after a definitively rejected payload", async () => {
  let savedTitle = "";
  let puts = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        puts++;
        const b = JSON.parse(init.body as string);
        if (puts === 1) return json({ error: "title too long" }, 400);
        savedTitle = b.data.pages[0].title;
        return json({ revision: 1, data: b.data });
      }
      return json({ revision: 0, data: createSeed() });
    }),
  );
  const { result } = renderHook(useWorkspace);
  await waitFor(() => expect(result.current.status).toBe("saved"));
  act(() =>
    result.current.update((w) => {
      w.pages[0].title = "x".repeat(501);
    }),
  );
  await act(async () => {
    await result.current.flush();
  });
  expect(result.current.status).toBe("error");
  act(() =>
    result.current.update((w) => {
      w.pages[0].title = "Corrected";
    }),
  );
  await act(async () => {
    await result.current.flush();
  });
  expect(savedTitle).toBe("Corrected");
  expect(result.current.status).toBe("saved");
});
it("recovers conflict controls if fetching the server version initially fails", async () => {
  let gets = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return json({ error: "conflict" }, 409);
      gets++;
      if (gets === 2) throw new Error("Network interrupted");
      return json({ revision: gets === 1 ? 0 : 1, data: createSeed() });
    }),
  );
  const { result } = renderHook(useWorkspace);
  await waitFor(() => expect(result.current.status).toBe("saved"));
  act(() =>
    result.current.update((w) => {
      w.pages[0].title = "Local draft";
    }),
  );
  await act(async () => {
    await result.current.flush();
  });
  expect(result.current.status).toBe("conflict");
  expect(result.current.serverVersion).toBeNull();
  await act(async () => {
    await result.current.flush();
  });
  expect(result.current.serverVersion?.revision).toBe(1);
  expect(result.current.workspace?.pages[0].title).toBe("Local draft");
  act(() => result.current.resolveConflict(false));
  expect(result.current.status).toBe("saved");
  expect(result.current.workspace?.pages[0].title).toBe("Getting started");
});
it("serializes edits made during a save without losing the newer draft", async () => {
  let release: (r: Response) => void = () => {};
  let count = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        count++;
        const b = JSON.parse(init.body as string);
        if (count === 1)
          return new Promise<Response>((resolve) => {
            release = resolve;
          });
        return json({ revision: 2, data: b.data });
      }
      return json({ revision: 0, data: createSeed() });
    }),
  );
  const { result } = renderHook(useWorkspace);
  await waitFor(() => expect(result.current.status).toBe("saved"));
  act(() =>
    result.current.update((w) => {
      w.pages[0].title = "First edit";
    }),
  );
  let saving: Promise<void>;
  act(() => {
    saving = result.current.flush();
  });
  act(() =>
    result.current.update((w) => {
      w.pages[0].title = "Newer edit";
    }),
  );
  await act(async () => {
    release(json({ revision: 1, data: createSeed() }));
    await saving;
  });
  await act(async () => {
    await result.current.flush();
  });
  expect(result.current.workspace?.pages[0].title).toBe("Newer edit");
  expect(result.current.status).toBe("saved");
});

it("keeps two offline tabs in separate recoverable device drafts", async () => {
  const device = new Map<string, unknown>();
  vi.mocked(get).mockImplementation(
    async (key) => device.get(String(key)) as never,
  );
  vi.mocked(set).mockImplementation(async (key, value) => {
    device.set(String(key), value);
  });
  vi.mocked(keys).mockImplementation(async () => [...device.keys()]);
  let offline = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (offline || init?.method === "PUT") throw new Error("Offline");
      return json({ revision: 0, data: createSeed() });
    }),
  );
  const first = renderHook(useWorkspace);
  await waitFor(() => expect(first.result.current.status).toBe("saved"));
  const second = renderHook(useWorkspace);
  await waitFor(() => expect(second.result.current.status).toBe("saved"));
  offline = true;
  act(() =>
    first.result.current.update((w) => {
      w.name = "First tab draft";
    }),
  );
  act(() =>
    second.result.current.update((w) => {
      w.name = "Second tab draft";
    }),
  );
  await waitFor(() =>
    expect(
      [...device.keys()].filter((k) => k.startsWith("jotstead.draft.v1."))
        .length,
    ).toBe(2),
  );
  expect(
    [...device.values()]
      .filter((v) => (v as { dirty?: boolean }).dirty)
      .map((v) => (v as { data: { name: string } }).data.name)
      .sort(),
  ).toEqual(["First tab draft", "Second tab draft"]);
  first.unmount();
  second.unmount();
  sessionStorage.clear();
  offline = false;
  const reopened = renderHook(useWorkspace);
  await waitFor(() => expect(reopened.result.current.drafts).toHaveLength(2));
  const key = reopened.result.current.drafts.find(
    (d) => d.data.name === "First tab draft",
  )!.key;
  act(() => reopened.result.current.recoverDraft(key));
  expect(reopened.result.current.status).toBe("conflict");
  expect(reopened.result.current.workspace?.name).toBe("First tab draft");
  expect(reopened.result.current.serverVersion?.revision).toBe(0);
});

it.each([false, true])(
  "archives recovered drafts atomically without hiding another tab's newer edits (concurrent=%s)",
  async (concurrent) => {
    const sourceKey = "jotstead.draft.v1.previous";
    const draft = createSeed();
    draft.name = "Recovered draft";
    const device = new Map<string, any>([
      [sourceKey, { data: draft, revision: 0, dirty: true }],
    ]);
    sessionStorage.setItem("jotstead.active-draft.v1", sourceKey);
    vi.mocked(get).mockImplementation(async (key) => device.get(String(key)));
    vi.mocked(keys).mockImplementation(async () => [...device.keys()]);
    vi.mocked(set).mockImplementation(async (key, value) => {
      device.set(String(key), value);
    });
    vi.mocked(del).mockImplementation(async (key) => {
      device.delete(String(key));
    });
    vi.mocked(updateCache).mockImplementation(async (key, updater) => {
      device.set(String(key), updater(device.get(String(key))));
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          const b = JSON.parse(init.body as string);
          if (concurrent) {
            const newer = structuredClone(draft);
            newer.name = "Newer edit from another tab";
            device.set(sourceKey, { data: newer, revision: 0, dirty: true });
          }
          return json({ revision: 1, data: b.data });
        }
        return json({ revision: 0, data: createSeed() });
      }),
    );
    const { result } = renderHook(useWorkspace);
    await waitFor(() => expect(result.current.status).toBe("saved"));
    await waitFor(() => expect(device.get(sourceKey)?.dirty).toBe(concurrent));
    if (concurrent)
      expect(device.get(sourceKey).data.name).toBe(
        "Newer edit from another tab",
      );
  },
);
