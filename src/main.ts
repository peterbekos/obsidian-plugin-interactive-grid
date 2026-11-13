import { MarkdownView, Notice, Plugin, type TFile } from "obsidian";
import { type Grid, parseGrid, sameRect, serializeGrid } from "./grid";
import { GridView } from "./grid-view";
import { normalizeSource, replaceGridBlock } from "./note";

interface UndoEntry {
  before: string;
  after: string;
}

export default class InteractiveGridPlugin extends Plugin {
  private readonly history = new Map<TFile, Map<string, UndoEntry>>();
  private readonly saving = new Set<TFile>();

  onload(): void {
    this.registerEvent(this.app.vault.on("delete", file => {
      for (const tracked of this.history.keys()) {
        if (tracked === file || tracked.path.startsWith(file.path + "/")) this.history.delete(tracked);
      }
    }));
    this.registerMarkdownCodeBlockProcessor("grid", (source, container, context) => {
      try {
        const grid = parseGrid(source);
        const file = this.app.vault.getFileByPath(context.sourcePath);
        let expected = normalizeSource(source);
        let current = grid;
        const history = () => file && this.history.get(file)?.get(grid.id);
        const save = async (next: Grid) => {
          const replacement = serializeGrid(next);
          const moved = current.cards.some(card => {
            const updated = next.cards.find(item => item.id === card.id);
            return updated && !sameRect(card, updated);
          });
          if (!file || !await this.write(file, grid.id, expected, replacement,
            moved ? { before: expected, after: replacement } : undefined)) return false;
          expected = replacement;
          current = next;
          return true;
        };
        context.addChild(new GridView(container, this.app, grid, {
          save,
          canUndo: () => history()?.after === expected,
          undo: async () => {
            const entry = history();
            if (!file || entry?.after !== expected) return;
            if (!await this.write(file, grid.id, expected, entry.before, undefined)) return;
            expected = entry.before;
            current = parseGrid(entry.before);
            return current;
          },
        }));
      } catch (error) {
        container.createDiv({
          cls: "interactive-grid-error",
          text: error instanceof Error ? error.message : "The grid could not be displayed.",
        });
      }
    });
  }

  private async write(file: TFile, id: string, expected: string, replacement: string,
    undo?: UndoEntry): Promise<boolean> {
    if (this.saving.has(file)) {
      new Notice("Another grid change is saving. Try again in a moment.");
      return false;
    }
    this.saving.add(file);
    const history = this.history.get(file) ?? new Map<string, UndoEntry>();
    const previous = history.get(id);
    if (undo) {
      history.set(id, undo);
      this.history.set(file, history);
    } else {
      history.delete(id);
    }
    try {
      const views = this.app.workspace.getLeavesOfType("markdown").map(leaf => leaf.view)
        .filter((view): view is MarkdownView => view instanceof MarkdownView && view.file === file &&
          view.getMode() === "source");
      const view = views[0];
      if (view) {
        const editor = view.editor;
        const note = editor.getValue();
        if (views.some(other => other.editor.getValue() !== note)) {
          throw new Error("The open editors disagree. Close the extra editor and try again.");
        }
        const change = replaceGridBlock(note, id, expected, replacement);
        editor.replaceRange(change.text, editor.offsetToPos(change.from), editor.offsetToPos(change.to));
      } else {
        await this.app.vault.process(file, note => {
          const change = replaceGridBlock(note, id, expected, replacement);
          return note.slice(0, change.from) + change.text + note.slice(change.to);
        });
      }
      return true;
    } catch (error) {
      if (previous) history.set(id, previous);
      else history.delete(id);
      new Notice(error instanceof Error ? error.message : "The grid could not be saved.");
      return false;
    } finally {
      if (!history.size) this.history.delete(file);
      this.saving.delete(file);
    }
  }
}
