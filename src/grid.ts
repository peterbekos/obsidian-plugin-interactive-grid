export const colors = ["default", "red", "orange", "yellow", "green", "cyan", "blue", "purple", "magenta"] as const;
export type Color = (typeof colors)[number];

export interface Rect {
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
}

export interface Card extends Rect {
  id: string;
  title: string;
  details?: string;
  color: Color;
}

export interface Column {
  label: string;
  note?: string;
}

export interface Grid {
  id: string;
  rows: string[];
  columns: Column[];
  cards: Card[];
}

export type Edge = "top" | "right" | "bottom" | "left";

export function overlaps(a: Rect, b: Rect): boolean {
  return a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan &&
    a.column < b.column + b.columnSpan && b.column < a.column + a.columnSpan;
}

export function placementError(grid: Grid, rect: Rect, ignoreId?: string): string | undefined {
  const { row, column, rowSpan, columnSpan } = rect;
  if (![row, column, rowSpan, columnSpan].every(Number.isSafeInteger) ||
      row < 1 || column < 1 || rowSpan < 1 || columnSpan < 1 ||
      row + rowSpan - 1 > grid.rows.length || column + columnSpan - 1 > grid.columns.length) {
    return "The card must fit inside the grid.";
  }
  const neighbor = grid.cards.find(card => card.id !== ignoreId && overlaps(rect, card));
  if (neighbor) return `The card overlaps “${neighbor.title}”.`;
}

export function adjust(rect: Rect, rows: number, columns: number, edge?: Edge): Rect {
  const { row, column, rowSpan, columnSpan } = rect;
  switch (edge) {
    case "top": return { row: row + rows, column, rowSpan: rowSpan - rows, columnSpan };
    case "left": return { row, column: column + columns, rowSpan, columnSpan: columnSpan - columns };
    case "bottom": return { row, column, rowSpan: rowSpan + rows, columnSpan };
    case "right": return { row, column, rowSpan, columnSpan: columnSpan + columns };
    default: return { row: row + rows, column: column + columns, rowSpan, columnSpan };
  }
}

export function sameRect(a: Rect, b: Rect): boolean {
  return a.row === b.row && a.column === b.column &&
    a.rowSpan === b.rowSpan && a.columnSpan === b.columnSpan;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function id(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}

function color(value: unknown): value is Color {
  return colors.some(option => option === value);
}

export function parseGrid(source: string): Grid {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    throw new Error("The grid must contain valid JSON.");
  }
  if (!record(data) || !id(data.id)) {
    throw new Error("Give the grid an ID using letters, numbers, hyphens or underscores.");
  }
  const { rows, columns, cards } = data;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 500 ||
      !rows.every((row: unknown) => typeof row === "string")) {
    throw new Error("Provide 1 to 500 row labels. Use empty strings for unlabeled rows.");
  }
  const parsedColumns: Column[] = [];
  if (!Array.isArray(columns) || columns.length < 1 || columns.length > 50) {
    throw new Error("Provide 1 to 50 columns.");
  }
  for (const column of columns as unknown[]) {
    if (!record(column) || typeof column.label !== "string" ||
        (column.note !== undefined && typeof column.note !== "string")) {
      throw new Error("Each column needs a text label and may have a text note.");
    }
    parsedColumns.push({ ...column, label: column.label, note: column.note });
  }
  if (!Array.isArray(cards)) throw new Error("Provide a cards array, which may be empty.");
  const grid: Grid = { ...data, id: data.id, rows, columns: parsedColumns, cards: [] };
  const occupied = new Set<number>();
  const ids = new Set<string>();
  for (const card of cards as unknown[]) {
    if (!record(card) || !id(card.id) || ids.has(card.id) ||
        typeof card.title !== "string" || !card.title.trim() || !color(card.color) ||
        (card.details !== undefined && typeof card.details !== "string") ||
        typeof card.row !== "number" || typeof card.column !== "number" ||
        typeof card.rowSpan !== "number" || typeof card.columnSpan !== "number") {
      throw new Error("Each card needs a unique ID, title, color, and four integer position fields.");
    }
    const parsed: Card = {
      ...card, id: card.id, title: card.title, color: card.color, details: card.details,
      row: card.row, column: card.column, rowSpan: card.rowSpan, columnSpan: card.columnSpan,
    };
    const bounds = placementError({ ...grid, cards: [] }, parsed);
    if (bounds) throw new Error(`“${parsed.title}”: ${bounds}`);
    for (let row = parsed.row; row < parsed.row + parsed.rowSpan; row++) {
      for (let column = parsed.column; column < parsed.column + parsed.columnSpan; column++) {
        const cell = (row - 1) * columns.length + column - 1;
        if (occupied.has(cell)) throw new Error(`“${parsed.title}” overlaps another card.`);
        occupied.add(cell);
      }
    }
    ids.add(parsed.id);
    grid.cards.push(parsed);
  }
  return grid;
}

export function serializeGrid(grid: Grid): string {
  return JSON.stringify(grid, null, 2);
}
