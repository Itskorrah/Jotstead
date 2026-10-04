import { it, expect } from "vitest";
import {
  queryRows,
  propertyValue,
  runRules,
} from "../src/features/databases/query";
import { evaluateFormula } from "../src/features/databases/formula";
import { createSeed } from "../src/lib/seed";
it("sorts numbers numerically and filters dates inclusively", () => {
  const w = createSeed(),
    db = w.pages.find((p) => p.id === "projects")!,
    view = structuredClone(db.views[0]);
  w.pages.find((p) => p.id === "task-1")!.values.effort = 20;
  view.sort = { propertyId: "effort", direction: "asc" };
  expect(queryRows(w, db, view)[0].id).toBe("task-2");
  view.filters = [
    { propertyId: "date", operator: "after", value: "2026-10-07" },
  ];
  expect(queryRows(w, db, view).map((r) => r.id)).toEqual([
    "task-3",
    "task-4",
    "task-5",
    "task-6",
  ]);
});
it("evaluates a bounded formula language without executing code", () => {
  expect(
    evaluateFormula('prop("Effort") * 2 + 1', (n) =>
      n === "Effort" ? 3 : null,
    ),
  ).toBe(7);
  expect(evaluateFormula("globalThis.process.exit()", () => null)).toBe(
    "#ERROR",
  );
  expect(evaluateFormula("1 / 0", () => null)).toBe("#ERROR");
});
it("computes relation rollups and catches cyclic formulas", () => {
  const w = createSeed(),
    db = w.pages.find((p) => p.id === "projects")!,
    row = w.pages.find((p) => p.id === "task-1")!;
  db.properties.push(
    { id: "related", name: "Related", type: "relation", targetId: "projects" },
    {
      id: "rollup",
      name: "Total",
      type: "rollup",
      relationId: "related",
      rollupId: "effort",
      aggregate: "sum",
    },
    {
      id: "cycle",
      name: "Cycle",
      type: "formula",
      expression: 'prop("Cycle")',
    },
  );
  row.values.related = ["task-2", "task-3"];
  expect(propertyValue(w, db, row, "rollup")).toBe(5);
  expect(propertyValue(w, db, row, "cycle")).toBe("#ERROR");
});

it("runs typed edit-triggered rules once without cascading", () => {
  const w = createSeed(),
    row = w.pages.find((p) => p.id === "task-1")!;
  w.rules.push({
    id: "complete-on-done",
    name: "Complete on done",
    databaseId: "projects",
    whenProperty: "status",
    whenValue: "Done",
    setProperty: "complete",
    setValue: true,
    enabled: true,
  });
  row.values.status = "Done";
  runRules(w, row, "status");
  expect(row.values.complete).toBe(true);
  row.values.status = "Not started";
  row.values.complete = false;
  runRules(w, row, "priority");
  expect(row.values.complete).toBe(false);
});
