"use client";
import { useState } from "react";
import {
  MagnifyingGlassIcon,
  HouseIcon,
  PlusIcon,
  CaretDownIcon,
  CaretRightIcon,
  CaretDoubleLeftIcon,
  GearSixIcon,
  TrashIcon,
  SquaresFourIcon,
  DotsThreeIcon,
  NotePencilIcon,
} from "@phosphor-icons/react";
import { type Workspace, type Page, livePages } from "@/lib/model";
import { WORKSPACE_HOME } from "./home";
import { IconButton, PageIcon } from "@/components/ui";
type Props = {
  workspace: Workspace;
  active: string;
  open: (id: string) => void;
  create: (parentId?: string) => void;
  onSearch: () => void;
  onSettings: () => void;
  onTemplates: () => void;
  onTrash: () => void;
  onClose: () => void;
  onPageMenu: (p: Page) => void;
  onMove: (id: string, parentId: string | null) => void;
};
export function Sidebar(p: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["home"]));
  const [section, setSection] = useState({ favorites: true, private: true });
  const pages = livePages(p.workspace);
  const render = (page: Page, depth = 0, favorite = false) => {
    const children =
      page.kind === "database"
        ? []
        : pages.filter((c) => c.parentId === page.id);
    return (
      <div key={`${favorite ? "fav" : "tree"}-${page.id}`}>
        <div
          className={`tree-row ${p.active === page.id ? (favorite ? "shortcut-current" : "active") : ""}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          draggable
          onDragStart={(e) =>
            e.dataTransfer.setData("application/x-jotstead-page", page.id)
          }
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = e.dataTransfer.getData("application/x-jotstead-page");
            if (id) p.onMove(id, page.id);
          }}
        >
          {children.length > 0 && !favorite ? (
            <button
              className="tree-toggle"
              aria-expanded={expanded.has(page.id)}
              aria-label={`${expanded.has(page.id) ? "Collapse" : "Expand"} ${page.title}`}
              onClick={() =>
                setExpanded((s) => {
                  const v = new Set(s);
                  v.has(page.id) ? v.delete(page.id) : v.add(page.id);
                  return v;
                })
              }
            >
              {children.length ? (
                expanded.has(page.id) ? (
                  <CaretDownIcon size={12} />
                ) : (
                  <CaretRightIcon size={12} />
                )
              ) : (
                <span />
              )}
            </button>
          ) : (
            <span className="tree-toggle" aria-hidden="true" />
          )}
          <button
            className="tree-page"
            aria-current={
              !favorite && p.active === page.id ? "page" : undefined
            }
            title={page.title || "Untitled"}
            onClick={() => p.open(page.id)}
          >
            <PageIcon icon={page.icon} kind={page.kind} />
            <span>{page.title || "Untitled"}</span>
          </button>
          <div className="tree-actions">
            <IconButton
              label={`Actions for ${page.title}`}
              onClick={() => p.onPageMenu(page)}
            >
              <DotsThreeIcon size={18} />
            </IconButton>
            <IconButton
              label={`Add page inside ${page.title}`}
              onClick={() => {
                setExpanded((s) => new Set(s).add(page.id));
                p.create(page.id);
              }}
            >
              <PlusIcon size={15} />
            </IconButton>
          </div>
        </div>
        {!favorite &&
          expanded.has(page.id) &&
          children.map((c) => render(c, depth + 1))}
      </div>
    );
  };
  return (
    <aside className="sidebar" aria-label="Workspace sidebar">
      <div className="workspace-switcher">
        <button onClick={p.onSettings}>
          <img src="/icons/icon-192.png" alt="" width={24} height={24} />
          <strong>{p.workspace.name}</strong>
          <CaretDownIcon size={13} />
        </button>
        <IconButton label="Close sidebar" onClick={p.onClose}>
          <CaretDoubleLeftIcon size={18} />
        </IconButton>
      </div>
      <nav className="main-nav">
        <button onClick={p.onSearch}>
          <MagnifyingGlassIcon size={20} />
          <span>Search</span>
          <kbd>⌘ K</kbd>
        </button>
        <button
          className={p.active === WORKSPACE_HOME ? "active" : ""}
          aria-current={p.active === WORKSPACE_HOME ? "page" : undefined}
          onClick={() => p.open(WORKSPACE_HOME)}
        >
          <HouseIcon size={20} />
          <span>Home</span>
        </button>
        <button className="sidebar-create" onClick={() => p.create()}>
          <NotePencilIcon size={20} />
          <span>New page</span>
        </button>
      </nav>
      <div className="sidebar-scroll">
        <button
          className="section-heading"
          aria-expanded={section.favorites}
          onClick={() => setSection((s) => ({ ...s, favorites: !s.favorites }))}
        >
          Favorites
        </button>
        {section.favorites &&
          pages
            .filter(
              (p) =>
                p.favorite &&
                !(
                  p.parentId &&
                  pages.find((q) => q.id === p.parentId)?.kind === "database"
                ),
            )
            .map((p) => render(p, 0, true))}
        <div className="section-line">
          <button
            className="section-heading"
            aria-expanded={section.private}
            onClick={() => setSection((s) => ({ ...s, private: !s.private }))}
          >
            Private
          </button>
        </div>
        {section.private &&
          pages.filter((q) => !q.parentId).map((q) => render(q))}
        <div
          className="root-drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = e.dataTransfer.getData("application/x-jotstead-page");
            if (id) p.onMove(id, null);
          }}
        >
          Drop a page here to move to Private
        </div>
      </div>
      <div className="sidebar-bottom">
        <button onClick={p.onTemplates}>
          <SquaresFourIcon size={18} />
          Templates
        </button>
        <button onClick={p.onSettings}>
          <GearSixIcon size={18} />
          Settings
        </button>
        <button onClick={p.onTrash}>
          <TrashIcon size={18} />
          Trash
        </button>
      </div>
    </aside>
  );
}
