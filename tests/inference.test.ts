import { it, expect } from "vitest";
import { responseEvents, planRequest } from "../src/lib/chatgpt-inference";
const stream = (events: unknown[]) => new ReadableStream<Uint8Array>({ start(c) { const data = events.map(e => `data: ${JSON.stringify(e)}\n\n`).join(""); const encoded = new TextEncoder().encode(data); for(let i=0;i<encoded.length;i+=7) c.enqueue(encoded.slice(i,i+7)); c.close(); } });
it("parses split SSE frames and requires an explicit completed terminal event", async () => {
  const result = [];
  for await (const event of responseEvents(stream([{ type: "response.output_text.delta", delta: "Hello 🌿" }, { type: "response.completed" }]))) result.push(event);
  expect(result).toEqual([{ type: "delta", text: "Hello 🌿" }, { type: "completed" }]);
  await expect(async () => { for await (const _ of responseEvents(stream([{ type: "response.output_text.delta", delta: "Partial" }]))) {} }).rejects.toThrow(/interrupted/i);
});
it("does not turn a late quota error into a completed response", async () => {
  const events: unknown[] = [];
  await expect(async () => { for await (const e of responseEvents(stream([{ type: "response.output_text.delta", delta: "Partial" }, { type: "response.failed", response: { error: { code: "subscription_sharing_usage_limit_exceeded" } } }]))) events.push(e); }).rejects.toThrow(/allowance/i);
  expect(events).not.toContainEqual({ type: "completed" });
});
it("constructs the documented plan request without unsupported provider options", () => {
  const body = planRequest("selected-model", "Question", "Only selected content", "ask");
  expect(body).toMatchObject({ model: "selected-model", store: false, stream: true, input: [{ role: "user" }] });
  expect(body).not.toHaveProperty("temperature"); expect(body).not.toHaveProperty("max_output_tokens"); expect(body).not.toHaveProperty("conversation");
});
