import { it, expect, vi, afterEach } from "vitest";
import { createVault } from "../src/lib/chatgpt-vault";
import * as vaultModule from "../src/lib/chatgpt-vault";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  makeSession,
  verifySession,
  isSameOrigin,
  guard,
  authorize,
} from "../src/lib/auth";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it("keeps ChatGPT optional for a local workspace even after owner binding", () => {
  const v = createVault(mkdtempSync(join(tmpdir(), "jotstead-local-auth-")));
  v.connect(
    {
      issuer: "https://auth.openai.com",
      subject: "local-owner",
      clientId: "oaiapp_local",
    },
    { accessToken: "token", scope: "openid", expiresAt: Date.now() + 60000 },
    () => {},
  );
  vi.spyOn(vaultModule, "getVault").mockReturnValue(v);
  vi.stubEnv("JOTSTEAD_LOCAL_ONLY", "1");
  vi.stubEnv("JOTSTEAD_PASSWORD", "");
  try {
    expect(authorize(new Request("http://127.0.0.1:3000/api/workspace"))).toBe(
      true,
    );
    expect(
      authorize(
        new Request("http://127.0.0.1:3000/api/workspace", {
          headers: { Host: "remote.example" },
        }),
      ),
    ).toBe(false);
    expect(authorize(new Request("https://remote.example/api/workspace"))).toBe(
      false,
    );
    vi.stubEnv("JOTSTEAD_LOCAL_ONLY", "0");
    expect(authorize(new Request("http://127.0.0.1:3000/api/workspace"))).toBe(
      false,
    );
  } finally {
    v.close();
  }
});
it("rejects forged, expired, and wrong password sessions", () => {
  const s = makeSession("secret", 1000);
  expect(verifySession(s, "secret", 1001)).toBe(true);
  expect(verifySession(s + "a", "secret", 1001)).toBe(false);
  expect(verifySession(s, "wrong", 1001)).toBe(false);
  expect(verifySession(s, "secret", 1000 + 8 * 86400000)).toBe(false);
});
it("rejects cross-origin state mutations", () => {
  expect(
    isSameOrigin(
      new Request("http://localhost:3000/api/workspace", {
        headers: { origin: "https://evil.test" },
      }),
    ),
  ).toBe(false);
  expect(
    isSameOrigin(
      new Request("http://localhost:3000/api/workspace", {
        headers: { origin: "http://localhost:3000" },
      }),
    ),
  ).toBe(true);
});
it("handles Next internal hostname while checking the browser Host", () => {
  expect(
    isSameOrigin(
      new Request("http://localhost:3000/api/workspace", {
        headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" },
      }),
    ),
  ).toBe(true);
});
it("never lets a forged bearer header bypass CSRF for a valid browser session", () => {
  const old = process.env.JOTSTEAD_PASSWORD;
  process.env.JOTSTEAD_PASSWORD = "csrf-secret";
  const req = new Request("http://localhost:3000/api/workspace", {
    headers: {
      origin: "https://evil.test",
      Authorization: "Bearer forged",
      cookie: "jotstead_session=" + makeSession("csrf-secret"),
    },
  });
  expect(guard(req, true)?.status).toBe(403);
  if (old === undefined) delete process.env.JOTSTEAD_PASSWORD;
  else process.env.JOTSTEAD_PASSWORD = old;
});
