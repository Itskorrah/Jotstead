import { getStore } from "@/lib/store";
import { PublicForm } from "@/components/public-form";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const page = getStore()
    .read()
    .data.pages.find(
      (p) =>
        p.id === id && p.kind === "database" && p.formEnabled && !p.deletedAt,
    );
  if (!page) notFound();
  return (
    <PublicForm
      id={page.id}
      title={page.title}
      icon={page.icon}
      properties={page.properties
        .filter((p) => !["relation", "formula", "rollup"].includes(p.type))
        .map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          options: p.options,
        }))}
    />
  );
}
