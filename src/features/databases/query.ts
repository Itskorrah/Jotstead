import {
  type Workspace,
  type Page,
  type View,
  type Value,
  type Filter,
} from "@/lib/model";
import { evaluateFormula } from "./formula";
export function propertyValue(
  w: Workspace,
  db: Page,
  row: Page,
  id: string,
  visited = new Set<string>(),
): Value {
  if (id === "title") return row.title;
  const key = `${row.id}:${id}`;
  if (visited.has(key)) return "#ERROR";
  const next = new Set(visited).add(key);
  const property = db.properties.find((p) => p.id === id);
  if (!property) return row.values[id] ?? null;
  if (property.type === "formula")
    return evaluateFormula(property.expression || "", (name) => {
      const p = db.properties.find((p) => p.name === name || p.id === name);
      return p
        ? propertyValue(w, db, row, p.id, next)
        : name === "Name"
          ? row.title
          : null;
    });
  if (property.type === "rollup") {
    const related = row.values[property.relationId || ""];
    if (!Array.isArray(related)) return null;
    const rows = w.pages.filter((p) => related.includes(p.id) && !p.deletedAt);
    if (property.aggregate === "count") return rows.length;
    const values = rows.map((r) => {
      const target = w.pages.find((d) => d.id === r.parentId);
      return target
        ? propertyValue(w, target, r, property.rollupId || "", next)
        : null;
    });
    if (values.includes("#ERROR")) return "#ERROR";
    const numbers = values.filter((v): v is number => typeof v === "number");
    const sum = numbers.reduce((a, b) => a + b, 0);
    return property.aggregate === "average"
      ? numbers.length
        ? sum / numbers.length
        : null
      : sum;
  }
  return row.values[id] ?? null;
}
export function matchesFilter(value: Value, filter: Filter) {
  const t = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  switch (filter.operator) {
    case "empty":
      return value == null || t === "";
    case "equals":
      return t.toLowerCase() === filter.value.toLowerCase();
    case "not":
      return t.toLowerCase() !== filter.value.toLowerCase();
    case "contains":
      return t.toLowerCase().includes(filter.value.toLowerCase());
    case "before":
      return t !== "" && t <= filter.value;
    case "after":
      return t !== "" && t >= filter.value;
    case "gt":
      return value != null && Number(value) > Number(filter.value);
    case "lt":
      return value != null && Number(value) < Number(filter.value);
  }
}
export function queryRows(
  w: Workspace,
  db: Page,
  view: View,
  search = "",
): Page[] {
  const rows = w.pages.filter(
    (p) =>
      p.parentId === db.id &&
      !p.deletedAt &&
      view.filters.every((f) =>
        matchesFilter(propertyValue(w, db, p, f.propertyId), f),
      ) &&
      (!search ||
        [
          p.title,
          ...Object.values(p.values).map((v) =>
            Array.isArray(v) ? v.join(" ") : String(v ?? ""),
          ),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  if (view.sort) {
    const { propertyId, direction } = view.sort;
    rows.sort((a, b) => {
      const x = propertyValue(w, db, a, propertyId),
        y = propertyValue(w, db, b, propertyId);
      if (x == null || x === "") return y == null || y === "" ? 0 : 1;
      if (y == null || y === "") return -1;
      const order =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), undefined, { numeric: true });
      return direction === "desc" ? -order : order;
    });
  }
  return rows;
}
export function runRules(w: Workspace, row: Page, changedProperty: string) {
  for (const rule of w.rules) {
    if (
      rule.enabled &&
      rule.databaseId === row.parentId &&
      rule.whenProperty === changedProperty &&
      String(row.values[changedProperty]) === rule.whenValue
    ) {
      const target = w.pages
        .find((p) => p.id === rule.databaseId)
        ?.properties.find((p) => p.id === rule.setProperty);
      if (
        !target ||
        ["relation", "formula", "rollup", "multiSelect"].includes(target.type)
      )
        continue;
      const value = rule.setValue;
      const valid =
        value === null ||
        (target.type === "number"
          ? typeof value === "number" && Number.isFinite(value)
          : target.type === "checkbox"
            ? typeof value === "boolean"
            : typeof value === "string");
      if (
        valid &&
        (target.type !== "date" ||
          value === null ||
          value === "" ||
          /^\d{4}-\d{2}-\d{2}$/.test(String(value)))
      )
        row.values[rule.setProperty] = value;
    }
  }
}
export function labelOf(value: Value, w: Workspace, type?: string) {
  return Array.isArray(value)
    ? value
        .map((v) =>
          type === "relation"
            ? w.pages.find((p) => p.id === v)?.title || "Missing page"
            : v,
        )
        .join(", ")
    : String(value ?? "");
}
export const tagColor = (value: string) =>
  ({
    Done: "green",
    "In progress": "blue",
    "Not started": "gray",
    High: "red",
    Medium: "yellow",
    Low: "gray",
    Design: "purple",
    Writing: "pink",
    Personal: "orange",
  })[value] || ["gray", "blue", "purple", "green", "orange"][value.length % 5];
