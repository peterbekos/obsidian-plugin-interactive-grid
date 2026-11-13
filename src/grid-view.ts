import { App, MarkdownRenderChild } from "obsidian";
import { CardModal } from "./card-modal";
import { adjust, type Card, type Edge, type Grid, placementError, type Rect, sameRect } from "./grid";

export interface GridActions {
  save(next: Grid): Promise<boolean>;
  undo(): Promise<Grid | undefined>;
  canUndo(): boolean;
}

const edges = ["top", "right", "bottom", "left"] as const;
const arrows = new Map<string, [number, number]>([
  ["ArrowUp", [-1, 0]], ["ArrowDown", [1, 0]],
  ["ArrowLeft", [0, -1]], ["ArrowRight", [0, 1]],
]);

function place(element: HTMLElement, rect: Rect): void {
  element.style.gridArea = `${rect.row} / ${rect.column} / span ${rect.rowSpan} / span ${rect.columnSpan}`;
}

export class GridView extends MarkdownRenderChild {
  private root!: HTMLElement;
  private board!: HTMLElement;
  private status!: HTMLElement;
  private modal?: CardModal;
  private busy = false;

  constructor(
    container: HTMLElement,
    private readonly app: App,
    private grid: Grid,
    private readonly actions: GridActions,
  ) {
    super(container);
  }

  onload(): void {
    this.root = this.containerEl.createDiv("interactive-grid");
    this.render();
  }

  onunload(): void {
    this.modal?.close();
    this.root.remove();
  }

  private render(): void {
    const scrollLeft = this.root.querySelector(".ig-scroll")?.scrollLeft ?? 0;
    this.root.empty();
    const toolbar = this.root.createDiv("ig-toolbar");
    const add = toolbar.createEl("button", { text: "Add card", attr: { type: "button" } });
    add.addEventListener("click", () => {
      const occupied = new Set<number>();
      for (const card of this.grid.cards) {
        for (let row = card.row; row < card.row + card.rowSpan; row++) {
          for (let column = card.column; column < card.column + card.columnSpan; column++) {
            occupied.add((row - 1) * this.grid.columns.length + column - 1);
          }
        }
      }
      const size = this.grid.rows.length * this.grid.columns.length;
      for (let cell = 0; cell < size; cell++) {
        if (occupied.has(cell)) continue;
        this.addCard(Math.floor(cell / this.grid.columns.length) + 1, cell % this.grid.columns.length + 1);
        return;
      }
      this.status.setText("There are no empty cells.");
    });
    const undo = toolbar.createEl("button", { text: "Undo move or resize", attr: { type: "button" } });
    undo.disabled = !this.actions.canUndo();
    undo.addEventListener("click", () => { void this.runUndo(); });
    this.status = toolbar.createDiv({ cls: "ig-status", attr: { role: "status" } });

    const scroller = this.root.createDiv("ig-scroll");
    const layout = scroller.createDiv("ig-layout");
    layout.style.setProperty("--ig-columns", String(this.grid.columns.length));
    layout.style.setProperty("--ig-rows", String(this.grid.rows.length));
    const headers = layout.createDiv("ig-headers");
    for (const column of this.grid.columns) {
      const header = headers.createDiv("ig-header");
      header.createDiv({ cls: "ig-label", text: column.label });
      if (column.note) header.createDiv({ cls: "ig-note", text: column.note });
    }
    const labels = layout.createDiv("ig-rows");
    for (const row of this.grid.rows) labels.createDiv({ cls: "ig-row", text: row });
    this.board = layout.createDiv({ cls: "ig-board", attr: { "aria-label": "Card positions" } });
    this.board.addEventListener("dblclick", event => {
      if (event.target !== this.board) return;
      const { row, column } = this.cellAt(event);
      if (!placementError(this.grid, { row, column, rowSpan: 1, columnSpan: 1 })) this.addCard(row, column);
    });
    for (const card of this.grid.cards) this.renderCard(card);
    scroller.scrollLeft = scrollLeft;
  }

