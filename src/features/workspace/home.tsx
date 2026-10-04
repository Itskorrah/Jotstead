"use client";
import {
  ClockIcon,
  StarIcon,
  PlusIcon,
  DatabaseIcon,
  ArrowUpRightIcon,
} from "@phosphor-icons/react";
import { type Workspace, livePages } from "@/lib/model";
import { PageIcon } from "@/components/ui";
export const WORKSPACE_HOME = "workspace-home";
export function WorkspaceHome({
  workspace,
  open,
  create,
  templates,
}: {
  workspace: Workspace;
  open: (id: string) => void;
  create: (parentId?: string, kind?: "page" | "database") => void;
  templates: () => void;
}) {
  const pages = livePages(workspace).filter(
    (p) =>
      !p.parentId ||
      workspace.pages.find((q) => q.id === p.parentId)?.kind !== "database",
  );
  const recent = [...pages]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);
  const favorites = pages.filter((p) => p.favorite);
  return (
    <section className="workspace-home" aria-labelledby="home-title">
      <header className="home-header">
        <h1 id="home-title">Your workspace</h1>
        <p>Pick up where you left off.</p>
      </header>
      <div className="home-actions">
        <button className="primary" onClick={() => create()}>
          <PlusIcon size={16} />
          New page
        </button>
        <button
          className="subtle"
          onClick={() => create(undefined, "database")}
        >
          <DatabaseIcon size={16} />
          New database
        </button>
        <button className="subtle" onClick={templates}>
          Browse templates
          <ArrowUpRightIcon size={15} />
        </button>
      </div>
      <div className="home-section">
        <h2>
          <ClockIcon size={18} />
          Recently edited
        </h2>
        {recent.length ? (
          <div className="home-page-list">
            {recent.map((p) => (
              <button key={p.id} onClick={() => open(p.id)}>
                <PageIcon icon={p.icon} kind={p.kind} size={20} />
                <span>{p.title || "Untitled"}</span>
                <small>
                  {new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "short",
                  }).format(new Date(p.updatedAt))}
                </small>
                <ArrowUpRightIcon size={16} />
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">
            Your pages will appear here. Create a page to get started.
          </p>
        )}
      </div>
      {favorites.length > 0 && (
        <div className="home-section">
          <h2>
            <StarIcon size={18} />
            Favorites
          </h2>
          <div className="home-page-list">
            {favorites.map((p) => (
              <button key={p.id} onClick={() => open(p.id)}>
                <PageIcon icon={p.icon} kind={p.kind} size={20} />
                <span>{p.title || "Untitled"}</span>
                <ArrowUpRightIcon size={16} />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
