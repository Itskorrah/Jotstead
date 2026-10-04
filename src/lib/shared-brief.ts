import { z } from "zod";
export const sourceChatSchema = z.string().max(2000).refine(value => {
  try { const u = new URL(value); return u.protocol === "https:" && u.hostname === "chatgpt.com" && !u.username && !u.password && /^\/(c|share)\/[a-zA-Z0-9_-]+\/?$/.test(u.pathname) && !u.search && !u.hash; } catch { return false; }
}, "Use a ChatGPT conversation or share link");
export const briefSchema = z.object({ goals: z.string().max(10000), preferences: z.string().max(10000), decisions: z.string().max(10000), nextActions: z.string().max(10000), sourceChatUrl: sourceChatSchema.optional() });
export type SharedBrief = z.infer<typeof briefSchema>;
