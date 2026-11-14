import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const [endpoint, vaultPath] = process.argv.slice(2);
assert(endpoint && vaultPath, "Pass the isolated Obsidian CDP URL and disposable vault path.");
const browser = await chromium.connectOverCDP(endpoint, { noDefaults: true, isLocal: true });
const page = browser.contexts()[0].pages().find(tab => tab.url() === "app://obsidian.md/index.html");
assert(page, "Could not find the Obsidian window.");
page.setDefaultTimeout(5000);
await page.bringToFront();
const errors = [];
page.on("pageerror", error => errors.push(error));

try {
  await page.evaluate(async path => {
    const app = window.app;
    if (app.vault.adapter.getBasePath() !== path) throw new Error("The open vault does not match the test vault path.");
  }, vaultPath);

  const trust = page.getByRole("button", { name: "Trust author and enable plugins" });
  const settings = page.locator(".modal.mod-settings:visible .modal-close-button");
  if (await trust.isVisible()) {
    await trust.click();
    await settings.waitFor();
  }
  if (await settings.isVisible()) await settings.click();
  await page.locator(".modal-bg:visible").waitFor({ state: "hidden" });

  const open = async (path, mode = "preview") => {
    await page.evaluate(async ({ path, mode }) => {
      const app = window.app;
      const leaf = app.workspace.getLeaf(false);
      await leaf.setViewState({ type: "empty" });
      await leaf.openFile(app.vault.getFileByPath(path), { state: { mode, source: false } });
    }, { path, mode });
  };
  const board = page.locator(".ig-board:visible");
  const card = id => board.locator(`[data-card-id="${id}"]`);
  const edge = (id, side) => board.locator(".ig-card").filter({ has: page.locator(`[data-card-id="${id}"]`) }).locator(`.ig-handle-${side}`);
  const position = async (id, row, column, rowSpan, columnSpan) => {
    await page.waitForFunction(({ id, expected }) => {
      const card = [...document.querySelectorAll(`.ig-board [data-card-id="${id}"]`)].find(card => card.getClientRects().length);
      return card?.parentElement.style.gridArea === expected;
    }, { id, expected: `${row} / ${column} / span ${rowSpan} / span ${columnSpan}` }, { timeout: 5000, polling: 100 });
  };
  const saved = async (file, id, expected) => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const note = await readFile(`${vaultPath}/${file}`, "utf8");
      const grid = JSON.parse(note.match(/```grid\n([\s\S]*?)\n```/)[1]);
      const card = grid.cards.find(card => card.id === id);
      if (card && Object.entries(expected).every(([key, value]) => card[key] === value)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.fail(`Card ${id} did not persist in ${file}.`);
  };
  const drag = async (locator, rows, columns, previewClass) => {
    await locator.scrollIntoViewIfNeeded();
    const target = await locator.boundingBox();
    const dimensions = await board.evaluate(board => {
      const css = getComputedStyle(board);
      return [parseFloat(css.gridTemplateRows), parseFloat(css.gridTemplateColumns)];
    });
    const x = target.x + target.width / 2;
    const y = target.y + target.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + columns * dimensions[1], y + rows * dimensions[0], { steps: 8 });
    if (previewClass) await board.locator(previewClass).waitFor({ timeout: 3000 });
    await page.mouse.up();
  };

  const weekend = "Milwaukee weekend.md";
  await open(weekend);
  await position("brunch", 5, 2, 2, 1);
  await drag(card("brunch"), 1, 0, ".ig-preview:not(.ig-invalid)");
  await position("brunch", 6, 2, 2, 1);
  await drag(edge("brunch", "bottom"), 1, 0, ".ig-preview:not(.ig-invalid)");
  await position("brunch", 6, 2, 3, 1);
  await drag(edge("brunch", "bottom"), 1, 0, ".ig-preview.ig-invalid");
  await position("brunch", 6, 2, 3, 1);
  await page.getByRole("button", { name: "Undo move or resize" }).click();
  await position("brunch", 6, 2, 2, 1);
  await saved(weekend, "brunch", { row: 6, rowSpan: 2 });
  await open(weekend);
  await position("brunch", 6, 2, 2, 1);

  const workshop = "Workshop layout.md";
  await open(workshop);
  await position("workshop", 1, 1, 2, 2);
  await drag(card("workshop"), 1, 0, ".ig-preview:not(.ig-invalid)");
  await position("workshop", 2, 1, 2, 2);
  await drag(edge("workshop", "right"), 0, 1, ".ig-preview:not(.ig-invalid)");
  await position("workshop", 2, 1, 2, 3);
  await position("supplies", 1, 4, 2, 1);
  await drag(edge("workshop", "left"), 0, -1, ".ig-preview.ig-invalid");
  await position("workshop", 2, 1, 2, 3);

  await open(workshop, "source");
  await page.evaluate(() => {
    const editor = window.app.workspace.activeLeaf.view.editor;
    editor.setCursor({ line: 0, ch: 0 });
    editor.replaceRange("An unrelated editor change.\n\n", { line: 0, ch: 0 });
  });
  await card("workshop").press("ArrowDown");
  await position("workshop", 3, 1, 2, 3);
  await saved(workshop, "workshop", { row: 3, columnSpan: 3 });
  assert.match(await readFile(`${vaultPath}/${workshop}`, "utf8"), /^An unrelated editor change\./);
  await card("workshop").click();
  const palette = page.getByRole("group", { name: "Color" });
  assert.equal(await palette.getByRole("radio").count(), 9);
  assert(await palette.getByRole("radio", { name: "Purple" }).isChecked());
  await palette.getByRole("radio", { name: "Purple" }).press("ArrowRight");
  assert(await palette.getByRole("radio", { name: "Magenta" }).isChecked());
  await palette.getByText("Cyan", { exact: true }).click();
  assert(await palette.getByRole("radio", { name: "Cyan" }).isChecked());
  await page.getByLabel("Title", { exact: true }).fill("Workshop revised");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await saved(workshop, "workshop", { title: "Workshop revised", color: "cyan" });
  await board.locator(".ig-card.ig-color-cyan").filter({ hasText: "Workshop revised" }).waitFor();
  await page.getByRole("button", { name: "Add card" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Welcome");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const welcome = page.getByRole("button", { name: /^Edit or move Welcome/ });
  await welcome.click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await welcome.waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  console.log("Obsidian smoke test passed in Reading view and Live Preview.");
} finally {
  await browser.close();
}
