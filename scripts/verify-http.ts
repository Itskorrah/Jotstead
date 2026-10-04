/** Exercise the built production routes in isolated storage with a disposable owner credential. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
const socket = createServer();
await new Promise<void>((r) => socket.listen(0, "127.0.0.1", r));
const port = (socket.address() as { port: number }).port;
await new Promise<void>((r) => socket.close(() => r()));
const origin = `http://127.0.0.1:${port}`;
const data = await mkdtemp(join(tmpdir(), "jotstead-http-"));
const password = randomUUID();
const child = spawn(process.execPath, [resolve(".next/standalone/server.js")], {
  env: {
    ...process.env,
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    JOTSTEAD_DATA_DIR: data,
    JOTSTEAD_PASSWORD: password,
    JOTSTEAD_PUBLIC_URL: origin,
    JOTSTEAD_LOCAL_ONLY: "0",
    JOTSTEAD_API_TOKEN: "",
    JOTSTEAD_AI_URL: "",
    JOTSTEAD_AI_KEY: "",
  },
  stdio: "ignore",
});
let cookie = "";
const request = (
  path: string,
  method = "GET",
  body?: unknown,
  authenticated = true,
  ownOrigin = origin,
) =>
  fetch(origin + path, {
    method,
    headers: {
      Origin: ownOrigin,
      ...(authenticated && cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      await request("/");
      ready = true;
      break;
    } catch {
      await delay(100);
    }
  }
  assert(ready, "production server did not start");
  assert.equal(
    (await request("/api/workspace", "GET", undefined, false)).status,
    401,
  );
  assert.equal(
    (await request("/api/auth", "POST", { password: "incorrect" }, false))
      .status,
    401,
  );
  const login = await request("/api/auth", "POST", { password }, false);
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie")!, /HttpOnly; SameSite=Strict/);
  cookie = login.headers.get("set-cookie")!.split(";")[0];
  let snapshot = await (await request("/api/workspace")).json();
  const put = () =>
    request("/api/workspace", "PUT", {
      data: snapshot.data,
      baseRevision: snapshot.revision,
      mutationId: randomUUID(),
    });
  const wrongOrigin = await request(
    "/api/workspace",
    "PUT",
    {},
    true,
    "https://other.example",
  );
  assert.equal(wrongOrigin.status, 403);
  const initial = structuredClone(snapshot);
  snapshot.data.name = "HTTP verification";
  const saved = await put();
  assert.equal(saved.status, 200);
  snapshot = await saved.json();
  assert.equal(
    (
      await request("/api/workspace", "PUT", {
        data: initial.data,
        baseRevision: initial.revision,
        mutationId: randomUUID(),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/workspace", "PUT", {
        data: { bad: true },
        baseRevision: snapshot.revision,
        mutationId: randomUUID(),
      })
    ).status,
    400,
  );
  const form = new FormData();
  form.set(
    "file",
    new Blob([await readFile("public/icons/icon-192.png")]),
    "icon.png",
  );
  const upload = await fetch(origin + "/api/uploads", {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie },
    body: form,
  });
  assert.equal(upload.status, 200);
  const attachment = await upload.json();
  assert.equal(attachment.image, true);
  assert.equal(
    (await request(attachment.url, "GET", undefined, false)).status,
    404,
  );
  const page = snapshot.data.pages.find(
    (p: { id: string }) => p.id === "notes",
  );
  page.published = true;
  page.content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Public validation page" }],
      },
      { type: "image", attrs: { src: attachment.url, alt: "Uploaded icon" } },
    ],
  };
  snapshot = await (await put()).json();
  const published = await request("/p/notes", "GET", undefined, false);
  assert.equal(published.status, 200);
  const html = await published.text();
  assert(html.includes("Public validation page"));
  assert(!html.includes("Plan the next chapter"));
  assert.equal(
    (await request(attachment.url, "GET", undefined, false)).status,
    200,
  );
  assert.equal(
    (await request("/api/workspace", "GET", undefined, false)).status,
    401,
  );
  snapshot.data.pages.find((p: { id: string }) => p.id === "notes").published =
    false;
  snapshot.data.pages.find(
    (p: { id: string }) => p.id === "projects",
  ).formEnabled = true;
  snapshot = await (await put()).json();
  assert.equal(
    (await request("/p/notes", "GET", undefined, false)).status,
    404,
  );
  assert.equal(
    (await request(attachment.url, "GET", undefined, false)).status,
    404,
  );
  assert.equal(
    (
      await request(
        "/api/form/projects",
        "POST",
        { name: "Public form response", values: {} },
        false,
      )
    ).status,
    200,
  );
  const fresh = await (await request("/api/workspace")).json();
  assert(
    fresh.data.pages.some(
      (p: { title: string }) => p.title === "Public form response",
    ),
  );
  const history = await (await request("/api/history?page=notes")).json();
  assert(Array.isArray(history) && history.length > 0);
  assert.equal((await (await request("/api/ai")).json()).available, false);
  assert.equal(
    (await request("/manifest.webmanifest", "GET", undefined, false)).status,
    200,
  );
  assert.equal((await request("/api/auth", "DELETE")).status, 200);
  console.log(
    "Production HTTP checks passed: password, CSRF, revisions, invalid state, upload privacy, publication/unpublication, forms, history, AI status, manifest and sign-out.",
  );
} finally {
  child.kill("SIGKILL");
}
