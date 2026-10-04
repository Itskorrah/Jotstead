import { it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from "jose";
import { createVault } from "../src/lib/chatgpt-vault";
import {
  startAuthorization,
  finishAuthorization,
  accessToken,
} from "../src/lib/chatgpt";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const dir = () => mkdtempSync(join(tmpdir(), "jotstead-auth-"));
const identity = {
  issuer: "https://auth.openai.com",
  subject: "owner",
  clientId: "oaiapp_test",
  email: "owner@example.test",
  name: "Owner",
};
const credentials = {
  accessToken: "secret-access",
  refreshToken: "secret-refresh",
  idToken: "secret-id",
  scope: "openid profile email chatgpt.tokens.use.direct",
  expiresAt: Date.now() + 3600000,
};
it("encrypts credentials and binds ownership before issuing revocable sessions", () => {
  const root = dir(),
    v = createVault(root);
  const session = v.connect(identity, credentials, () => {});
  expect(v.verifySession(session)).toBe(true);
  expect(
    readFileSync(join(root, "auth.sqlite")).includes(
      Buffer.from("secret-access"),
    ),
  ).toBe(false);
  expect(statSync(join(root, "auth.key")).mode & 0o777).toBe(0o600);
  expect(() =>
    v.connect({ ...identity, subject: "intruder" }, credentials, () => {}),
  ).toThrow(/owner/i);
  expect(v.credentials()?.accessToken).toBe("secret-access");
  v.revokeSession(session);
  expect(v.verifySession(session)).toBe(false);
  v.disconnect();
  expect(v.credentials()).toBeNull();
  expect(v.owner()?.subject).toBe("owner");
  v.close();
});
it("validates PKCE, browser binding, issued client ID and signed identity; rejects replay", async () => {
  const v = createVault(dir());
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test";
  const keys = createLocalJWKSet({ keys: [jwk] });
  const start = startAuthorization(
    v,
    "http://127.0.0.1:3000/auth/callback",
    false,
  );
  const url = new URL(start.url),
    state = url.searchParams.get("state")!;
  expect(url.searchParams.get("scope")).toBe("openid profile email");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  const callback = new URL("http://127.0.0.1:3000/auth/callback");
  callback.search = new URLSearchParams({
    state,
    code: "code",
    client_id: "oaiapp_test",
  }).toString();
  const jwt = await new SignJWT({
    nonce: url.searchParams.get("nonce"),
    email: identity.email,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer(identity.issuer)
    .setAudience(identity.clientId)
    .setSubject(identity.subject)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
  let exchanged = 0;
  const request: typeof fetch = async (_url, init) => {
    exchanged++;
    const body = new URLSearchParams(String(init?.body));
    expect(body.get("client_id")).toBe(identity.clientId);
    expect(body.get("code_verifier")?.length).toBeGreaterThanOrEqual(43);
    expect(body.get("redirect_uri")).toBe(callback.origin + callback.pathname);
    return Response.json({
      access_token: "access",
      id_token: jwt,
      expires_in: 3600,
      scope: "openid profile email",
    });
  };
  await expect(
    finishAuthorization(v, callback, "wrong-browser", () => {}, {
      request,
      keys,
    }),
  ).rejects.toThrow(/expired|browser/i);
  expect(exchanged).toBe(0);
  const session = await finishAuthorization(
    v,
    callback,
    start.browserToken,
    () => {},
    { request, keys },
  );
  expect(v.verifySession(session)).toBe(true);
  expect(v.credentials()?.scope).not.toContain("chatgpt.tokens.use.direct");
  await expect(
    finishAuthorization(v, callback, start.browserToken, () => {}, {
      request,
      keys,
    }),
  ).rejects.toThrow(/expired/i);
  v.close();
});
it("keeps stale refreshes from restoring disconnected credentials", () => {
  const v = createVault(dir());
  v.connect(identity, credentials, () => {});
  const revision = v.credentialVersion();
  v.disconnect();
  expect(v.replaceCredentials(credentials, revision)).toBe(false);
  expect(v.credentials()).toBeNull();
  v.close();
});
it("uses a supplied issued local client without dynamic registration metadata", () => {
  vi.stubEnv("JOTSTEAD_CHATGPT_CLIENT_ID", "oaiapp_localIssued");
  const v = createVault(dir());
  try {
    const url = new URL(
      startAuthorization(v, "http://127.0.0.1:3000/auth/callback", false).url,
    );
    expect(url.searchParams.get("client_id")).toBe("oaiapp_localIssued");
    expect(url.searchParams.has("agent_name_hint")).toBe(false);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:3000/auth/callback",
    );
  } finally {
    v.close();
  }
});
it.each(["dynamic_agent_client", "oaiapp_example", "invented-client"])(
  "refuses a configured placeholder %s before redirecting to OpenAI",
  (client) => {
    vi.stubEnv("JOTSTEAD_CHATGPT_CLIENT_ID", client);
    const v = createVault(dir());
    try {
      expect(() =>
        startAuthorization(v, "http://127.0.0.1:3000/auth/callback", false),
      ).toThrow(/issued.*client/i);
      expect(v.owner()).toBeNull();
    } finally {
      v.close();
    }
  },
);
it("does not replace a bound owner's registration with another configured client", () => {
  const v = createVault(dir());
  v.connect(identity, credentials, () => {});
  vi.stubEnv("JOTSTEAD_CHATGPT_CLIENT_ID", "oaiapp_other");
  try {
    expect(() =>
      startAuthorization(v, "http://127.0.0.1:3000/auth/callback", false),
    ).toThrow(/owner.*registration/i);
    expect(v.owner()?.clientId).toBe(identity.clientId);
    expect(v.credentials()?.accessToken).toBe(credentials.accessToken);
  } finally {
    v.close();
  }
});
it("requests consent only when the user explicitly enables plan usage", () => {
  const v = createVault(dir());
  try {
    const normal = new URL(
      startAuthorization(v, "http://127.0.0.1:3000/auth/callback", false).url,
    );
    const sharing = new URL(
      startAuthorization(v, "http://127.0.0.1:3000/auth/callback", true).url,
    );
    expect(normal.searchParams.has("prompt")).toBe(false);
    expect(sharing.searchParams.get("prompt")).toBe("consent");
  } finally {
    v.close();
  }
});
it.each(["callback", "token"])(
  "explains invalid_client from %s without leaking provider text or binding ownership",
  async (source) => {
    const v = createVault(dir());
    const start = startAuthorization(
      v,
      "http://127.0.0.1:3000/auth/callback",
      false,
    );
    const auth = new URL(start.url);
    const callback = new URL("http://127.0.0.1:3000/auth/callback");
    callback.search = new URLSearchParams({
      state: auth.searchParams.get("state")!,
      ...(source === "callback"
        ? {
            error: "invalid_client",
            error_description: "DO_NOT_REFLECT_PROVIDER_SECRET",
          }
        : { code: "secret-code", client_id: "oaiapp_issued" }),
    }).toString();
    const request: typeof fetch = async () =>
      Response.json(
        {
          error: "invalid_client",
          error_description: "DO_NOT_REFLECT_PROVIDER_SECRET",
        },
        { status: 401 },
      );
    try {
      const error = await finishAuthorization(
        v,
        callback,
        start.browserToken,
        () => {
          throw new Error("Must not back up an invalid identity");
        },
        { request },
      ).catch((e) => e);
      expect(error.code).toBe("invalid_client");
      expect(error.message).toMatch(/OpenAI rejected Jotstead.*registration/i);
      expect(error.message).not.toContain("DO_NOT_REFLECT_PROVIDER_SECRET");
      expect(v.owner()).toBeNull();
      expect(v.credentials()).toBeNull();
    } finally {
      v.close();
    }
  },
);
it("retains an issued client after invalid_grant and asks for a fresh attempt", async () => {
  const v = createVault(dir());
  const start = startAuthorization(
    v,
    "http://127.0.0.1:3000/auth/callback",
    false,
  );
  const callback = new URL("http://127.0.0.1:3000/auth/callback");
  callback.search = new URLSearchParams({
    state: new URL(start.url).searchParams.get("state")!,
    code: "expired-code",
    client_id: "oaiapp_issued",
  }).toString();
  try {
    const request: typeof fetch = async () =>
      Response.json({ error: "invalid_grant" }, { status: 400 });
    const error = await finishAuthorization(
      v,
      callback,
      start.browserToken,
      () => {},
      { request },
    ).catch((e) => e);
    expect(error.code).toBe("invalid_grant");
    expect(error.message).toMatch(/fresh sign-in/i);
    expect(v.registration()).toBe("oaiapp_issued");
    expect(v.owner()).toBeNull();
  } finally {
    v.close();
  }
});
it.each(["nonce", "issuer", "audience", "expired"])(
  "rejects a signed identity with invalid %s before workspace ownership changes",
  async (failure) => {
    const v = createVault(dir()),
      { privateKey, publicKey } = await generateKeyPair("RS256"),
      jwk = await exportJWK(publicKey);
    jwk.kid = "key";
    const start = startAuthorization(
        v,
        "http://127.0.0.1:3000/auth/callback",
        false,
      ),
      auth = new URL(start.url);
    const callback = new URL("http://127.0.0.1:3000/auth/callback");
    callback.search = new URLSearchParams({
      state: auth.searchParams.get("state")!,
      code: "code",
      client_id: "oaiapp_test",
    }).toString();
    const jwt = await new SignJWT({
      nonce: failure === "nonce" ? "wrong" : auth.searchParams.get("nonce"),
    })
      .setProtectedHeader({ alg: "RS256", kid: "key" })
      .setSubject("owner")
      .setIssuer(failure === "issuer" ? "https://evil.test" : identity.issuer)
      .setAudience(failure === "audience" ? "other-client" : identity.clientId)
      .setExpirationTime(failure === "expired" ? "-1h" : "1h")
      .sign(privateKey);
    const request: typeof fetch = async () =>
      Response.json({
        access_token: "not-accepted",
        id_token: jwt,
        expires_in: 3600,
        scope: "openid profile email",
      });
    await expect(
      finishAuthorization(
        v,
        callback,
        start.browserToken,
        () => {
          throw new Error("Must not back up an unverified identity");
        },
        { request, keys: createLocalJWKSet({ keys: [jwk] }) },
      ),
    ).rejects.toThrow();
    expect(v.owner()).toBeNull();
    expect(v.credentials()).toBeNull();
    v.close();
  },
);
it("serializes token rotation across independently opened runtime vaults", () => {
  const root = dir(),
    a = createVault(root),
    b = createVault(root);
  expect(a.acquireRefresh()).toBe(true);
  expect(b.acquireRefresh()).toBe(false);
  a.releaseRefresh();
  expect(b.acquireRefresh()).toBe(true);
  b.releaseRefresh();
  a.close();
  b.close();
});

it.each(["before", "during", "sign-out"])(
  "cancels OAuth %s exchange without restoring credentials or issuing a session",
  async (when) => {
    const root = dir(),
      v = createVault(root),
      other = createVault(root);
    const session = v.connect(identity, credentials, () => {});
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    jwk.kid = "cancel";
    const start = startAuthorization(
      v,
      "http://127.0.0.1:3000/auth/callback",
      false,
    );
    const url = new URL(start.url),
      callback = new URL("http://127.0.0.1:3000/auth/callback");
    callback.search = new URLSearchParams({
      state: url.searchParams.get("state")!,
      code: "code",
      client_id: identity.clientId,
    }).toString();
    const jwt = await new SignJWT({ nonce: url.searchParams.get("nonce") })
      .setProtectedHeader({ alg: "RS256", kid: "cancel" })
      .setIssuer(identity.issuer)
      .setAudience(identity.clientId)
      .setSubject(identity.subject)
      .setExpirationTime("1h")
      .sign(privateKey);
    let exchanged = 0;
    if (when === "before") other.disconnect();
    const request: typeof fetch = async () => {
      exchanged++;
      if (when === "during") other.disconnect();
      if (when === "sign-out") other.revokeSession(session);
      return Response.json({
        access_token: "must-not-restore",
        id_token: jwt,
        scope: "openid profile email",
        expires_in: 3600,
      });
    };
    try {
      await expect(
        finishAuthorization(v, callback, start.browserToken, () => {}, {
          request,
          keys: createLocalJWKSet({ keys: [jwk] }),
        }),
      ).rejects.toThrow(/expired|cancelled/i);
      expect(exchanged).toBe(when === "before" ? 0 : 1);
      expect(v.credentials()?.accessToken).toBe(
        when === "sign-out" ? credentials.accessToken : undefined,
      );
    } finally {
      v.close();
      other.close();
    }
  },
);
it("rejects credentials rotated from a different authorization during refresh", async () => {
  const root = dir(),
    v = createVault(root),
    other = createVault(root);
  v.connect(
    identity,
    { ...credentials, expiresAt: Date.now() - 1000 },
    () => {},
  );
  const readCredentials = v.credentials.bind(v);
  // Reproduce a second runtime reconnect between a credential read and version read.
  let reads = 0;
  v.credentials = () => {
    const old = readCredentials();
    if (++reads === 3)
      other.connect(
        identity,
        { ...credentials, accessToken: "new-consent" },
        () => {},
      );
    return old;
  };
  const snapshotVault = v as {
    credentialSnapshot?: typeof v.credentialSnapshot;
  };
  if (snapshotVault.credentialSnapshot) {
    const snapshot = snapshotVault.credentialSnapshot.bind(v);
    let count = 0;
    snapshotVault.credentialSnapshot = () => {
      const value = snapshot();
      if (++count === 2)
        other.connect(
          identity,
          { ...credentials, accessToken: "new-consent" },
          () => {},
        );
      return value;
    };
  }
  vi.stubGlobal("fetch", async () =>
    Response.json({
      access_token: "stale-renewal",
      refresh_token: "rotated",
      scope: credentials.scope,
      expires_in: 3600,
    }),
  );
  try {
    const result = await accessToken(v).catch(() => "rejected");
    expect(result).not.toBe("stale-renewal");
    expect(other.credentials()?.accessToken).not.toBe("stale-renewal");
  } finally {
    v.close();
    other.close();
  }
});
