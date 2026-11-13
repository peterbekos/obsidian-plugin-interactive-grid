import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const target = join("test-vault", ".obsidian", "plugins", "interactive-grid");
await mkdir(target, { recursive: true });
await Promise.all(["main.js", "manifest.json", "styles.css"].map(file => copyFile(file, join(target, file))));
console.log("Open the test-vault folder as a vault in Obsidian.");
