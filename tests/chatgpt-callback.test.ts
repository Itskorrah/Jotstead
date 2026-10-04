import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as vaultModule from "../src/lib/chatgpt-vault";
import { startAuthorization } from "../src/lib/chatgpt";
import { GET } from "../src/app/auth/callback/route";

afterEach(() => vi.restoreAllMocks());
it("offers safe return navigation on a validated invalid_client callback without leaking provider data", async () => {
  const v = vaultModule.createVault(
    mkdtempSync(join(tmpdir(), "jotstead-callback-")),
  );
  vi.spyOn(vaultModule, "getVault").mockReturnValue(v);
  const start = startAuthorization(
    v,
    "http://127.0.0.1:3004/auth/callback",
    false,
  );
  const callback = new URL("http://127.0.0.1:3004/auth/callback");
  callback.search = new URLSearchParams({
    state: new URL(start.url).searchParams.get("state")!,
    error: "invalid_client",
    error_description: "SECRET<script>alert(1)</script>",
  }).toString();
  try {
    const response = await GET(
      new Request(callback, {
        headers: { Cookie: `jotstead_oauth=${start.browserToken}` },
      }),
    );
    const body = await response.text();
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(body).toContain("invalid_client");
    expect(body).toContain('href="/"');
    expect(body).not.toContain("SECRET");
    expect(body).not.toContain("<script>");
    expect(v.owner()).toBeNull();
  } finally {
    v.close();
  }
});
it("does not trust an OAuth error on an unverified attempt or reflect an untrusted host", async () => {
  const v = vaultModule.createVault(
    mkdtempSync(join(tmpdir(), "jotstead-callback-")),
  );
  vi.spyOn(vaultModule, "getVault").mockReturnValue(v);
  try {
    const response = await GET(
      new Request(
        "http://127.0.0.1:3004/auth/callback?state=forged&error=invalid_client",
        { headers: { Host: "untrusted.example" } },
      ),
    );
    const body = await response.text();
    expect(response.status).toBe(400);
    expect(body).not.toContain("invalid_client");
    expect(body).not.toContain("untrusted.example");
    expect(body).toContain('href="/"');
    expect(v.owner()).toBeNull();
  } finally {
    v.close();
  }
});
