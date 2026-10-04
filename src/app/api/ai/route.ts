import { guard, readJson } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { getVault } from "@/lib/chatgpt-vault";
import { accessToken, sharingEnabled } from "@/lib/chatgpt";
import { listModels, planRequest, responseEvents, providerError } from "@/lib/chatgpt-inference";
import { selectedContext } from "@/lib/shared-context";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(req: Request) {
  const denied = guard(req); if (denied) return denied;
  const vault = getVault();
  try {
    if (sharingEnabled(vault)) {
      const models = await listModels(vault);
      return Response.json({ available: !!models.length, provider: "chatgpt", models, model: models[0]?.name }, { headers: { "Cache-Control": "no-store" } });
    }
    const model = process.env.JOTSTEAD_AI_MODEL || "llama3.2";
    return Response.json({ available: !!process.env.JOTSTEAD_AI_URL, provider: process.env.JOTSTEAD_AI_URL ? "compatible" : null, models: process.env.JOTSTEAD_AI_URL ? [{ id: model, name: model }] : [], model }, { headers: { "Cache-Control": "no-store" } });
  } catch(e) { return Response.json({ available: false, provider: "chatgpt", models: [], error: e instanceof Error ? e.message : "AI unavailable" }, { headers: { "Cache-Control": "no-store" } }); }
}
export async function POST(req: Request) {
  const denied = guard(req, true); if (denied) return denied;
  try {
    const { prompt, model, contextPageIds, mode } = z.object({ prompt: z.string().trim().min(1).max(4000), model: z.string().min(1).max(200), contextPageIds: z.array(z.string().max(80)).max(12), mode: z.enum(["ask", "rewrite", "summarize", "translate", "tasks"]) }).parse(await readJson(req, 16000));
    const context = selectedContext(getStore().read().data, contextPageIds);
    const vault = getVault(), signal = AbortSignal.any([req.signal, AbortSignal.timeout(120000)]);
    if (!sharingEnabled(vault)) {
      if (!process.env.JOTSTEAD_AI_URL) return Response.json({ error: "Enable ChatGPT plan usage in Settings to ask AI. Your notes remain available." }, { status: 503 });
      const configuredModel = process.env.JOTSTEAD_AI_MODEL || "llama3.2";
      if (model !== configuredModel) throw new Error("Choose the configured provider model");
      const plan = planRequest(model, prompt, context.text, mode);
      const r = await fetch(process.env.JOTSTEAD_AI_URL.replace(/\/$/, "") + "/chat/completions", { method: "POST", signal, headers: { "Content-Type": "application/json", ...(process.env.JOTSTEAD_AI_KEY ? { Authorization: `Bearer ${process.env.JOTSTEAD_AI_KEY}` } : {}) }, body: JSON.stringify({ model, messages: [{ role: "system", content: plan.instructions }, ...plan.input] }) });
      if (!r.ok) throw new Error("Your configured AI provider could not complete the request");
      const result = await r.json();
      if (typeof result.choices?.[0]?.message?.content !== "string") throw new Error("No AI response returned");
      return Response.json({ text: result.choices[0].message.content, sources: context.sources, completed: true });
    }
    const models = await listModels(vault, signal);
    if (!models.some(m => m.id === model)) return Response.json({ error: "This model is no longer available. Refresh the model list and choose another." }, { status: 400 });
    const token = await accessToken(vault);
    const provider = await fetch("https://api.openai.com/v1/responses", { method: "POST", signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(planRequest(model, prompt, context.text, mode)) });
    if (!provider.ok || !provider.body) {
      const error = await provider.json().catch(() => ({}));
      return Response.json({ error: providerError(error.error?.code) }, { status: provider.status === 429 ? 429 : 502 });
    }
    const encoder = new TextEncoder(); let cancelled = false;
    const body = new ReadableStream({ async start(controller) {
      const send = (value: unknown) => { if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(value) + "\n")); };
      try { send({ type: "sources", sources: context.sources }); for await (const event of responseEvents(provider.body!)) send(event); }
      catch(e) { send({ type: "error", error: e instanceof Error ? e.message : "AI response interrupted" }); }
      finally { if (!cancelled) controller.close(); }
    }, cancel() { cancelled = true; } });
    return new Response(body, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  } catch(e) { return Response.json({ error: e instanceof Error ? e.message : "AI request failed" }, { status: e instanceof z.ZodError ? 400 : 502 }); }
}
