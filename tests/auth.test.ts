import { it, expect } from "vitest";
import {
  makeSession,
  verifySession,
  isSameOrigin,
  guard,
} from "../src/lib/auth";
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
