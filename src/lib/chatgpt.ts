import { randomBytes, createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { type Vault, type Credentials, browserHash } from "./chatgpt-vault";
const issuer = "https://auth.openai.com";
const tokenEndpoint = `${issuer}/api/accounts/oauth/token`;
const resource = "https://api.openai.com/v1";
const random = () => randomBytes(32).toString("base64url");
export function startAuthorization(v: Vault, redirectUri: string, sharing: boolean) {
  const redirect = new URL(redirectUri);
  if (redirect.protocol !== "http:" || redirect.hostname !== "127.0.0.1" || redirect.pathname !== "/auth/callback") throw new Error("ChatGPT connection requires the local 127.0.0.1 app.");
  const state = random(), nonce = random(), verifier = random(), browserToken = random();
  const clientId = v.owner()?.clientId || v.registration() || "dynamic_agent_client";
  v.pending(state, { nonce, verifier, redirectUri, clientId, browserHash: browserHash(browserToken), expiresAt: Date.now() + 10 * 60000 });
  const url = new URL(`${issuer}/api/accounts/authorize`);
  url.search = new URLSearchParams({ client_id: clientId, ext_agent_host_id: v.hostId(), response_type: "code", redirect_uri: redirectUri, scope: sharing ? "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct" : "openid profile email", resource, state, nonce, code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url"), ...(clientId === "dynamic_agent_client" ? { agent_name_hint: "Jotstead" } : {}) }).toString();
  return { url: url.toString(), browserToken };
}
function trustedEndpoint(value: string) { const url = new URL(value); if (url.origin !== issuer) throw new Error("Unexpected OpenAI identity endpoint"); return url; }
async function configuration(request = fetch) { const r = await request(`${issuer}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error("OpenAI sign-in is unavailable. Try again shortly."); return r.json() as Promise<{ jwks_uri: string; revocation_endpoint: string }>; }
function parseTokens(raw: Record<string, unknown>): Credentials {
  if (typeof raw.access_token !== "string" || typeof raw.scope !== "string" || typeof raw.expires_in !== "number" || raw.expires_in <= 0) throw new Error("OpenAI returned an incomplete token response");
  return { accessToken: raw.access_token, scope: raw.scope, expiresAt: Date.now() + raw.expires_in * 1000, refreshToken: typeof raw.refresh_token === "string" ? raw.refresh_token : undefined, idToken: typeof raw.id_token === "string" ? raw.id_token : undefined, earliestRefreshAt: typeof raw.earliest_refresh_at === "number" ? raw.earliest_refresh_at * 1000 : undefined };
}
export async function finishAuthorization(v: Vault, callback: URL, browserToken: string, backup: () => void, deps: { request?: typeof fetch; keys?: Parameters<typeof jwtVerify>[1] } = {}) {
  const a = v.consume(callback.searchParams.get("state") || "", browserToken);
  if (callback.origin + callback.pathname !== a.redirectUri) throw new Error("Callback address does not match this sign-in attempt");
  if (callback.searchParams.has("error")) throw new Error("ChatGPT authorization was declined. Your workspace has not changed.");
  const code = callback.searchParams.get("code"), returned = callback.searchParams.get("client_id");
  const clientId = a.clientId === "dynamic_agent_client" ? returned : a.clientId;
  if (!code || !clientId || clientId === "dynamic_agent_client" || (returned && returned !== clientId) || !/^oaiapp_[A-Za-z0-9_-]{1,200}$/.test(clientId)) throw new Error("ChatGPT registration was incomplete. Please sign in again.");
  // Retain registration even if a code expires. This is not authenticated ownership.
  if (!v.owner()) v.saveRegistration(clientId);
  const request = deps.request || fetch;
  const r = await request(tokenEndpoint, { method: "POST", signal: AbortSignal.timeout(25000), headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, code, code_verifier: a.verifier, redirect_uri: a.redirectUri, resource }).toString() });
  if (!r.ok) throw new Error("Could not finish ChatGPT sign-in. Please start a fresh sign-in.");
  const tokens = parseTokens(await r.json());
  if (!tokens.idToken) throw new Error("ChatGPT did not return a verified identity");
  const keys = deps.keys || createRemoteJWKSet(trustedEndpoint((await configuration(request)).jwks_uri));
  const { payload } = await jwtVerify(tokens.idToken, keys as ReturnType<typeof createRemoteJWKSet>, { issuer, audience: clientId, algorithms: ["RS256", "ES256"] });
  if (!payload.sub || payload.nonce !== a.nonce) throw new Error("ChatGPT identity did not match this sign-in attempt");
  return v.connect({ issuer, subject: payload.sub, clientId, email: typeof payload.email === "string" ? payload.email : undefined, name: typeof payload.name === "string" ? payload.name : undefined }, tokens, backup);
}
export const sharingEnabled = (v: Vault) => !!v.credentials()?.scope.split(" ").includes("chatgpt.tokens.use.direct");
export async function accessToken(v: Vault): Promise<string> {
  for (let wait = 0; wait < 60; wait++) {
    const tokens = v.credentials();
    if (!tokens || !sharingEnabled(v)) throw new Error("Enable ChatGPT plan usage in Settings before asking AI.");
    if (tokens.expiresAt > Date.now() + 60000 || (tokens.earliestRefreshAt && Date.now() < tokens.earliestRefreshAt && tokens.expiresAt > Date.now())) return tokens.accessToken;
    if (!tokens.refreshToken) throw new Error("Reconnect ChatGPT in Settings to renew AI access. Your notes remain available.");
    if (!v.acquireRefresh()) { await new Promise((resolve) => setTimeout(resolve, 500)); continue; }
    try {
      const current = v.credentials(), version = v.credentialVersion();
      if (!current?.refreshToken) throw new Error("ChatGPT was disconnected");
      if (current.expiresAt > Date.now() + 60000) return current.accessToken;
      const r = await fetch(tokenEndpoint, { method: "POST", signal: AbortSignal.timeout(25000), headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: current.refreshToken, client_id: v.owner()!.clientId, resource }).toString() });
      if (!r.ok) throw new Error("ChatGPT could not renew access. Reconnect in Settings; your notes remain available.");
      const next = parseTokens(await r.json());
      if (!next.refreshToken) throw new Error("ChatGPT returned an incomplete renewal");
      next.idToken ||= current.idToken;
      if (!v.replaceCredentials(next, version)) throw new Error("ChatGPT connection changed during renewal. Please try again.");
      return next.accessToken;
    } finally { v.releaseRefresh(); }
  }
  throw new Error("ChatGPT renewal is busy. Please try again shortly.");
}
export async function disconnect(v: Vault) {
  const token = v.credentials()?.refreshToken, clientId = v.owner()?.clientId;
  v.disconnect(); // Invalidate refresh writes immediately, even if the network is down.
  if (!token || !clientId) return { remoteRevoked: true };
  try {
    const endpoint = trustedEndpoint((await configuration()).revocation_endpoint);
    for (let i = 0; i < 2; i++) {
      const r = await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(10000), headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token, token_type_hint: "refresh_token", client_id: clientId }).toString() });
      if (r.ok) return { remoteRevoked: true };
      if (r.status < 500) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch { /* Local disconnect is still authoritative. Never log provider data. */ }
  return { remoteRevoked: false };
}
