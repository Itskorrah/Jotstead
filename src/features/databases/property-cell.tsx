"use client";
import { useState, useEffect, useRef } from "react";
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
        <TagEditor property={property} value={value} onChange={onChange} />
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
        <DateEditor
          name={property.name}
          value={String(value ?? "")}
          display={labelOf(value, workspace, "date")}
          onChange={onChange}
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

function TagEditor({
  property,
  value,
  onChange,
}: {
  property: Property;
  value: Value;
  onChange: (v: Value) => void;
}) {
  const saved = Array.isArray(value) ? value.join(", ") : "";
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  const commit = () => {
    const next = [
      ...new Set(
        draft
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ];
    setDraft(next.join(", "));
    if (next.join(", ") !== saved) onChange(next);
  };
  return (
    <input
      className="cell-input"
      aria-label={property.name}
      placeholder="Empty"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setDraft(saved);
          e.stopPropagation();
        }
      }}
    />
  );
}
function DateEditor({
  name,
  value,
  display,
  onChange,
}: {
  name: string;
  value: string;
  display: string;
  onChange: (v: Value) => void;
}) {
  const [editing, setEditing] = useState(false);
  const committed = useRef(value);
  useEffect(() => {
    committed.current = value;
  }, [value]);
  const commit = (next: string) => {
    if (committed.current !== next) {
      committed.current = next;
      onChange(next);
    }
  };
  return editing ? (
    <input
      className="cell-input date"
      type="date"
      aria-label={name}
      autoFocus
      value={value}
      onChange={(e) => commit(e.target.value)}
      onInput={(e) => commit(e.currentTarget.value)}
      onBlur={(e) => {
        commit(e.currentTarget.value);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter") setEditing(false);
      }}
    />
  ) : (
    <button
      className="cell-date"
      aria-label={name}
      onClick={() => setEditing(true)}
    >
      {display || <span className="muted">Empty</span>}
    </button>
  );
}
