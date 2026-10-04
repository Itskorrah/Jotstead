"use client";
import { useMemo, useState } from "react";
import {
  TableIcon,
  KanbanIcon,
  SquaresFourIcon,
  ListIcon,
  CalendarBlankIcon,
  ChartBarIcon,
  AlignLeftIcon,
  PlusIcon,
  FunnelIcon,
  SortAscendingIcon,
  MagnifyingGlassIcon,
  CaretLeftIcon,
  CaretRightIcon,
  GearSixIcon,
  DotsThreeIcon,
  TextAaIcon,
  HashIcon,
  CheckSquareIcon,
  LinkIcon,
  FunctionIcon,
  ArrowsLeftRightIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import {
  type Workspace,
  type Page,
  type View,
  type Property,
  type Value,
  newPage,
  now,
  makeView,
  uid,
  viewTypes,
  propertyTypes,
} from "@/lib/model";
import { queryRows, propertyValue, tagColor, labelOf, runRules } from "./query";
import { PropertyCell } from "./property-cell";
import {
  IconButton,
  Modal,
  Field,
  PageIcon,
  Menu,
  EmptyState,
  download,
} from "@/components/ui";
import { csvExport } from "@/lib/transfer";
const icons = {
  table: TableIcon,
  board: KanbanIcon,
  gallery: SquaresFourIcon,
  list: ListIcon,
  calendar: CalendarBlankIcon,
  timeline: AlignLeftIcon,
  chart: ChartBarIcon,
};
const propIcon = (type: Property["type"]) =>
  ({
    number: HashIcon,
    checkbox: CheckSquareIcon,
    url: LinkIcon,
    formula: FunctionIcon,
    relation: ArrowsLeftRightIcon,
    date: CalendarBlankIcon,
    select: ListIcon,
    multiSelect: ListIcon,
    rollup: FunctionIcon,
    text: TextAaIcon,
  })[type];
type Props = {
  page: Page;
  workspace: Workspace;
  update: (fn: (w: Workspace) => void) => void;
  onOpen: (id: string) => void;
};
export function Database({ page, workspace, update, onOpen }: Props) {
  const [viewId, setViewId] = useState(page.views[0]?.id);
  const view =
    page.views.find((v) => v.id === viewId) ||
    page.views[0] ||
    makeView("table");
  const [search, setSearch] = useState(""),
    [filters, setFilters] = useState(false),
    [sort, setSort] = useState(false),
    [viewMenu, setViewMenu] = useState(false),
    [newView, setNewView] = useState(false),
    [property, setProperty] = useState<Property | null>(null),
    [settings, setSettings] = useState(false);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const rows = useMemo(
    () => queryRows(workspace, page, view, search),
    [workspace, page, view, search],
  );
  const changeView = (fn: (v: View) => void) =>
    update((w) => {
      const v = w.pages
        .find((p) => p.id === page.id)!
        .views.find((v) => v.id === view.id)!;
      fn(v);
    });
  const cell = (row: Page, p: Property) => (
    <PropertyCell
      property={p}
      row={row}
      db={page}
      workspace={workspace}
      onChange={(v) =>
        update((w) => {
          const r = w.pages.find((p) => p.id === row.id)!;
          r.values[p.id] = v;
          r.updatedAt = now();
          runRules(w, r, p.id);
        })
      }
    />
  );
  const addRow = (values: Record<string, Value> = {}, open = false) => {
    const p = newPage("Untitled", page.id);
    p.values = values;
    update((w) => w.pages.push(p));
    if (open) onOpen(p.id);
  };
  const groupProp =
    page.properties.find((p) => p.id === view.groupBy) ||
    page.properties.find((p) => p.type === "select");
  const groups = [
    ...new Set([
      ...(groupProp?.options || []),
      ...rows.map((r) =>
        String(
          propertyValue(workspace, page, r, groupProp?.id || "") || "No status",
        ),
      ),
    ]),
  ];
  if (!groups.length) groups.push("All");
  const dateProp =
    page.properties.find(
      (p) => p.id === view.dateProperty && p.type === "date",
    ) || page.properties.find((p) => p.type === "date");
  const card = (row: Page) => (
    <button
      className="database-card"
      key={row.id}
      onClick={() => onOpen(row.id)}
      draggable
      onDragStart={(e) =>
        e.dataTransfer.setData("application/x-jotstead-row", row.id)
      }
    >
      {row.cover &&
        (row.cover.startsWith("color:") ? (
          <div
            className="card-cover"
            style={{ backgroundColor: row.cover.slice(6) }}
          />
        ) : (
          <img className="card-cover" src={row.cover} alt="" />
        ))}
      <div className="card-name">
        <PageIcon icon={row.icon} />
        <strong>{row.title || "Untitled"}</strong>
      </div>
      <div className="card-properties">
        {page.properties
          .filter((p) => ["select", "date", "multiSelect"].includes(p.type))
          .slice(0, 3)
          .map((p) => {
            const v = propertyValue(workspace, page, row, p.id);
            return v ? (
              <span
                key={p.id}
                className={
                  p.type === "select"
                    ? `tag tag-${tagColor(String(v))}`
                    : "card-meta"
                }
              >
                {labelOf(v, workspace, p.type)}
              </span>
            ) : null;
          })}
      </div>
    </button>
  );
  const nameOptions = (
    <>
      <option value="title">Name</option>
      {page.properties.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </>
  );
  return (
    <section className="database" aria-label={`${page.title} database`}>
      <div className="database-toolbar">
        <div className="view-tabs">
          {page.views.map((v) => {
            const I = icons[v.type];
            return (
              <button
                key={v.id}
                aria-current={v.id === view.id ? "page" : undefined}
                className={v.id === view.id ? "active" : ""}
                onClick={() => setViewId(v.id)}
              >
                <I size={16} />
                {v.name}
              </button>
            );
          })}
          <IconButton
            label="Add database view"
            onClick={() => setNewView(true)}
          >
            <PlusIcon size={17} />
          </IconButton>
        </div>
        <div className="database-tools">
          <IconButton
            label="Filter database"
            className={view.filters.length ? "blue" : ""}
            onClick={() => {
              setFilters((v) => !v);
              setSort(false);
            }}
          >
            <FunnelIcon size={17} />
          </IconButton>
          <IconButton
            label="Sort database"
            className={view.sort ? "blue" : ""}
            onClick={() => {
              setSort((v) => !v);
              setFilters(false);
            }}
          >
            <SortAscendingIcon size={17} />
          </IconButton>
          <div className="db-search">
            <MagnifyingGlassIcon size={17} />
            <input
              aria-label="Search database"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <IconButton
            label="Database settings"
            onClick={() => setSettings(true)}
          >
            <GearSixIcon size={17} />
          </IconButton>
          <div className="relative">
            <IconButton
              label="View actions"
              onClick={() => setViewMenu((v) => !v)}
            >
              <DotsThreeIcon size={20} />
            </IconButton>
            {viewMenu && (
              <Menu className="right" onClose={() => setViewMenu(false)}>
                <button
                  onClick={() => {
                    const v = {
                      ...structuredClone(view),
                      id: uid(),
                      name: view.name + " copy",
                    };
                    update((w) =>
                      w.pages.find((p) => p.id === page.id)!.views.push(v),
                    );
                    setViewId(v.id);
                    setViewMenu(false);
                  }}
                >
                  Duplicate view
                </button>
                <button
                  onClick={() => {
                    download(
                      page.title + ".csv",
                      csvExport(workspace, page),
                      "text/csv",
                    );
                    setViewMenu(false);
                  }}
                >
                  Export CSV
                </button>
                {page.views.length > 1 && (
                  <button
                    className="danger"
                    onClick={() => {
                      update((w) => {
                        const db = w.pages.find((p) => p.id === page.id)!;
                        db.views = db.views.filter((v) => v.id !== view.id);
                      });
                      setViewMenu(false);
                    }}
                  >
                    Delete view
                  </button>
                )}
              </Menu>
            )}
          </div>
          <button
            className="primary new-button"
            onClick={() => addRow({}, true)}
          >
            New
            <PlusIcon size={15} />
          </button>
        </div>
      </div>
      {filters && (
        <div className="database-config">
          <strong>Filters for {view.name}</strong>
          {view.filters.map((f, i) => (
            <div className="filter-row" key={i}>
              <select
                aria-label="Filter property"
                value={f.propertyId}
                onChange={(e) =>
                  changeView((v) => {
                    v.filters[i].propertyId = e.target.value;
                  })
                }
              >
                {nameOptions}
              </select>
              <select
                aria-label="Filter operator"
                value={f.operator}
                onChange={(e) =>
                  changeView((v) => {
                    v.filters[i].operator = e.target.value as typeof f.operator;
                  })
                }
              >
                {[
                  ["contains", "contains"],
                  ["equals", "is"],
                  ["not", "is not"],
                  ["empty", "is empty"],
                  ["before", "on or before"],
                  ["after", "on or after"],
                  ["gt", "greater than"],
                  ["lt", "less than"],
                ].map(([v, t]) => (
                  <option value={v} key={v}>
                    {t}
                  </option>
                ))}
              </select>
              {f.operator !== "empty" && (
                <input
                  aria-label="Filter value"
                  value={f.value}
                  onChange={(e) =>
                    changeView((v) => {
                      v.filters[i].value = e.target.value;
                    })
                  }
                />
              )}
              <IconButton
                label="Remove filter"
                onClick={() =>
                  changeView((v) => {
                    v.filters.splice(i, 1);
                  })
                }
              >
                <TrashIcon size={16} />
              </IconButton>
            </div>
          ))}
          <button
            className="subtle"
            onClick={() =>
              changeView((v) =>
                v.filters.push({
                  propertyId: groupProp?.id || "title",
                  operator: "equals",
                  value: "",
                }),
              )
            }
          >
            <PlusIcon size={14} />
            Add filter
          </button>
          <span className="muted">All filters must match.</span>
        </div>
      )}
      {sort && (
        <div className="database-config">
          <strong>Sort for {view.name}</strong>
          <div className="filter-row">
            <select
              aria-label="Sort property"
              value={view.sort?.propertyId || ""}
              onChange={(e) =>
                changeView((v) => {
                  v.sort = e.target.value
                    ? {
                        propertyId: e.target.value,
                        direction: v.sort?.direction || "asc",
                      }
                    : null;
                })
              }
            >
              <option value="">No sort</option>
              {nameOptions}
            </select>
            <select
              aria-label="Sort direction"
              value={view.sort?.direction || "asc"}
              onChange={(e) =>
                changeView((v) => {
                  if (v.sort) v.sort.direction = e.target.value as "asc";
                })
              }
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>
      )}
      {view.type === "table" && (
        <div className="table-scroll">
          <table className="db-table">
            <thead>
              <tr>
                <th className="name-column">
                  <TextAaIcon size={16} />
                  Name
                </th>
                {page.properties.map((p) => {
                  const I = propIcon(p.type);
                  return (
                    <th key={p.id}>
                      <button onClick={() => setProperty(p)}>
                        <I size={15} />
                        {p.name}
                      </button>
                    </th>
                  );
                })}
                <th>
                  <IconButton
                    label="Add property"
                    onClick={() =>
                      setProperty({
                        id: uid(),
                        name: "New property",
                        type: "text",
                      })
                    }
                  >
                    <PlusIcon size={17} />
                  </IconButton>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="name-cell">
                    <PageIcon icon={row.icon} />
                    <input
                      aria-label={`Name of ${row.title}`}
                      value={row.title}
                      placeholder="Untitled"
                      onChange={(e) =>
                        update((w) => {
                          const r = w.pages.find((p) => p.id === row.id)!;
                          r.title = e.target.value;
                          r.updatedAt = now();
                        })
                      }
                    />
                    <button
                      className="open-row"
                      aria-label={`Open ${row.title}`}
                      onClick={() => onOpen(row.id)}
                    >
                      Open
                    </button>
                  </td>
                  {page.properties.map((p) => (
                    <td key={p.id}>{cell(row, p)}</td>
                  ))}
                  <td>
                    <IconButton
                      label={`Open ${row.title} as page`}
                      onClick={() => onOpen(row.id)}
                    >
                      <DotsThreeIcon size={18} />
                    </IconButton>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={page.properties.length + 2}>
                  <button className="subtle" onClick={() => addRow()}>
                    <PlusIcon size={16} />
                    New page
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div className="db-footer">
            {rows.length} {rows.length === 1 ? "page" : "pages"}
          </div>
        </div>
      )}
      {view.type === "board" && (
        <div className="board">
          {groups.map((group) => (
            <div
              className="board-column"
              key={group}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("application/x-jotstead-row");
                if (id && groupProp)
                  update((w) => {
                    const row = w.pages.find(
                      (p) => p.id === id && p.parentId === page.id,
                    );
                    if (row) {
                      row.values[groupProp.id] =
                        group === "No status" ? null : group;
                      row.updatedAt = now();
                      runRules(w, row, groupProp.id);
                    }
                  });
              }}
            >
              <header>
                <span className={`tag tag-${tagColor(group)}`}>{group}</span>
                <span className="muted">
                  {
                    rows.filter(
                      (r) =>
                        String(
                          propertyValue(
                            workspace,
                            page,
                            r,
                            groupProp?.id || "",
                          ) || "No status",
                        ) === group,
                    ).length
                  }
                </span>
                <IconButton
                  label={`Add page to ${group}`}
                  onClick={() =>
                    addRow(
                      groupProp
                        ? {
                            [groupProp.id]:
                              group === "No status" ? null : group,
                          }
                        : {},
                      true,
                    )
                  }
                >
                  <PlusIcon size={16} />
                </IconButton>
              </header>
              {rows
                .filter(
                  (r) =>
                    String(
                      propertyValue(workspace, page, r, groupProp?.id || "") ||
                        "No status",
                    ) === group,
                )
                .map(card)}
              <button
                className="subtle"
                onClick={() =>
                  addRow(
                    groupProp
                      ? { [groupProp.id]: group === "No status" ? null : group }
                      : {},
                    true,
                  )
                }
              >
                <PlusIcon size={16} />
                New
              </button>
            </div>
          ))}
        </div>
      )}
      {view.type === "gallery" && (
        <div className="gallery">
          {rows.map(card)}
          <button className="gallery-add" onClick={() => addRow({}, true)}>
            <PlusIcon size={20} />
            New page
          </button>
        </div>
      )}
      {view.type === "list" && (
        <div className="database-list">
          {rows.map((row) => (
            <div className="database-list-row" key={row.id}>
              <button onClick={() => onOpen(row.id)}>
                <PageIcon icon={row.icon} />
                <strong>{row.title}</strong>
              </button>
              {page.properties.slice(0, 3).map((p) => (
                <div key={p.id}>{cell(row, p)}</div>
              ))}
            </div>
          ))}
          <button className="subtle" onClick={() => addRow({}, true)}>
            <PlusIcon size={16} />
            New page
          </button>
        </div>
      )}
      {(view.type === "calendar" || view.type === "timeline") && (
        <>
          <div className="calendar-header">
            <strong>
              {month.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </strong>
            <span />
            {dateProp ? (
              <span className="muted">{dateProp.name}</span>
            ) : (
              <span className="muted">
                Add a Date property to schedule pages
              </span>
            )}
            <button
              className="subtle"
              onClick={() =>
                setMonth(
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                )
              }
            >
              Today
            </button>
            <IconButton
              label="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              <CaretLeftIcon size={16} />
            </IconButton>
            <IconButton
              label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              <CaretRightIcon size={16} />
            </IconButton>
          </div>
          {view.type === "calendar" ? (
            <div className="calendar-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div className="day-heading" key={d}>
                  {d}
                </div>
              ))}
              {Array.from({ length: 42 }, (_, i) => {
                const d = new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  i - month.getDay() + 1,
                );
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                return (
                  <div
                    className={`calendar-day ${d.getMonth() !== month.getMonth() ? "outside" : ""}`}
                    key={key}
                  >
                    <div className="day-number">
                      {d.getDate()}
                      <IconButton
                        label={`Add page on ${key}`}
                        disabled={!dateProp}
                        onClick={() => addRow({ [dateProp!.id]: key }, true)}
                      >
                        <PlusIcon size={12} />
                      </IconButton>
                    </div>
                    {rows
                      .filter((r) => dateProp && r.values[dateProp.id] === key)
                      .map((r) => (
                        <button
                          className="calendar-item"
                          key={r.id}
                          onClick={() => onOpen(r.id)}
                        >
                          <PageIcon icon={r.icon} size={13} />
                          {r.title}
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="timeline-scroll">
              <div
                className="timeline-grid"
                style={{
                  gridTemplateColumns: `220px repeat(${new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()},28px)`,
                }}
              >
                <div className="timeline-title">Name</div>
                {Array.from(
                  {
                    length: new Date(
                      month.getFullYear(),
                      month.getMonth() + 1,
                      0,
                    ).getDate(),
                  },
                  (_, i) => (
                    <div className="timeline-date" key={i}>
                      {i + 1}
                    </div>
                  ),
                )}
                {rows.map((r, i) => {
                  const date = String(
                    dateProp ? r.values[dateProp.id] || "" : "",
                  );
                  const d = date ? new Date(date + "T12:00:00") : null;
                  const visible =
                    d &&
                    d.getMonth() === month.getMonth() &&
                    d.getFullYear() === month.getFullYear();
                  return (
                    <div
                      className="timeline-row"
                      key={r.id}
                      style={{ gridRow: i + 2, gridColumn: "1 / -1" }}
                    >
                      <button onClick={() => onOpen(r.id)}>
                        <PageIcon icon={r.icon} />
                        {r.title}
                      </button>
                      <div className="timeline-track">
                        {visible && (
                          <button
                            className={`timeline-bar tag-${tagColor(String(r.values[groupProp?.id || ""]))}`}
                            style={{ left: (d!.getDate() - 1) * 28, width: 28 }}
                            onClick={() => onOpen(r.id)}
                            title={`${r.title}: ${date}`}
                            aria-label={`${r.title}, ${date}`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="muted">
                Dates mark one-day milestones. Open a page to change its date.
              </p>
            </div>
          )}
        </>
      )}
      {view.type === "chart" && (
        <div className="chart">
          <h3>Pages by {groupProp?.name || "status"}</h3>
          <div
            role="img"
            aria-label={groups
              .map(
                (g) =>
                  `${g}: ${rows.filter((r) => String(propertyValue(workspace, page, r, groupProp?.id || "") || "No status") === g).length}`,
              )
              .join(", ")}
          >
            {groups.map((g) => {
              const count = rows.filter(
                (r) =>
                  String(
                    propertyValue(workspace, page, r, groupProp?.id || "") ||
                      "No status",
                  ) === g,
              ).length;
              return (
                <div className="chart-row" key={g}>
                  <span>{g}</span>
                  <div className="chart-track">
                    <div
                      className={`chart-bar tag-${tagColor(g)}`}
                      style={{
                        width: `${(count / Math.max(rows.length, 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
          <p className="muted">{rows.length} pages in this view</p>
        </div>
      )}
      {!rows.length &&
        !["calendar", "timeline", "table"].includes(view.type) && (
          <EmptyState
            title="No pages match this view"
            description="Try changing your filters, or add a page."
          />
        )}
      {newView && (
        <Modal title="Add a view" onClose={() => setNewView(false)}>
          <div className="layout-options">
            {viewTypes.map((t) => {
              const I = icons[t];
              return (
                <button
                  key={t}
                  onClick={() => {
                    const v = {
                      ...makeView(t),
                      groupBy: groupProp?.id || null,
                      dateProperty: dateProp?.id || null,
                    };
                    update((w) =>
                      w.pages.find((p) => p.id === page.id)!.views.push(v),
                    );
                    setViewId(v.id);
                    setNewView(false);
                  }}
                >
                  <I size={25} />
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              );
            })}
          </div>
        </Modal>
      )}
      {settings && (
        <Modal title="View settings" onClose={() => setSettings(false)}>
          <Field label="View name">
            <input
              value={view.name}
              onChange={(e) =>
                changeView((v) => {
                  v.name = e.target.value;
                })
              }
            />
          </Field>
          <Field label="Group by">
            <select
              value={view.groupBy || ""}
              onChange={(e) =>
                changeView((v) => {
                  v.groupBy = e.target.value || null;
                })
              }
            >
              <option value="">Default</option>
              {page.properties
                .filter((p) => p.type === "select")
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Date property">
            <select
              value={view.dateProperty || ""}
              onChange={(e) =>
                changeView((v) => {
                  v.dateProperty = e.target.value || null;
                })
              }
            >
              <option value="">Default</option>
              {page.properties
                .filter((p) => p.type === "date")
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
          <button
            className="subtle"
            onClick={() => {
              setSettings(false);
              setProperty({ id: uid(), name: "New property", type: "text" });
            }}
          >
            <PlusIcon size={16} />
            Add a property
          </button>
        </Modal>
      )}
      {property && (
        <PropertySettings
          property={property}
          page={page}
          workspace={workspace}
          onClose={() => setProperty(null)}
          onSave={(next) => {
            update((w) => {
              const db = w.pages.find((p) => p.id === page.id)!;
              const i = db.properties.findIndex((p) => p.id === next.id);
              if (i === -1) db.properties.push(next);
              else {
                if (db.properties[i].type !== next.type)
                  for (const row of w.pages.filter((r) => r.parentId === db.id))
                    row.values[next.id] = null;
                db.properties[i] = next;
              }
            });
            setProperty(null);
          }}
          onDelete={() => {
            update((w) => {
              const db = w.pages.find((p) => p.id === page.id)!;
              db.properties = db.properties.filter((p) => p.id !== property.id);
              for (const row of w.pages.filter((r) => r.parentId === db.id))
                delete row.values[property.id];
              for (const v of db.views) {
                v.filters = v.filters.filter(
                  (f) => f.propertyId !== property.id,
                );
                if (v.sort?.propertyId === property.id) v.sort = null;
                if (v.groupBy === property.id) v.groupBy = null;
                if (v.dateProperty === property.id) v.dateProperty = null;
              }
            });
            setProperty(null);
          }}
        />
      )}
    </section>
  );
}
function PropertySettings({
  property,
  page,
  workspace,
  onClose,
  onSave,
  onDelete,
}: {
  property: Property;
  page: Page;
  workspace: Workspace;
  onClose: () => void;
  onSave: (p: Property) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(property);
  const existing = page.properties.some((p) => p.id === property.id);
  const relations = page.properties.filter((p) => p.type === "relation");
  const target = workspace.pages.find(
    (p) =>
      p.id === page.properties.find((p) => p.id === draft.relationId)?.targetId,
  );
  return (
    <Modal
      title={existing ? "Edit property" : "Add property"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
      >
        <Field label="Property name">
          <input
            autoFocus
            required
            maxLength={80}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </Field>
        <Field label="Property type">
          <select
            value={draft.type}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                type: e.target.value as Property["type"],
              }))
            }
          >
            {propertyTypes.map((t) => (
              <option key={t} value={t}>
                {t === "multiSelect"
                  ? "Multi-select"
                  : t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        {["select", "multiSelect"].includes(draft.type) && (
          <Field label="Options (comma separated)">
            <input
              value={draft.options?.join(", ") || ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  options: e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                }))
              }
            />
          </Field>
        )}
        {draft.type === "formula" && (
          <>
            <Field label="Formula">
              <textarea
                value={draft.expression || ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, expression: e.target.value }))
                }
                placeholder={'prop("Effort") * 2'}
              />
            </Field>
            <p className="muted">
              Arithmetic, comparisons, prop, if, concat, round, length, empty,
              lower, upper, contains. Unsupported expressions show #ERROR.
            </p>
          </>
        )}
        {draft.type === "relation" && (
          <Field label="Related database">
            <select
              required
              value={draft.targetId || ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, targetId: e.target.value }))
              }
            >
              <option value="">Choose database</option>
              {workspace.pages
                .filter((p) => p.kind === "database" && !p.deletedAt)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {draft.type === "rollup" && (
          <>
            <Field label="Relation">
              <select
                required
                value={draft.relationId || ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, relationId: e.target.value }))
                }
              >
                <option value="">Choose relation</option>
                {relations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Related property">
              <select
                value={draft.rollupId || ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, rollupId: e.target.value }))
                }
              >
                <option value="">Choose property</option>
                {target?.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Calculate">
              <select
                value={draft.aggregate || "count"}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    aggregate: e.target.value as "count",
                  }))
                }
              >
                <option value="count">Count pages</option>
                <option value="sum">Sum</option>
                <option value="average">Average</option>
              </select>
            </Field>
          </>
        )}
        <div className="modal-actions">
          {existing && (
            <button type="button" className="danger subtle" onClick={onDelete}>
              Delete property
            </button>
          )}
          <button className="primary" disabled={!draft.name.trim()}>
            Save property
          </button>
        </div>
      </form>
    </Modal>
  );
}