  private async runUndo(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const restored = await this.actions.undo();
      if (restored && this.root.isConnected) {
        this.grid = restored;
        this.render();
      }
    } finally {
      this.busy = false;
    }
  }

  private addCard(row: number, column: number): void {
    this.openCard({
      id: this.root.ownerDocument.defaultView!.crypto.randomUUID(), title: "", color: "default",
      row, column, rowSpan: 1, columnSpan: 1,
    }, false);
  }

  private openCard(card: Card, existing: boolean): void {
    if (this.busy) return;
    this.modal = new CardModal(this.app, this.grid, card, existing, draft => {
      const cards = existing ? this.grid.cards.map(item => item.id === draft.id ? draft : item)
        : [...this.grid.cards, draft];
      return this.save({ ...this.grid, cards }, draft.id);
    }, () => this.save({ ...this.grid, cards: this.grid.cards.filter(item => item.id !== card.id) }));
    this.modal.open();
  }

  private async save(next: Grid, focusId?: string, edge?: Edge): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    try {
      if (!await this.actions.save(next)) return false;
      this.grid = next;
      if (this.root.isConnected) {
        this.render();
        if (focusId) {
          const card = this.root.querySelector<HTMLElement>(`[data-card-id="${focusId}"]`);
          const control = edge ? card?.parentElement?.querySelector<HTMLElement>(`.ig-handle-${edge}`) : card;
          control?.focus({ preventScroll: true });
        }
      }
      return true;
    } finally {
      this.busy = false;
    }
  }

  private renderCard(card: Card): void {
    const element = this.board.createDiv({ cls: `ig-card ig-color-${card.color}` });
    place(element, card);
    const button = element.createEl("button", {
      cls: "ig-card-button",
      attr: { type: "button", "data-card-id": card.id, "aria-label": `Edit or move ${card.title}, ${this.describe(card)}` },
    });
    button.createSpan({ cls: "ig-title", text: card.title });
    if (card.details) button.createSpan({ cls: "ig-details", text: card.details });
    button.title = card.details ? `${card.title}\n${card.details}` : card.title;
    button.addEventListener("click", event => {
      if (event.detail === 0 || button.dataset.dragged !== "true") this.openCard(card, true);
    });
    this.bindPosition(button, card);
    for (const edge of edges) {
      const handle = element.createEl("button", {
        cls: `ig-handle ig-handle-${edge}`,
        attr: { type: "button", "aria-label": `Resize ${card.title} from the ${edge} edge` },
      });
      this.bindPosition(handle, card, edge);
    }
  }

  private describe(rect: Rect): string {
    const lastRow = rect.row + rect.rowSpan - 1;
    const lastColumn = rect.column + rect.columnSpan - 1;
    return `rows ${rect.row}–${lastRow}, columns ${rect.column}–${lastColumn}`;
  }

  private cellAt(event: MouseEvent): { row: number; column: number } {
    const bounds = this.board.getBoundingClientRect();
    return {
      row: Math.floor((event.clientY - bounds.top) * this.grid.rows.length / bounds.height) + 1,
      column: Math.floor((event.clientX - bounds.left) * this.grid.columns.length / bounds.width) + 1,
    };
  }

  private inside(event: PointerEvent): boolean {
    const { row, column } = this.cellAt(event);
    return row >= 1 && row <= this.grid.rows.length && column >= 1 && column <= this.grid.columns.length;
  }

  private bindPosition(button: HTMLButtonElement, card: Card, edge?: Edge): void {
    button.addEventListener("keydown", event => {
      const delta = arrows.get(event.key);
      if (!delta || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      if (this.busy || event.repeat) return;
      void this.commitPosition(card, adjust(card, ...delta, edge), edge);
    });

    button.addEventListener("pointerdown", start => {
      if (this.busy || !start.isPrimary || start.button !== 0) return;
      button.dataset.dragged = "false";
      button.setPointerCapture(start.pointerId);
      const board = this.board;
      const origin = this.cellAt(start);
      const initialBounds = board.getBoundingClientRect();
      const rowSize = initialBounds.height / this.grid.rows.length;
      const columnSize = initialBounds.width / this.grid.columns.length;
      let preview: HTMLElement | undefined;
      const candidateAt = (event: PointerEvent) => {
        const bounds = board.getBoundingClientRect();
        const rows = edge ? Math.round((event.clientY - start.clientY + initialBounds.top - bounds.top) / rowSize)
          : this.cellAt(event).row - origin.row;
        const columns = edge ? Math.round((event.clientX - start.clientX + initialBounds.left - bounds.left) / columnSize)
          : this.cellAt(event).column - origin.column;
        return adjust(card, rows, columns, edge);
      };
      const move = (event: PointerEvent) => {
        if (event.pointerId !== start.pointerId) return;
        if (!preview && Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) < 5) return;
        button.dataset.dragged = "true";
        preview ??= board.createDiv({ cls: "ig-preview", attr: { "aria-hidden": "true" } });
        const candidate = candidateAt(event);
        const error = (!edge && !this.inside(event))
          ? "The card must fit inside the grid." : placementError(this.grid, candidate, card.id);
        const row = Math.max(1, candidate.row);
        const column = Math.max(1, candidate.column);
        const rowSpan = Math.min(this.grid.rows.length + 1, candidate.row + candidate.rowSpan) - row;
        const columnSpan = Math.min(this.grid.columns.length + 1, candidate.column + candidate.columnSpan) - column;
        preview.hidden = rowSpan < 1 || columnSpan < 1;
        if (!preview.hidden) place(preview, { row, column, rowSpan, columnSpan });
        preview.toggleClass("ig-invalid", !!error);
        const status = error ?? this.describe(candidate);
        if (this.status.textContent !== status) this.status.setText(status);
      };
      const end = (event: PointerEvent) => {
        if (event.pointerId !== start.pointerId) return;
        button.removeEventListener("pointermove", move);
        button.removeEventListener("pointerup", end);
        button.removeEventListener("pointercancel", end);
        button.removeEventListener("lostpointercapture", end);
        if (!preview) return;
        preview.remove();
        this.status.empty();
        if (event.type === "pointerup") {
          if (!edge && !this.inside(event)) {
            this.status.setText("The card must fit inside the grid.");
            return;
          }
          void this.commitPosition(card, candidateAt(event), edge);
        }
      };
      button.addEventListener("pointermove", move);
      button.addEventListener("pointerup", end);
      button.addEventListener("pointercancel", end);
      button.addEventListener("lostpointercapture", end);
    });
  }

  private async commitPosition(card: Card, rect: Rect, edge?: Edge): Promise<void> {
    const error = placementError(this.grid, rect, card.id);
    if (error) {
      this.status.setText(error);
      return;
    }
    if (sameRect(card, rect)) return;
    const cards = this.grid.cards.map(item => item.id === card.id ? { ...item, ...rect } : item);
    await this.save({ ...this.grid, cards }, card.id, edge);
  }
}
