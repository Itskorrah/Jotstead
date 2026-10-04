"use client";
import { useState } from "react";
import { Modal, Field } from "@/components/ui";
import type { Page } from "@/lib/model";
import { briefSchema, type SharedBrief } from "@/lib/shared-brief";
import { captureSchema, type CaptureInput } from "@/lib/shared-context";
export function SharedBriefEditor({ page, onSave, onClose }: { page: Page; onSave: (brief: SharedBrief | undefined) => void; onClose: () => void }) {
  const [brief, setBrief] = useState<SharedBrief>(page.sharedBrief || { goals: "", preferences: "", decisions: "", nextActions: "" }), [error, setError] = useState("");
  return <Modal title="Shared project brief" onClose={onClose}><p>A concise source of truth for this project. Jotstead AI and your personal plugin can use it when you share this page.</p><form onSubmit={e => { e.preventDefault(); try { onSave(briefSchema.parse(brief)); onClose(); } catch(e) { setError((e as Error).message); } }}>
    {([['goals', 'Goals'], ['preferences', 'Preferences'], ['decisions', 'Decisions'], ['nextActions', 'Next actions']] as const).map(([key, label]) => <Field key={key} label={label}><textarea rows={3} maxLength={10000} value={brief[key]} onChange={e => setBrief({ ...brief, [key]: e.target.value })}/></Field>)}
    <Field label="Source ChatGPT conversation (optional)"><input type="url" placeholder="https://chatgpt.com/c/…" value={brief.sourceChatUrl || ""} onChange={e => setBrief({ ...brief, sourceChatUrl: e.target.value || undefined })}/></Field>
    {error && <p role="alert" className="error-text">{error}</p>}<div className="modal-actions"><button className="subtle" type="button" onClick={() => { onSave(undefined); onClose(); }}>Remove brief</button><button className="primary">Save brief</button></div>
  </form></Modal>;
}
export function SaveSelection({ pages, pageId, initialText = "", onSave, onClose }: { pages: Page[]; pageId?: string; initialText?: string; onSave: (input: CaptureInput) => void; onClose: () => void }) {
  const [input, setInput] = useState<CaptureInput>({ mode: pageId ? "append" : "create", pageId, title: "Saved from ChatGPT", markdown: initialText }), [error, setError] = useState("");
  return <Modal title="Save to Jotstead" onClose={onClose}><p>Save a selected answer, decision or plan. Review the content and choose its destination.</p><form onSubmit={e => { e.preventDefault(); try { onSave(captureSchema.parse(input)); onClose(); } catch(e) { setError((e as Error).message); } }}>
    <Field label="Destination"><select value={input.mode === "create" ? "new" : input.pageId || ""} onChange={e => setInput({ ...input, mode: e.target.value === "new" ? "create" : "append", pageId: e.target.value === "new" ? undefined : e.target.value })}><option value="new">Create a new page</option>{pages.filter(p => !p.deletedAt).map(p => <option key={p.id} value={p.id}>Append to {p.title || "Untitled"}</option>)}</select></Field>
    {input.mode === "create" && <Field label="Page title"><input required maxLength={500} value={input.title || ""} onChange={e => setInput({ ...input, title: e.target.value })}/></Field>}
    <Field label="Selected content"><textarea required rows={8} maxLength={100000} placeholder="Paste the selected ChatGPT answer, summary or plan…" value={input.markdown} onChange={e => setInput({ ...input, markdown: e.target.value })}/></Field>
    <Field label="Source conversation (optional)"><input type="url" placeholder="https://chatgpt.com/c/…" value={input.sourceChatUrl || ""} onChange={e => setInput({ ...input, sourceChatUrl: e.target.value || undefined })}/></Field>
    {error && <p className="error-text" role="alert">{error}</p>}<button className="primary">Save selection</button>
  </form></Modal>;
}
