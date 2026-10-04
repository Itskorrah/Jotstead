import { it, expect, vi, afterEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createVault } from "../src/lib/chatgpt-vault";
import { makeSession } from "../src/lib/auth";
import { finishAuthorization } from "../src/lib/chatgpt";
const mocks = vi.hoisted(() => ({
  vault: null as unknown,
  throttle: () => true,
}));
vi.mock("../src/lib/chatgpt-vault", async (original) => ({
  ...(await original<object>()),
  getVault: () => mocks.vault,
}));
vi.mock("../src/lib/store", () => ({
  getStore: () => ({ throttle: mocks.throttle }),
}));
import { POST } from "../src/app/api/chatgpt/start/route";
afterEach(() => vi.unstubAllEnvs());
it("requires the existing workspace password before binding ChatGPT, and binds that proof to the attempt", async () => {
  const vault = createVault(mkdtempSync(join(tmpdir(), "jotstead-migration-")));
  mocks.vault = vault;
  vi.stubEnv("JOTSTEAD_PASSWORD", "existing-owner-secret");
  const request = (cookie = "") =>
    new Request("http://127.0.0.1:3000/api/chatgpt/start", {
      method: "POST",
      headers: {
        origin: "http://127.0.0.1:3000",
        cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sharing: false }),
    });
  try {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request("jotstead_session=forged"))).status).toBe(401);
    const response = await POST(
      request("jotstead_session=" + makeSession("existing-owner-secret")),
    );
    expect(response.status).toBe(200);
    const url = new URL((await response.json()).url);
    const browserToken = response.headers
      .get("set-cookie")!
      .split(";")[0]
      .split("=")[1];
    const callback = new URL("http://127.0.0.1:3000/auth/callback");
    callback.search = new URLSearchParams({
      state: url.searchParams.get("state")!,
      code: "code",
      client_id: "oaiapp_test",
    }).toString();
    vi.stubEnv("JOTSTEAD_PASSWORD", "changed-password");
    let exchanges = 0;
    await expect(
      finishAuthorization(vault, callback, browserToken, () => {}, {
        request: async () => {
          exchanges++;
          return Response.json({});
        },
      }),
    ).rejects.toThrow(/password|migration/i);
    expect(exchanges).toBe(0);
    expect(vault.owner()).toBeNull();
  } finally {
    vault.close();
  }
});
it("retains first sign-in for an unprotected local workspace", async () => {
  const vault = createVault(
    mkdtempSync(join(tmpdir(), "jotstead-onboarding-")),
  );
  mocks.vault = vault;
  vi.stubEnv("JOTSTEAD_PASSWORD", "");
  try {
    expect(
      (
        await POST(
          new Request("http://127.0.0.1:3000/api/chatgpt/start", {
            method: "POST",
            headers: {
              origin: "http://127.0.0.1:3000",
              "Content-Type": "application/json",
            },
            body: "{}",
          }),
        )
      ).status,
    ).toBe(200);
  } finally {
    vault.close();
  }
});
