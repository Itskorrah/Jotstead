"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import {
  ListIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  StarIcon,
  DotsThreeIcon,
  ClockCounterClockwiseIcon,
  ChatCircleIcon,
  ShareNetworkIcon,
  PlusIcon,
  CopyIcon,
  TrashIcon,
  ArrowSquareOutIcon,
  DownloadSimpleIcon,
  ArrowsOutIcon,
  ArrowBendUpLeftIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  ImageIcon,
  SmileyIcon,
  FileTextIcon,
  DatabaseIcon,
  SparkleIcon,
  LinkIcon,
  CloudSlashIcon,
  CloudCheckIcon,
} from "@phosphor-icons/react";
import { useWorkspace } from "./use-workspace";
import { Sidebar } from "./sidebar";
import { Settings, ImportDialog } from "./settings";
import { ChatGPTLogin } from "@/features/chatgpt/connection";
import { Database } from "@/features/databases/database";
import { PropertyCell } from "@/features/databases/property-cell";
import { runRules } from "@/features/databases/query";
import {
  newPage,
  now,
  uid,
  movePage,
  trashPage,
  descendants,
  livePages,
  textOf,
  type Page,
  type Workspace,
  type Doc,
} from "@/lib/model";
import {
  markdownExport,
  workspaceExport,
  referencedPages,
} from "@/lib/transfer";
import { duplicateTree, restorePageSnapshot } from "@/lib/commands";
import { createSeed } from "@/lib/seed";
import {
  IconButton,
  Modal,
  Menu,
  PageIcon,
  Field,
  download,
  EmptyState,
} from "@/components/ui";
const PageEditor = dynamic(
  () => import("@/features/editor/editor").then((m) => m.PageEditor),
  { ssr: false, loading: () => <div className="editor-loading" /> },
);
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function WorkspaceApp() {
  const store = useWorkspace();
  const { workspace, update, status } = store;
  const [active, setActive] = useState("home"),
    [sidebar, setSidebar] = useState(true),
    [modal, setModal] = useState<string | null>(null),
    [menu, setMenu] = useState<Page | null>(null),
    [message, setMessage] = useState(""),
    [theme, setThemeState] = useState("light"),
    [rowPeek, setRowPeek] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [searchIndex, setSearchIndex] = useState(0),
    [moveTarget, setMoveTarget] = useState(""),
    [history, setHistory] = useState<
      { id: number; createdAt: string; page: Page }[]
    >([]),
    [comment, setComment] = useState(""),
    [password, setPassword] = useState(""),
    [loginError, setLoginError] = useState(""),
    [busy, setBusy] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [aiMode, setAiMode] = useState("ask"),
    [aiPrompt, setAiPrompt] = useState(""),
    [aiResponse, setAiResponse] = useState(""),
    [aiSources, setAiSources] = useState<{ id: string; title: string }[]>([]),
    [aiAvailable, setAiAvailable] = useState(false),
    [aiBusy, setAiBusy] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const historyNav = useRef<string[]>(["home"]),
    navIndex = useRef(0);
  const [navigation, setNavigation] = useState({ back: false, forward: false });
  const page =
    workspace?.pages.find(
      (p) => p.id === (rowPeek || active) && !p.deletedAt,
    ) || workspace?.pages.find((p) => !p.deletedAt);
  const mainPage =
    workspace?.pages.find((p) => p.id === active && !p.deletedAt) ||
    workspace?.pages.find((p) => !p.deletedAt);
  const menuPage = menu ? workspace?.pages.find((p) => p.id === menu.id) : page;
  const show = useCallback((m: string | null) => {
    setMenu(null);
    setModal(m);
  }, []);
  const notify = useCallback((m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(""), 5000);
  }, []);
  const open = useCallback((id: string, record = true) => {
    setActive(id);
    setRowPeek(null);
    setModal(null);
    setMenu(null);
    const params = new URLSearchParams(window.location.search);
    params.set("page", id);
    window.history.replaceState(null, "", "/?" + params.toString());
    localStorage.setItem("jotstead.active", id);
    if (window.innerWidth < 768) setSidebar(false);
    if (record) {
      historyNav.current = historyNav.current.slice(0, navIndex.current + 1);
      if (historyNav.current.at(-1) !== id) {
        historyNav.current.push(id);
        navIndex.current++;
      }
    }
    setNavigation({
      back: navIndex.current > 0,
      forward: navIndex.current < historyNav.current.length - 1,
    });
  }, []);
  const create = useCallback(
    (parentId?: string, kind: Page["kind"] = "page") => {
      const p = newPage("Untitled", parentId || null, kind);
      if (kind === "database")
        p.properties = [
          {
            id: "status",
            name: "Status",
            type: "select",
            options: ["Not started", "In progress", "Done"],
          },
        ];
      update((w) => w.pages.push(p));
      open(p.id);
      setTimeout(() => {
        titleRef.current?.focus();
        titleRef.current?.select();
      }, 100);
    },
    [update, open],
  );
  useEffect(() => {
    const id =
      new URLSearchParams(window.location.search).get("page") ||
      localStorage.getItem("jotstead.active") ||
      "home";
    setActive(id);
    historyNav.current = [id];
    setThemeState(localStorage.getItem("jotstead.theme") || "light");
    if (window.innerWidth < 768) setSidebar(false);
    const handler = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  const setTheme = (t: string) => {
    setThemeState(t);
    localStorage.setItem("jotstead.theme", t);
  };
  useEffect(() => {
    document.title = `${page?.title || "Jotstead"} · Jotstead`;
    if (titleRef.current) {
      titleRef.current.style.height = "auto";
      titleRef.current.style.height = titleRef.current.scrollHeight + "px";
    }
  }, [page?.title]);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch("");
        setSearchIndex(0);
        show("search");
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        create();
      }
      if (e.key === "Escape") {
        setMenu(null);
        setModal(null);
        setRowPeek(null);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [create, show]);
  useEffect(() => {
    if (modal === "history" && page)
      fetch("/api/history?page=" + page.id)
        .then((r) => r.json())
        .then((h) => {
          if (Array.isArray(h)) setHistory(h);
        })
        .catch(() => notify("Could not load history"));
    if (modal === "ai")
      fetch("/api/ai")
        .then((r) => r.json())
        .then((b) => setAiAvailable(!!b.available))
        .catch(() => {});
  }, [modal, page?.id, notify]);
  const updatePage = useCallback(
    (fn: (p: Page) => void) => {
      if (!page) return;
      update((w) => {
        const p = w.pages.find((p) => p.id === page.id)!;
        fn(p);
        p.updatedAt = now();
      });
    },
    [page?.id, update],
  );
  const ready = useCallback((e: Editor) => {
    editorRef.current = e;
  }, []);
  const onEditorChange = useCallback(
    (d: Doc) => {
      if (!page) return;
      update((w) => {
        const p = w.pages.find((p) => p.id === page.id)!;
        p.content = d;
        p.updatedAt = now();
      });
    },
    [page?.id, update],
  );
  const found = useMemo(
    () =>
      workspace
        ? livePages(workspace)
            .filter((p) =>
              `${p.title} ${textOf(p.content)}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .slice(0, 30)
        : [],
    [workspace, search],
  );
  const parent = page?.parentId
    ? workspace?.pages.find((p) => p.id === page.parentId)
    : null;
  const ancestors: Page[] = [];
  if (mainPage && workspace) {
    let c = mainPage;
    while (c.parentId) {
      const p = workspace.pages.find((p) => p.id === c.parentId);
      if (!p) break;
      ancestors.unshift(p);
      c = p;
    }
  }
  const backlinks =
    workspace && page
      ? workspace.pages.filter(
          (p) =>
            !p.deletedAt &&
            p.id !== page.id &&
            referencedPages(p.content).includes(page.id),
        )
      : [];
  const installApp = async () => {
    if (install) {
      await install.prompt();
      const c = await install.userChoice;
      notify(
        c.outcome === "accepted"
          ? "Jotstead is ready to install."
          : "You can install Jotstead later from your browser menu.",
      );
      setInstall(null);
    } else {
      show("install");
    }
  };
  const duplicate = (p: Page) => {
    let id = "";
    update((w) => {
      id = duplicateTree(w, p.id).id;
    });
    open(id);
  };
  const linkPage = (target: Page) => {
    editorRef.current
      ?.chain()
      .focus()
      .insertContent({
        type: "pageLink",
        attrs: { pageId: target.id, title: target.title, icon: target.icon },
      })
      .run();
    show(null);
  };
  if (store.authRequired)
    return <ChatGPTLogin onLogin={store.load} draftExport={workspace ? () => download("jotstead-unsaved-draft.json", workspaceExport(workspace)) : undefined}/>;
  if (!workspace)
    return (
      <div className="loading-screen">
        <img src="/icons/icon-192.png" alt="" width={48} height={48} />
        <h2>
          {status === "loading"
            ? "Opening your workspace…"
            : "Your workspace is unavailable"}
        </h2>
        {store.error && <p role="alert">{store.error}</p>}
        {status !== "loading" && (
          <button className="primary" onClick={() => void store.load()}>
            Try again
          </button>
        )}
      </div>
    );
  const renderPage = (p: Page, peek = false) => (
    <>
      <div
        className={`page ${p.fullWidth ? "full-width" : ""} ${p.smallText ? "small-text" : ""} font-${p.font} ${p.cover ? "with-cover" : ""} ${p.icon ? "with-icon" : ""}`}
      >
        {p.icon && (
          <button
            className="page-icon"
            aria-label="Change page icon"
            onClick={() => show("icon")}
          >
            <PageIcon icon={p.icon} size={72} />
          </button>
        )}
        <div className="page-customize">
          {!p.icon && (
            <button onClick={() => show("icon")}>
              <SmileyIcon size={15} />
              Add icon
            </button>
          )}
          <button onClick={() => show("cover")}>
            <ImageIcon size={15} />
            {p.cover ? "Change cover" : "Add cover"}
          </button>
          <button onClick={() => show("comments")}>
            <ChatCircleIcon size={15} />
            Add comment
          </button>
        </div>
        <textarea
          ref={peek ? undefined : titleRef}
          className="page-title"
          maxLength={500}
          aria-label="Page title"
          rows={1}
          placeholder="Untitled"
          value={p.title}
          onChange={(e) =>
            updatePage((page) => {
              page.title = e.target.value;
            })
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              editorRef.current?.commands.focus("start");
            }
          }}
        />
        {parent?.kind === "database" && p.parentId === parent.id && (
          <div className="row-properties">
            {parent.properties.map((prop) => (
              <div className="row-property" key={prop.id}>
                <span>{prop.name}</span>
                <PropertyCell
                  property={prop}
                  row={p}
                  db={parent}
                  workspace={workspace}
                  onChange={(v) =>
                    update((w) => {
                      const row = w.pages.find((q) => q.id === p.id)!;
                      row.values[prop.id] = v;
                      row.updatedAt = now();
                      runRules(w, row, prop.id);
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}
        {p.kind === "database" ? (
          <Database
            key={p.id}
            page={p}
            workspace={workspace}
            update={update}
            onOpen={(id) => setRowPeek(id)}
          />
        ) : (
          <PageEditor
            key={p.id}
            content={p.content}
            onChange={onEditorChange}
            onReady={ready}
            onNavigate={open}
          />
        )}
        {p.kind === "page" &&
          workspace.pages.some((q) => q.parentId === p.id && !q.deletedAt) && (
            <div className="child-pages">
              {workspace.pages
                .filter(
                  (q) =>
                    q.parentId === p.id &&
                    !q.deletedAt &&
                    !referencedPages(p.content).includes(q.id),
                )
                .map((q) => (
                  <button key={q.id} onClick={() => open(q.id)}>
                    <PageIcon icon={q.icon} />
                    <span>{q.title}</span>
                  </button>
                ))}
            </div>
          )}
        {backlinks.length > 0 && (
          <div className="backlinks">
            <small>Links to this page</small>
            {backlinks.map((q) => (
              <button key={q.id} onClick={() => open(q.id)}>
                <PageIcon icon={q.icon} />
                {q.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
  return (
    <div className={`app-shell ${sidebar ? "sidebar-open" : ""}`}>
      {sidebar && (
        <Sidebar
          workspace={workspace}
          active={active}
          open={open}
          create={create}
          onSearch={() => {
            setSearch("");
            show("search");
          }}
          onSettings={() => show("settings")}
          onTemplates={() => show("templates")}
          onTrash={() => show("trash")}
          onClose={() => setSidebar(false)}
          onPageMenu={(p) => {
            setMenu(p);
          }}
          onMove={(id, parentId) => {
            try {
              update((w) => movePage(w, id, parentId));
            } catch (e) {
              notify(e instanceof Error ? e.message : "Could not move page");
            }
          }}
        />
      )}
      {sidebar && (
        <button
          className="mobile-sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      <a href="#workspace-content" className="skip-link">
        Skip to page content
      </a>
      <main className="workspace-main" id="workspace-content">
        <header className="topbar">
          <div className="breadcrumbs">
            {!sidebar && (
              <IconButton label="Open sidebar" onClick={() => setSidebar(true)}>
                <ListIcon size={20} />
              </IconButton>
            )}
            <IconButton
              label="Go back"
              disabled={!navigation.back}
              onClick={() => {
                navIndex.current--;
                open(historyNav.current[navIndex.current], false);
              }}
            >
              <ArrowLeftIcon size={17} />
            </IconButton>
            <IconButton
              label="Go forward"
              disabled={!navigation.forward}
              onClick={() => {
                navIndex.current++;
                open(historyNav.current[navIndex.current], false);
              }}
            >
              <ArrowRightIcon size={17} />
            </IconButton>
            {ancestors.map((p) => (
              <span className="breadcrumb-parent" key={p.id}>
                <button onClick={() => open(p.id)}>
                  <PageIcon icon={p.icon} size={16} />
                  {p.title}
                </button>
                <span>/</span>
              </span>
            ))}
            {mainPage && (
              <button
                className="breadcrumb-current"
                onClick={() => open(mainPage.id)}
              >
                <PageIcon icon={mainPage.icon} kind={mainPage.kind} size={16} />
                <span>{mainPage.title || "Untitled"}</span>
              </button>
            )}
          </div>
          <div className="topbar-actions">
            <button
              className={`save-indicator ${status}`}
              title={store.error || "Your changes are saved automatically"}
              onClick={() => void store.flush()}
              aria-label={`Save status: ${status}`}
            >
              {status === "saved" ? (
                <CloudCheckIcon size={14} />
              ) : status === "offline" ||
                status === "error" ||
                status === "conflict" ? (
                <CloudSlashIcon size={14} />
              ) : (
                <span className="saving-dot" />
              )}
              <span>
                {status === "saved"
                  ? "Saved"
                  : status === "saving"
                    ? "Saving…"
                    : status === "offline"
                      ? "Offline"
                      : status === "conflict"
                        ? "Conflict"
                        : "Retry save"}
              </span>
            </button>
            <button className="share-button" onClick={() => show("share")}>
              Share
            </button>
            <IconButton label="Ask AI" onClick={() => show("ai")}>
              <SparkleIcon size={18} />
            </IconButton>
            <IconButton label="Comments" onClick={() => show("comments")}>
              <ChatCircleIcon size={18} />
            </IconButton>
            <IconButton label="Page history" onClick={() => show("history")}>
              <ClockCounterClockwiseIcon size={18} />
            </IconButton>
            {page && (
              <IconButton
                label={
                  page.favorite ? "Remove from favorites" : "Add to favorites"
                }
                onClick={() =>
                  updatePage((p) => {
                    p.favorite = !p.favorite;
                  })
                }
              >
                <StarIcon
                  size={20}
                  weight={page.favorite ? "fill" : "regular"}
                  color={page.favorite ? "#d4a341" : undefined}
                />
              </IconButton>
            )}
            <IconButton
              label="Page menu"
              onClick={() => setMenu(menu ? null : page || null)}
            >
              <DotsThreeIcon size={23} />
            </IconButton>
          </div>
        </header>
        {["conflict", "error", "offline"].includes(status) && (
          <div className={`save-banner ${status}`} role="status">
            <span>
              {status === "conflict"
                ? "A newer server version needs your attention."
                : status === "offline"
                  ? "You’re offline. Changes are kept on this device."
                  : store.error}
            </span>
            <button
              onClick={() =>
                download("jotstead-draft.json", workspaceExport(workspace))
              }
            >
              Export draft
            </button>
            {status === "conflict" ? (
              <button onClick={() => show("conflict")}>Review versions</button>
            ) : (
              <button onClick={() => void store.flush()}>Retry</button>
            )}
          </div>
        )}
        {store.drafts.length > 0 && (
          <div className="save-banner" role="status">
            <span>
              {store.drafts.length} recoverable draft
              {store.drafts.length === 1 ? "" : "s"} from other sessions on this
              device.
            </span>
            <button onClick={() => show("drafts")}>Review drafts</button>
          </div>
        )}
        <div className="page-scroll">
          {mainPage?.cover && (
            <div
              className="page-cover"
              style={
                mainPage.cover.startsWith("color:")
                  ? { backgroundColor: mainPage.cover.slice(6) }
                  : undefined
              }
            >
              {!mainPage.cover.startsWith("color:") && (
                <img src={mainPage.cover} alt="Page cover" />
              )}
              <button onClick={() => show("cover")}>Change cover</button>
            </div>
          )}
          {mainPage ? (
            renderPage(mainPage)
          ) : (
            <EmptyState
              title="A fresh workspace"
              description="Start with your first page."
            >
              <button className="primary" onClick={() => create()}>
                Create a page
              </button>
            </EmptyState>
          )}
          <div className="page-bottom-space" />
        </div>
      </main>
      {rowPeek && page && (
        <Modal wide title="Database page" onClose={() => setRowPeek(null)}>
          <div className="peek-actions">
            <button className="subtle" onClick={() => open(rowPeek)}>
              <ArrowsOutIcon size={16} />
              Open as full page
            </button>
            <IconButton label="Row page actions" onClick={() => setMenu(page)}>
              <DotsThreeIcon size={20} />
            </IconButton>
          </div>
          {renderPage(page, true)}
        </Modal>
      )}
      {menu &&
        menuPage &&
        createPortal(
          <div className="page-menu-anchor">
            <Menu className="page-menu" onClose={() => setMenu(null)}>
              <div className="font-options">
                {(["default", "serif", "mono"] as const).map((font) => (
                  <button
                    key={font}
                    className={`font-${font} ${menuPage.font === font ? "active" : ""}`}
                    onClick={() =>
                      update((w) => {
                        w.pages.find((p) => p.id === menuPage.id)!.font = font;
                      })
                    }
                  >
                    <strong>Ag</strong>
                    <small>{font[0].toUpperCase() + font.slice(1)}</small>
                  </button>
                ))}
              </div>
              <button
                onClick={() =>
                  update((w) => {
                    const p = w.pages.find((p) => p.id === menuPage.id)!;
                    p.smallText = !p.smallText;
                  })
                }
              >
                <span>Small text</span>
                <span className={`switch ${menuPage.smallText ? "on" : ""}`} />
              </button>
              <button
                onClick={() =>
                  update((w) => {
                    const p = w.pages.find((p) => p.id === menuPage.id)!;
                    p.fullWidth = !p.fullWidth;
                  })
                }
              >
                <span>Full width</span>
                <span className={`switch ${menuPage.fullWidth ? "on" : ""}`} />
              </button>
              <hr />
              <button
                onClick={() => {
                  setActive(menuPage.id);
                  show("linkpage");
                }}
              >
                <LinkIcon size={17} />
                Link to a page
              </button>
              <button
                onClick={() => {
                  duplicate(menuPage);
                  setMenu(null);
                }}
              >
                <CopyIcon size={17} />
                Duplicate
              </button>
              <button
                onClick={() => {
                  setMoveTarget(menuPage.parentId || "");
                  setActive(menuPage.id);
                  show("move");
                }}
              >
                <ArrowBendUpLeftIcon size={17} />
                Move to
              </button>
              <button
                onClick={() => {
                  download(
                    menuPage.title + ".md",
                    markdownExport(menuPage),
                    "text/markdown",
                  );
                  setMenu(null);
                }}
              >
                <DownloadSimpleIcon size={17} />
                Export Markdown
              </button>
              <button
                onClick={() => {
                  setActive(menuPage.id);
                  show("history");
                }}
              >
                <ClockCounterClockwiseIcon size={17} />
                Version history
              </button>
              <button
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(
                      window.location.origin + "/?page=" + menuPage.id,
                    )
                    .then(() => notify("Page link copied"))
                    .catch(() =>
                      notify("Copy the page URL from your browser."),
                    );
                  setMenu(null);
                }}
              >
                <LinkIcon size={17} />
                Copy link
              </button>
              <hr />
              <button
                className="danger"
                onClick={() => {
                  update((w) => trashPage(w, menuPage.id));
                  setMenu(null);
                  setRowPeek(null);
                  notify("Page moved to Trash");
                }}
              >
                <TrashIcon size={17} />
                Move to Trash
              </button>
              <div className="menu-label">
                Edited {new Date(menuPage.updatedAt).toLocaleDateString()}
              </div>
            </Menu>
          </div>,
          document.querySelector("dialog[open]") || document.body,
        )}
      {modal === "search" && (
        <Modal title="Search your workspace" onClose={() => show(null)}>
          <div className="search-field">
            <MagnifyingGlassIcon size={22} />
            <input
              autoFocus
              placeholder="Search pages and content…"
              aria-label="Search workspace"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSearchIndex((i) => Math.min(i + 1, found.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSearchIndex((i) => Math.max(i - 1, 0));
                }
                if (e.key === "Enter" && found[searchIndex])
                  open(found[searchIndex].id);
              }}
            />
          </div>
          <div className="search-results">
            {found.map((p, i) => (
              <button
                key={p.id}
                className={i === searchIndex ? "selected" : ""}
                onClick={() => open(p.id)}
              >
                <PageIcon icon={p.icon} kind={p.kind} />
                <span>
                  <strong>{p.title || "Untitled"}</strong>
                  <small>{textOf(p.content).slice(0, 80)}</small>
                </span>
              </button>
            ))}
            {!found.length && <p className="muted">No pages found.</p>}
          </div>
          <div className="search-footer">
            <kbd>↑ ↓</kbd> Navigate <kbd>↵</kbd> Open <kbd>esc</kbd> Close
          </div>
        </Modal>
      )}
      {modal === "settings" && (
        <Settings
          workspace={workspace}
          update={update}
          onClose={() => show(null)}
          onImport={() => show("import")}
          onSignOut={() => store.signOut().catch((e) => notify(e.message))}
          theme={theme}
          setTheme={setTheme}
          onInstall={() => void installApp()}
        />
      )}
      {modal === "import" && (
        <ImportDialog
          workspace={workspace}
          replace={(next) =>
            update((w) => {
              w.name = next.name;
              w.pages = next.pages;
              w.rules = next.rules;
            })
          }
          append={(pages) => {
            update((w) => w.pages.push(...pages));
            open(pages[0].id);
          }}
          onClose={() => show(null)}
        />
      )}
      {modal === "trash" && (
        <Modal title="Trash" onClose={() => show(null)}>
          <p className="muted">
            Restore a page whenever you need it. Its child pages return too.
          </p>
          {workspace.pages
            .filter(
              (p) =>
                p.deletedAt &&
                !workspace.pages.find((q) => q.id === p.parentId)?.deletedAt,
            )
            .map((p) => (
              <div className="trash-row" key={p.id}>
                <PageIcon icon={p.icon} />
                <strong>{p.title}</strong>
                <button
                  className="subtle"
                  onClick={() => {
                    update((w) => trashPage(w, p.id, true));
                    notify("Page restored");
                  }}
                >
                  Restore
                </button>
              </div>
            ))}
          {!workspace.pages.some((p) => p.deletedAt) && (
            <EmptyState title="Trash is empty" />
          )}
        </Modal>
      )}
      {modal === "icon" && page && (
        <Modal title="Page icon" onClose={() => show(null)}>
          <div className="emoji-grid">
            {[
              "👋",
              "📝",
              "📖",
              "🗂️",
              "👜",
              "🏡",
              "🌱",
              "🎨",
              "☕",
              "✍️",
              "💡",
              "📅",
              "🎯",
              "🚀",
              "🧠",
              "🌤️",
              "✨",
              "🔖",
              "💻",
              "🛠️",
              "🎵",
              "📌",
              "🌊",
              "🍃",
              "📚",
              "✅",
              "💬",
              "🔬",
              "🧭",
              "🍋",
              "🦉",
              "🪴",
            ].map((icon) => (
              <button
                key={icon}
                aria-label={`Use ${icon} icon`}
                onClick={() => {
                  updatePage((p) => {
                    p.icon = icon;
                  });
                  show(null);
                }}
              >
                {icon}
              </button>
            ))}
          </div>
          <Field label="Custom emoji">
            <input
              maxLength={24}
              value={page.icon}
              onChange={(e) =>
                updatePage((p) => {
                  p.icon = e.target.value;
                })
              }
            />
          </Field>
          <button
            className="subtle"
            onClick={() => {
              updatePage((p) => {
                p.icon = "";
              });
              show(null);
            }}
          >
            Remove icon
          </button>
        </Modal>
      )}
      {modal === "cover" && page && (
        <Modal title="Page cover" onClose={() => show(null)}>
          <p className="muted">Choose a color, or upload a cover image.</p>
          <div className="cover-colors">
            {[
              "#d7e6df",
              "#dae3ef",
              "#e8dccc",
              "#eadde0",
              "#d9d1e3",
              "#363c3f",
              "#a9c1b0",
              "#bac7d7",
            ].map((color) => (
              <button
                key={color}
                aria-label={`Use ${color} cover`}
                style={{ backgroundColor: color }}
                onClick={() => {
                  updatePage((p) => {
                    p.cover = "color:" + color;
                  });
                  show(null);
                }}
              />
            ))}
          </div>
          <Field label="Upload cover">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const form = new FormData();
                form.set("file", f);
                try {
                  const r = await fetch("/api/uploads", {
                    method: "POST",
                    body: form,
                  });
                  const b = await r.json();
                  if (!r.ok || !b.image)
                    throw new Error(b.error || "Choose a supported image.");
                  updatePage((p) => {
                    p.cover = b.url;
                  });
                  show(null);
                } catch (e) {
                  notify(e instanceof Error ? e.message : "Upload failed");
                }
              }}
            />
          </Field>
          <button
            className="subtle"
            onClick={() => {
              updatePage((p) => {
                p.cover = null;
              });
              show(null);
            }}
          >
            Remove cover
          </button>
        </Modal>
      )}
      {modal === "templates" && (
        <Modal title="Make space for something new" onClose={() => show(null)}>
          <div className="template-grid">
            {[
              [
                "blank",
                "Blank page",
                "Start with a clean slate.",
                FileTextIcon,
              ],
              [
                "journal",
                "Daily journal",
                "A moment to reflect.",
                FileTextIcon,
              ],
              [
                "meeting",
                "Meeting notes",
                "Keep decisions and next steps.",
                FileTextIcon,
              ],
              [
                "projects",
                "Projects database",
                "Organize the work ahead.",
                DatabaseIcon,
              ],
            ].map(([id, title, description, Icon]) => {
              const I = Icon as typeof FileTextIcon;
              return (
                <button
                  key={id as string}
                  onClick={() => {
                    if (id === "blank") {
                      create();
                      return;
                    }
                    if (id === "projects") {
                      const seed = createSeed();
                      const db = seed.pages.find((p) => p.id === "projects")!;
                      const clone = { ...db, id: uid(), favorite: false };
                      update((w) => w.pages.push(clone));
                      open(clone.id);
                      return;
                    }
                    const p = newPage(title as string);
                    p.icon = id === "journal" ? "🌤️" : "💬";
                    p.content = {
                      type: "doc",
                      content: [
                        {
                          type: "heading",
                          attrs: { level: 2 },
                          content: [
                            {
                              type: "text",
                              text:
                                id === "journal"
                                  ? "What’s on my mind"
                                  : "Agenda",
                            },
                          ],
                        },
                        { type: "paragraph" },
                        {
                          type: "heading",
                          attrs: { level: 2 },
                          content: [
                            {
                              type: "text",
                              text:
                                id === "journal"
                                  ? "One thing I’m grateful for"
                                  : "Notes & decisions",
                            },
                          ],
                        },
                        { type: "paragraph" },
                        {
                          type: "heading",
                          attrs: { level: 2 },
                          content: [{ type: "text", text: "Next steps" }],
                        },
                        {
                          type: "taskList",
                          content: [
                            {
                              type: "taskItem",
                              attrs: { checked: false },
                              content: [{ type: "paragraph" }],
                            },
                          ],
                        },
                      ],
                    };
                    update((w) => w.pages.push(p));
                    open(p.id);
                  }}
                >
                  <I size={25} />
                  <strong>{title as string}</strong>
                  <span>{description as string}</span>
                </button>
              );
            })}
          </div>
          <button
            className="subtle"
            onClick={() => create(undefined, "database")}
          >
            <PlusIcon size={17} />
            Create empty database
          </button>
        </Modal>
      )}
      {modal === "move" && page && (
        <Modal title="Move page" onClose={() => show(null)}>
          <Field label="Destination">
            <select
              value={moveTarget}
              onChange={(e) => setMoveTarget(e.target.value)}
            >
              <option value="">Private (top level)</option>
              {workspace.pages
                .filter(
                  (p) =>
                    !p.deletedAt &&
                    p.id !== page.id &&
                    !descendants(workspace, page.id).includes(p.id),
                )
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.title}
                  </option>
                ))}
            </select>
          </Field>
          <button
            className="primary"
            onClick={() => {
              update((w) => movePage(w, page.id, moveTarget || null));
              show(null);
            }}
          >
            Move page
          </button>
        </Modal>
      )}
      {modal === "linkpage" && (
        <Modal title="Link to a page" onClose={() => show(null)}>
          <div className="search-results">
            {livePages(workspace)
              .filter((p) => p.id !== page?.id)
              .map((p) => (
                <button key={p.id} onClick={() => linkPage(p)}>
                  <PageIcon icon={p.icon} />
                  {p.title}
                </button>
              ))}
          </div>
        </Modal>
      )}
      {modal === "history" && page && (
        <Modal title="Version history" onClose={() => show(null)}>
          <p className="muted">
            Restore a document and its appearance. Live database properties,
            views, location, and sharing settings are preserved. Your current
            document stays in history after saving.
          </p>
          <div className="history-list">
            {history.map((h) => (
              <div key={h.id}>
                <div>
                  <strong>{new Date(h.createdAt).toLocaleString()}</strong>
                  <small>
                    {h.page.title} · {textOf(h.page.content).slice(0, 80)}
                  </small>
                </div>
                <button
                  className="subtle"
                  onClick={() => {
                    try {
                      update((w) => restorePageSnapshot(w, page.id, h.page));
                      show(null);
                      notify("Document version restored");
                    } catch (e) {
                      notify(
                        e instanceof Error
                          ? e.message
                          : "Could not restore this version",
                      );
                    }
                  }}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
          {!history.length && (
            <EmptyState
              title="No earlier versions yet"
              description="Versions appear after you save changes."
            />
          )}
        </Modal>
      )}
      {modal === "comments" && page && (
        <Modal title="Comments" onClose={() => show(null)}>
          <div className="comments-list">
            {page.comments.map((c) => (
              <article key={c.id}>
                <div>
                  <strong>You</strong>
                  <time>{new Date(c.createdAt).toLocaleString()}</time>
                </div>
                <p>{c.text}</p>
                <button
                  className="subtle"
                  onClick={() =>
                    updatePage((p) => {
                      p.comments = p.comments.filter((x) => x.id !== c.id);
                    })
                  }
                >
                  Delete
                </button>
              </article>
            ))}
          </div>
          {!page.comments.length && (
            <p className="muted">Leave a note for your future self.</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!comment.trim()) return;
              updatePage((p) =>
                p.comments.push({
                  id: uid(),
                  text: comment.trim(),
                  createdAt: now(),
                  blockId: null,
                }),
              );
              setComment("");
            }}
          >
            <textarea
              aria-label="Comment"
              rows={3}
              placeholder="Add a comment…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button className="primary" disabled={!comment.trim()}>
              Comment
            </button>
          </form>
        </Modal>
      )}
      {modal === "share" && page && (
        <Modal title="Share this page" onClose={() => show(null)}>
          <div className="publish-row">
            <div>
              <strong>Publish to the web</strong>
              <p className="muted">
                Anyone with the link can read this page. Child pages, database
                rows, comments, and workspace settings stay private.
              </p>
            </div>
            <input
              type="checkbox"
              aria-label="Publish page"
              checked={page.published}
              onChange={(e) =>
                updatePage((p) => {
                  p.published = e.target.checked;
                })
              }
            />
          </div>
          {page.published && (
            <>
              <Field label="Public page URL">
                <input
                  readOnly
                  value={window.location.origin + "/p/" + page.id}
                />
              </Field>
              <a
                className="subtle"
                href={"/p/" + page.id}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open published page
                <ArrowSquareOutIcon size={15} />
              </a>
            </>
          )}
          {page.kind === "database" && (
            <>
              <hr />
              <div className="publish-row">
                <div>
                  <strong>Public submission form</strong>
                  <p className="muted">
                    Anyone with the form link can submit a new row. Existing
                    rows aren’t shown.
                  </p>
                </div>
                <input
                  aria-label="Enable public form"
                  type="checkbox"
                  checked={page.formEnabled}
                  onChange={(e) =>
                    updatePage((p) => {
                      p.formEnabled = e.target.checked;
                    })
                  }
                />
              </div>
              {page.formEnabled && (
                <Field label="Form URL">
                  <input
                    readOnly
                    value={window.location.origin + "/f/" + page.id}
                  />
                </Field>
              )}
            </>
          )}
          <button
            className="subtle"
            onClick={() => {
              navigator.clipboard
                ?.writeText(
                  window.location.origin +
                    (page.published ? "/p/" : "/?page=") +
                    page.id,
                )
                .then(() => notify("Link copied"));
            }}
          >
            <LinkIcon size={16} />
            Copy {page.published ? "public" : "private"} link
          </button>
        </Modal>
      )}
      {modal === "drafts" && (
        <Modal title="Recover a device draft" onClose={() => show(null)}>
          <p>
            Each tab keeps its own unsaved copy. Recovering a draft lets you
            compare it with the server before saving. Other drafts stay
            available.
          </p>
          {store.drafts.map((d) => (
            <div className="publish-row" key={d.key}>
              <div>
                <strong>{d.data.name}</strong>
                <p className="muted">
                  {d.updatedAt
                    ? new Date(d.updatedAt).toLocaleString()
                    : "Previous session"}{" "}
                  · {d.data.pages.length} pages
                </p>
              </div>
              <button
                className="subtle"
                onClick={() =>
                  download(
                    "jotstead-recovered-draft.json",
                    workspaceExport(d.data),
                  )
                }
              >
                Export
              </button>
              <button
                className="primary"
                onClick={() => {
                  store.recoverDraft(d.key);
                  show("conflict");
                }}
              >
                Recover
              </button>
            </div>
          ))}
        </Modal>
      )}
      {modal === "conflict" && (
        <Modal title="Choose your workspace version" onClose={() => show(null)}>
          <p>
            Your local draft has {workspace.pages.length} pages. The server has{" "}
            {store.serverVersion?.data.pages.length ?? "unknown"} pages. Export
            your draft before choosing. Jotstead keeps both versions until you
            decide.
          </p>
          <button
            className="subtle"
            onClick={() =>
              download(
                "jotstead-conflict-draft.json",
                workspaceExport(workspace),
              )
            }
          >
            Export local draft
          </button>
          {!store.serverVersion && (
            <button className="subtle" onClick={() => void store.flush()}>
              Retry loading server version
            </button>
          )}
          <div className="conflict-options">
            <button
              disabled={!store.serverVersion}
              className="primary"
              onClick={() => {
                store.resolveConflict(false);
                show(null);
              }}
            >
              Use server version
            </button>
            <button
              className="subtle danger"
              disabled={!store.serverVersion}
              onClick={() => {
                store.resolveConflict(true);
                show(null);
              }}
            >
              Replace server with my draft
            </button>
          </div>
        </Modal>
      )}
      {modal === "ai" && (
        <Modal title="Ask Jotstead AI" onClose={() => show(null)}>
          {!aiAvailable ? (
            <>
              <div className="connection-status">No provider connected</div>
              <p>
                Connect your own AI provider or local Ollama server in the
                server configuration. Your notes remain fully usable without AI.
              </p>
              <button className="subtle" onClick={() => show("settings")}>
                Open settings
              </button>
            </>
          ) : (
            <>
              <p className="muted">
                For workspace questions, relevant page text is sent to your
                configured provider. Writing actions send the current page.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setAiBusy(true);
                  setAiResponse("");
                  try {
                    const r = await fetch("/api/ai", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        prompt: aiPrompt,
                        pageId: page?.id,
                        mode: aiMode,
                      }),
                    });
                    const b = await r.json();
                    if (!r.ok) throw new Error(b.error);
                    setAiResponse(b.text);
                    setAiSources(b.sources || []);
                  } catch (e) {
                    notify(e instanceof Error ? e.message : "AI failed");
                  } finally {
                    setAiBusy(false);
                  }
                }}
              >
                <Field label="Action">
                  <select
                    value={aiMode}
                    onChange={(e) => setAiMode(e.target.value)}
                  >
                    <option value="ask">Ask about my workspace</option>
                    <option value="rewrite">Rewrite this page</option>
                    <option value="summarize">Summarize this page</option>
                    <option value="translate">Translate this page</option>
                    <option value="tasks">Extract next steps</option>
                  </select>
                </Field>
                <textarea
                  autoFocus
                  required
                  aria-label="Ask AI"
                  rows={3}
                  placeholder="What would you like help with?"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                />
                <button
                  className="primary"
                  disabled={aiBusy || !aiPrompt.trim()}
                >
                  {aiBusy ? "Thinking…" : "Ask AI"}
                </button>
              </form>
              {aiResponse && (
                <>
                  <div className="ai-response">{aiResponse}</div>
                  <div className="ai-sources">
                    {aiSources.map((s) => (
                      <button
                        className="subtle"
                        key={s.id}
                        onClick={() => open(s.id)}
                      >
                        <LinkIcon size={14} />
                        {s.title}
                      </button>
                    ))}
                  </div>
                  <button
                    className="subtle"
                    onClick={() => {
                      editorRef.current
                        ?.chain()
                        .focus("end")
                        .insertContent({
                          type: "paragraph",
                          content: [{ type: "text", text: aiResponse }],
                        })
                        .run();
                      show(null);
                    }}
                  >
                    Append response to this page
                  </button>
                </>
              )}
            </>
          )}
        </Modal>
      )}
      {modal === "install" && (
        <Modal title="Install Jotstead" onClose={() => show(null)}>
          <img
            src="/icons/icon-192.png"
            alt="Jotstead icon"
            width={64}
            height={64}
          />
          <p>Desktop or Android: use Install app in your browser menu.</p>
          <p>
            iPhone or iPad: open Jotstead in Safari, tap Share, then Add to Home
            Screen.
          </p>
          <p className="muted">
            Installable apps require HTTPS or localhost. Your server must be
            running to sync across devices.
          </p>
        </Modal>
      )}
      {message && (
        <div role="status" className="toast">
          <CheckIcon size={17} />
          {message}
        </div>
      )}
    </div>
  );
}
