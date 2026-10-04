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
  StarIcon,
} from "@phosphor-icons/react";
import { type Workspace, type Page, livePages } from "@/lib/model";
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
    const children = pages.filter((c) => c.parentId === page.id);
    return (
      <div key={`${favorite ? "fav" : "tree"}-${page.id}`}>
        <div
          className={`tree-row ${p.active === page.id ? "active" : ""}`}
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
          <button
            className="tree-toggle"
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
          <button className="tree-page" onClick={() => p.open(page.id)}>
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
        <IconButton label="New page" onClick={() => p.create()}>
          <NotePencilIcon size={20} />
        </IconButton>
      </div>
      <nav className="main-nav">
        <button onClick={p.onSearch}>
          <MagnifyingGlassIcon size={20} />
          <span>Search</span>
          <kbd>⌘ K</kbd>
        </button>
        <button onClick={() => p.open("home")}>
          <HouseIcon size={20} />
          <span>Home</span>
        </button>
      </nav>
      <div className="sidebar-scroll">
        <button
          className="section-heading"
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
            onClick={() => setSection((s) => ({ ...s, private: !s.private }))}
          >
            Private
          </button>
          <IconButton label="Add private page" onClick={() => p.create()}>
            <PlusIcon size={14} />
          </IconButton>
        </div>
        {section.private &&
          pages.filter((q) => !q.parentId).map((q) => render(q))}
        <button className="sidebar-add" onClick={() => p.create()}>
          <PlusIcon size={17} />
          Add a page
        </button>
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
        <div className="workspace-caption">
          <StarIcon size={12} />A home for your ideas
        </div>
      </div>
    </aside>
  );
}
