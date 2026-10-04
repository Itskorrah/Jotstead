import { randomBytes, createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { type Vault, type Credentials, browserHash } from "./chatgpt-vault";
import { verifySession } from "./auth";
const issuer = "https://auth.openai.com";
const tokenEndpoint = `${issuer}/api/accounts/oauth/token`;
const resource = "https://api.openai.com/v1";
const random = () => randomBytes(32).toString("base64url");
const signInMessages = {
  invalid_client:
    "OpenAI rejected Jotstead's app registration (invalid_client). This is an app registration problem, not an incorrect password. Check the OpenAI-issued client and its callback registration, or contact OpenAI if local registration is unavailable. Your notes have not changed.",
  invalid_grant:
    "This ChatGPT sign-in code expired or was already used. Return to Jotstead and start a fresh sign-in. Your notes have not changed.",
  access_denied:
    "ChatGPT authorization was declined. Return to Jotstead when you want to try again. Your notes have not changed.",
  unavailable:
    "OpenAI sign-in is unavailable. Return to Jotstead and try again later. Your notes have not changed.",
  failed:
    "ChatGPT sign-in could not be verified. Return to Jotstead and start a fresh sign-in with the workspace owner's account. Your notes have not changed.",
} as const;
export class ChatGPTSignInError extends Error {
  readonly code: keyof typeof signInMessages;
  constructor(code: unknown) {
    const safeCode =
      typeof code === "string" && Object.hasOwn(signInMessages, code)
        ? (code as keyof typeof signInMessages)
        : "failed";
    super(signInMessages[safeCode]);
    this.code = safeCode;
  }
}
export function startAuthorization(
  v: Vault,
  redirectUri: string,
  sharing: boolean,
  migrationSession?: string,
) {
  const redirect = new URL(redirectUri);
  if (
    redirect.protocol !== "http:" ||
    redirect.hostname !== "127.0.0.1" ||
    redirect.pathname !== "/auth/callback"
  )
    throw new Error("ChatGPT connection requires the local 127.0.0.1 app.");
  const state = random(),
    nonce = random(),
    verifier = random(),
    browserToken = random();
  const configured = process.env.JOTSTEAD_CHATGPT_CLIENT_ID?.trim();
  if (
    configured &&
    (!/^oaiapp_[A-Za-z0-9_-]{1,200}$/.test(configured) ||
      configured === "oaiapp_example")
  )
    throw new Error(
      "Set JOTSTEAD_CHATGPT_CLIENT_ID only to a real OpenAI-issued local client ID. Leave it unset for first-time dynamic registration.",
    );
  const owner = v.owner();
  if (owner && configured && configured !== owner.clientId)
    throw new Error(
      "The configured client does not match the workspace owner's registration. Restore the original client; ownership has not changed.",
    );
  const clientId =
    owner?.clientId || configured || v.registration() || "dynamic_agent_client";
  v.pending(state, {
    generation: v.authorizationGeneration(),
    migrationSession,
    nonce,
    verifier,
    redirectUri,
    clientId,
    browserHash: browserHash(browserToken),
    expiresAt: Date.now() + 10 * 60000,
  });
  const url = new URL(`${issuer}/api/accounts/authorize`);
  url.search = new URLSearchParams({
    client_id: clientId,
    ext_agent_host_id: v.hostId(),
    response_type: "code",
    redirect_uri: redirectUri,
    scope: sharing
      ? "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct"
      : "openid profile email",
    resource,
    state,
    nonce,
    code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    ...(sharing ? { prompt: "consent" } : {}),
    ...(clientId === "dynamic_agent_client"
      ? { agent_name_hint: "Jotstead" }
      : {}),
  }).toString();
  return { url: url.toString(), browserToken };
}
function trustedEndpoint(value: string) {
  const url = new URL(value);
  if (url.origin !== issuer)
    throw new Error("Unexpected OpenAI identity endpoint");
  return url;
}
async function configuration(request = fetch) {
  const r = await request(`${issuer}/.well-known/openid-configuration`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw new Error("OpenAI sign-in is unavailable. Try again shortly.");
  return r.json() as Promise<{ jwks_uri: string; revocation_endpoint: string }>;
}
function parseTokens(raw: Record<string, unknown>): Credentials {
  if (
    typeof raw.access_token !== "string" ||
    typeof raw.scope !== "string" ||
    typeof raw.expires_in !== "number" ||
    raw.expires_in <= 0
  )
    throw new Error("OpenAI returned an incomplete token response");
  return {
    accessToken: raw.access_token,
    scope: raw.scope,
    expiresAt: Date.now() + raw.expires_in * 1000,
    refreshToken:
      typeof raw.refresh_token === "string" ? raw.refresh_token : undefined,
    idToken: typeof raw.id_token === "string" ? raw.id_token : undefined,
    earliestRefreshAt:
      typeof raw.earliest_refresh_at === "number"
        ? raw.earliest_refresh_at * 1000
        : undefined,
  };
}
export async function finishAuthorization(
  v: Vault,
  callback: URL,
  browserToken: string,
  backup: () => void,
  deps: { request?: typeof fetch; keys?: Parameters<typeof jwtVerify>[1] } = {},
) {
  const a = v.consume(callback.searchParams.get("state") || "", browserToken);
  if (callback.origin + callback.pathname !== a.redirectUri)
    throw new Error("Callback address does not match this sign-in attempt");
  if (callback.searchParams.has("error"))
    throw new ChatGPTSignInError(callback.searchParams.get("error"));
  const code = callback.searchParams.get("code"),
    returned = callback.searchParams.get("client_id");
  const clientId =
    a.clientId === "dynamic_agent_client" ? returned : a.clientId;
  if (
    !code ||
    !clientId ||
    clientId === "dynamic_agent_client" ||
    (returned && returned !== clientId) ||
    !/^oaiapp_[A-Za-z0-9_-]{1,200}$/.test(clientId)
  )
    throw new Error(
      "ChatGPT registration was incomplete. Please sign in again.",
    );
  const password = process.env.JOTSTEAD_PASSWORD;
  if ((!v.owner() && password) || a.migrationSession) {
    if (
      !password ||
      !a.migrationSession ||
      !verifySession(a.migrationSession, password)
    )
      throw new Error(
        "Workspace password migration authorization expired. Sign in again.",
      );
  }
  if (a.generation !== v.authorizationGeneration())
    throw new Error("Sign-in cancelled. Please try again.");
  // Retain registration even if a code expires. This is not authenticated ownership.
  if (!v.owner()) v.saveRegistration(clientId);
  const request = deps.request || fetch;
  const r = await request(tokenEndpoint, {
    method: "POST",
    signal: AbortSignal.timeout(25000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      code_verifier: a.verifier,
      redirect_uri: a.redirectUri,
      resource,
    }).toString(),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    const code =
      typeof body?.error === "string"
        ? body.error
        : body?.error?.code || body?.error_code;
    throw new ChatGPTSignInError(
      code || (r.status >= 500 ? "unavailable" : "failed"),
    );
  }
  const tokens = parseTokens(await r.json());
  if (!tokens.idToken)
    throw new Error("ChatGPT did not return a verified identity");
  const keys =
    deps.keys ||
    createRemoteJWKSet(
      trustedEndpoint((await configuration(request)).jwks_uri),
    );
  const { payload } = await jwtVerify(
    tokens.idToken,
    keys as ReturnType<typeof createRemoteJWKSet>,
    { issuer, audience: clientId, algorithms: ["RS256", "ES256"] },
  );
  if (!payload.sub || payload.nonce !== a.nonce)
    throw new Error("ChatGPT identity did not match this sign-in attempt");
  return v.connect(
    {
      issuer,
      subject: payload.sub,
      clientId,
      email: typeof payload.email === "string" ? payload.email : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
    },
    tokens,
    backup,
    a.generation,
  );
}
export const sharingEnabled = (v: Vault) =>
  !!v.credentials()?.scope.split(" ").includes("chatgpt.tokens.use.direct");
export async function accessToken(v: Vault): Promise<string> {
  for (let wait = 0; wait < 60; wait++) {
    const { tokens } = v.credentialSnapshot();
    if (
      !tokens ||
      !tokens.scope.split(" ").includes("chatgpt.tokens.use.direct")
    )
      throw new Error(
        "Enable ChatGPT plan usage in Settings before asking AI.",
      );
    if (
      tokens.expiresAt > Date.now() + 60000 ||
      (tokens.earliestRefreshAt &&
        Date.now() < tokens.earliestRefreshAt &&
        tokens.expiresAt > Date.now())
    )
      return tokens.accessToken;
    if (!tokens.refreshToken)
      throw new Error(
        "Reconnect ChatGPT in Settings to renew AI access. Your notes remain available.",
      );
    if (!v.acquireRefresh()) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }
    try {
      const { tokens: current, version, owner } = v.credentialSnapshot();
      if (
        !current?.refreshToken ||
        !owner ||
        !current.scope.split(" ").includes("chatgpt.tokens.use.direct")
      )
        throw new Error("ChatGPT was disconnected");
      if (current.expiresAt > Date.now() + 60000) return current.accessToken;
      const r = await fetch(tokenEndpoint, {
        method: "POST",
        signal: AbortSignal.timeout(25000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: current.refreshToken,
          client_id: owner.clientId,
          resource,
        }).toString(),
      });
      if (!r.ok)
        throw new Error(
          "ChatGPT could not renew access. Reconnect in Settings; your notes remain available.",
        );
      const next = parseTokens(await r.json());
      if (!next.refreshToken)
        throw new Error("ChatGPT returned an incomplete renewal");
      next.idToken ||= current.idToken;
      if (!v.replaceCredentials(next, version))
        throw new Error(
          "ChatGPT connection changed during renewal. Please try again.",
        );
      return next.accessToken;
    } finally {
      v.releaseRefresh();
    }
  }
  throw new Error("ChatGPT renewal is busy. Please try again shortly.");
}
export async function disconnect(v: Vault) {
  const token = v.credentials()?.refreshToken,
    clientId = v.owner()?.clientId;
  v.disconnect(); // Invalidate refresh writes immediately, even if the network is down.
  if (!token || !clientId) return { remoteRevoked: true };
  try {
    const endpoint = trustedEndpoint(
      (await configuration()).revocation_endpoint,
    );
    for (let i = 0; i < 2; i++) {
      const r = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          token,
          token_type_hint: "refresh_token",
          client_id: clientId,
        }).toString(),
      });
      if (r.ok) return { remoteRevoked: true };
      if (r.status < 500) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch {
    /* Local disconnect is still authoritative. Never log provider data. */
  }
  return { remoteRevoked: false };
}
