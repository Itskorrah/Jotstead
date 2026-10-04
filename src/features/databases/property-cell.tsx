"use client";
import {
  type Property,
  type Page,
  type Workspace,
  type Value,
} from "@/lib/model";
import { propertyValue, labelOf, tagColor } from "./query";
export function PropertyCell({
  property,
  row,
  db,
  workspace,
  onChange,
  readOnly = false,
}: {
  property: Property;
  row: Page;
  db: Page;
  workspace: Workspace;
  onChange: (v: Value) => void;
  readOnly?: boolean;
}) {
  const value = propertyValue(workspace, db, row, property.id);
  if (["formula", "rollup"].includes(property.type))
    return (
      <span
        className={`computed ${value === "#ERROR" ? "error-text" : ""}`}
        title={property.expression}
      >
        {String(value ?? "")}
      </span>
    );
  if (readOnly) return <span>{labelOf(value, workspace, property.type)}</span>;
  switch (property.type) {
    case "checkbox":
      return (
        <input
          className="cell-checkbox"
          type="checkbox"
          aria-label={property.name}
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case "select":
      return (
        <select
          aria-label={property.name}
          className={`cell-select tag-${tagColor(String(value))}`}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Empty</option>
          {property.options?.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      );
    case "multiSelect":
      return (
        <input
          className="cell-input"
          aria-label={property.name}
          placeholder="Empty"
          value={Array.isArray(value) ? value.join(", ") : ""}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            )
          }
          list={`options-${property.id}`}
        />
      );
    case "relation":
      return (
        <select
          aria-label={property.name}
          multiple
          className="cell-relation"
          value={Array.isArray(value) ? value : []}
          onChange={(e) =>
            onChange(Array.from(e.target.selectedOptions).map((o) => o.value))
          }
        >
          {workspace.pages
            .filter((p) => !p.deletedAt && p.parentId === property.targetId)
            .map((p) => (
              <option value={p.id} key={p.id}>
                {p.title}
              </option>
            ))}
        </select>
      );
    case "number":
      return (
        <input
          className="cell-input number"
          aria-label={property.name}
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
      );
    case "date":
      return (
        <input
          className="cell-input date"
          aria-label={property.name}
          type="date"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <input
          className="cell-input"
          aria-label={property.name}
          type={property.type === "url" ? "url" : "text"}
          placeholder="Empty"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
