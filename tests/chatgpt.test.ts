import { it, expect } from "vitest";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from "jose";
import { createVault } from "../src/lib/chatgpt-vault";
import { startAuthorization, finishAuthorization } from "../src/lib/chatgpt";
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
