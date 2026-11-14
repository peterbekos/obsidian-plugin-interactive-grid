import { App, Modal, Setting } from "obsidian";
import { type Card, colors, type Grid, placementError } from "./grid";

export class CardModal extends Modal {
  constructor(
    app: App,
    private readonly grid: Grid,
    private readonly card: Card,
    private readonly existing: boolean,
    private readonly save: (card: Card) => Promise<boolean>,
    private readonly remove: () => Promise<boolean>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.existing ? "Edit card" : "Add card");
    const draft = { ...this.card };
    const form = this.contentEl.createEl("form");
    const title = new Setting(form).setName("Title");
    title.addText(input => {
      input.setValue(draft.title).onChange(value => { draft.title = value; });
      input.inputEl.setAttribute("aria-label", "Title");
      input.inputEl.focus();
    });
    new Setting(form).setName("Details").addTextArea(input => {
      input.setValue(draft.details ?? "").onChange(value => { draft.details = value; });
      input.inputEl.setAttribute("aria-label", "Details");
    });
    const palette = form.createEl("fieldset", { cls: "ig-palette" });
    palette.createEl("legend", { text: "Color" });
    const swatches = palette.createDiv("ig-swatches");
    for (const color of colors) {
      const name = color[0].toUpperCase() + color.slice(1);
      const label = swatches.createEl("label", { cls: `ig-swatch ig-color-${color}`, title: name });
      const input = label.createEl("input", {
        attr: { type: "radio", name: "ig-card-color", value: color },
      });
      input.checked = draft.color === color;
      input.addEventListener("change", () => {
        if (input.checked) draft.color = color;
      });
      label.createSpan({ cls: "ig-swatch-chip", attr: { "aria-hidden": "true" } });
      label.createSpan({ text: name });
    }
    const position = [
      ["Row", "row", this.grid.rows.length],
      ["Column", "column", this.grid.columns.length],
      ["Row span", "rowSpan", this.grid.rows.length],
      ["Column span", "columnSpan", this.grid.columns.length],
    ] as const;
    for (const [label, key, max] of position) {
      new Setting(form).setName(label).addText(input => {
        input.setValue(String(draft[key]));
        input.inputEl.type = "number";
        input.inputEl.min = "1";
        input.inputEl.max = String(max);
        input.inputEl.required = true;
        input.inputEl.setAttribute("aria-label", label);
        input.onChange(value => { draft[key] = value === "" ? NaN : Number(value); });
      });
    }

    const feedback = form.createDiv({ attr: { role: "alert" } });
    const actions = new Setting(form);
    let busy = false;
    const submit = async (deleting = false) => {
      if (busy) return;
      feedback.empty();
      if (!deleting) {
        draft.title = draft.title.trim();
        const error = !draft.title ? "Enter a title." : placementError(this.grid, draft, draft.id);
        if (error) {
          feedback.setText(error);
          return;
        }
      }
      busy = true;
      try {
        if (await (deleting ? this.remove() : this.save(draft))) this.close();
        else feedback.setText("The change could not be saved. Reopen the card and try again.");
      } finally {
        busy = false;
      }
    };
    if (this.existing) actions.addButton(button => {
      button.setButtonText("Delete").setWarning().onClick(() => { void submit(true); });
      button.buttonEl.type = "button";
    });
    actions.addButton(button => {
      button.setButtonText("Save").setCta();
      button.buttonEl.type = "submit";
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      void submit();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
