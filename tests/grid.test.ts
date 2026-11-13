import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { adjust, type Grid, overlaps, parseGrid, placementError, serializeGrid } from "../src/grid";
import { replaceGridBlock } from "../src/note";

const grid: Grid = {
  id: "example",
  rows: ["One", "", "Three", "Four"],
  columns: [{ label: "A", note: "First column" }, { label: "B" }, { label: "C" }],
  cards: [
    { id: "first", title: "First", color: "purple", row: 1, column: 1, rowSpan: 2, columnSpan: 2 },
    { id: "second", title: "Second", color: "orange", row: 3, column: 2, rowSpan: 1, columnSpan: 1 },
  ],
};
const source = serializeGrid(grid);
const fence = (body = source) => ["```grid", body, "```"].join("\n");

function replace(note: string, expected = source, replacement = "{}"): string {
  const change = replaceGridBlock(note, grid.id, expected, replacement);
  return note.slice(0, change.from) + change.text + note.slice(change.to);
}

void test("grid serialization preserves labels, notes and position", () => {
  assert.equal(serializeGrid(parseGrid(source)), source);
  assert.throws(() => parseGrid("not JSON"), /valid JSON/);
});

void test("moving a card preserves its span and rejects collisions", () => {
  const first = grid.cards[0];
  const moved = adjust(first, 1, 0);
  assert.deepEqual(moved, { row: 2, column: 1, rowSpan: 2, columnSpan: 2 });
  assert.match(placementError(grid, moved, first.id) ?? "", /overlaps “Second”/);
  assert.equal(overlaps(first, grid.cards[1]), false);
  assert.equal(placementError(grid, adjust(first, 0, 1), first.id), undefined);
  assert.match(placementError(grid, adjust(first, 0, 2), first.id) ?? "", /inside/);
});

void test("every edge adjusts its own axis and keeps the opposite edge fixed", () => {
  const first = grid.cards[0];
  assert.deepEqual(adjust(first, 1, 0, "top"), { row: 2, column: 1, rowSpan: 1, columnSpan: 2 });
  assert.deepEqual(adjust(first, 0, 1, "left"), { row: 1, column: 2, rowSpan: 2, columnSpan: 1 });
  assert.deepEqual(adjust(first, 1, 0, "bottom"), { row: 1, column: 1, rowSpan: 3, columnSpan: 2 });
  assert.deepEqual(adjust(first, 0, 1, "right"), { row: 1, column: 1, rowSpan: 2, columnSpan: 3 });
  assert.match(placementError(grid, adjust(first, 2, 0, "top"), first.id) ?? "", /inside/);
});

void test("parsing rejects duplicate IDs, occupied cells and fractional spans", () => {
  const first = grid.cards[0];
  const second = grid.cards[1];
  for (const [override, error] of [
    [{ id: first.id }, /unique ID/],
    [{ row: 2 }, /overlaps/],
    [{ rowSpan: 0.5 }, /inside/],
    [{ column: 4 }, /inside/],
    [{ color: "pink" }, /color/],
  ] as const) {
    assert.throws(() => parseGrid(JSON.stringify({ ...grid, cards: [first, { ...second, ...override }] })), error);
  }
});

void test("write-back preserves CRLF, delimiters, adjacent grids and unrelated note edits", () => {
  const other = fence(source.replace('"example"', '"other"'));
  const note = ["# 🗓️ Edited heading", "", other, "", fence(), "", "Keep this too."].join("\n").replaceAll("\n", "\r\n");
  assert.equal(replace(note), note.replace(source.replaceAll("\n", "\r\n"), "{}"));
});

void test("write-back rejects concurrent edits, duplicate grids and open fences", () => {
  assert.throws(() => replace(fence(source.replace('"One"', '"Changed"'))), /changed/);
  assert.throws(() => replace(fence() + "\n\n" + fence()), /unique/);
  assert.throws(() => replace(fence().slice(0, -3)), /changed/);
  assert.throws(() => replace("No grid here"), /changed/);
});

void test("write-back ignores fenced examples and YAML frontmatter", () => {
  const decoys = [
    ["````md", fence(), "````"].join("\n"),
  ];
  const frontmatter = ["---", "value: |", fence().split("\n").map(line => "  " + line).join("\n"), "---"].join("\n");
  const actual = ["  ~~~~grid", source.split("\n").map(line => "  " + line).join("\n"), "  ~~~~"].join("\n");
  const prefix = [frontmatter, ...decoys, ""].join("\n\n");
  assert.equal(replace(prefix + actual), prefix + "  ~~~~grid\n  {}\n  ~~~~");
});

void test("both demo notes are valid and the Milwaukee fixture has 15-minute rows", () => {
  for (const name of ["Milwaukee weekend", "Workshop layout"]) {
    const note = readFileSync(`test-vault/${name}.md`, "utf8");
    const fixture = parseGrid(note.split("```grid\n")[1].split("\n```")[0]);
    if (name === "Milwaukee weekend") {
      assert.deepEqual(fixture.columns.map(column => column.label), ["Saturday", "Sunday"]);
      assert.ok(fixture.rows.every((label, index) => Boolean(label) === (index % 4 === 0)));
    } else {
      assert.ok(fixture.cards.some(card => card.rowSpan > 1 && card.columnSpan > 1));
    }
  }
});

void test("write-back rejects nested grids even if their source matches a top-level grid", () => {
  const nested = fence().split("\n").map(line => "> " + line).join("\n");
  assert.throws(() => replace(nested), /changed/);
  assert.throws(() => replace(nested + "\n\n" + fence()), /unique/);
});
