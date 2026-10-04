"use client";
import dynamic from "next/dynamic";
import type { publishedPage } from "@/lib/public";
import { PageIcon } from "./ui";
const PageEditor = dynamic(
  () => import("@/features/editor/editor").then((m) => m.PageEditor),
  { ssr: false },
);
export function PublicPage({
  page,
}: {
  page: ReturnType<typeof publishedPage>;
}) {
  return (
    <>
      <header className="public-header">
        <a href="/" aria-label="Jotstead">
          <img src="/icons/favicon-32.png" width={23} height={23} alt="" />
          Jotstead
        </a>
        <small>Published page</small>
      </header>
      <main className="public-content">
        {page.cover && (
          <div
            className="page-cover"
            style={
              page.cover.startsWith("color:")
                ? { backgroundColor: page.cover.slice(6) }
                : undefined
            }
          >
            {!page.cover.startsWith("color:") && (
              <img src={page.cover} alt="Page cover" />
            )}
          </div>
        )}
        <article
          className={`page ${page.fullWidth ? "full-width" : ""} ${page.smallText ? "small-text" : ""} ${page.cover ? "with-cover" : ""} ${page.icon ? "with-icon" : ""} font-${page.font}`}
        >
          {page.icon && (
            <div className="page-icon">
              <PageIcon icon={page.icon} size={72} />
            </div>
          )}
          <h1 className="page-title">{page.title || "Untitled"}</h1>
          <PageEditor content={page.content} readOnly />
        </article>
      </main>
    </>
  );
}
