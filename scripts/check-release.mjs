import assert from "node:assert/strict";
import { mkdir, copyFile, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const [manifest, versions, pkg, lock] = await Promise.all(
  ["manifest.json", "versions.json", "package.json", "package-lock.json"].map(readJson),
);
assert.match(manifest.id, /^[a-z]+(?:-[a-z]+)*$/);
assert(!manifest.id.includes("obsidian") && !manifest.id.endsWith("plugin"));
assert.equal(manifest.id, pkg.name);
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.version, lock.version);
assert.equal(manifest.version, lock.packages[""].version);
assert.equal(versions[manifest.version], manifest.minAppVersion);
assert.match(manifest.minAppVersion, /^\d+\.\d+\.\d+$/);
assert(manifest.description.length <= 250 && manifest.description.endsWith("."));
assert.equal(typeof manifest.isDesktopOnly, "boolean");
assert((await stat("README.md")).size > 0);
assert((await stat("LICENSE")).size > 0);
const bundle = await readFile("main.js", "utf8");
assert(bundle.includes("Third-party notices"));
assert(!bundle.includes("sourceMappingURL="));
assert(bundle.length < 350_000, "The production bundle exceeded its size budget.");

if (process.argv.includes("--stage")) {
  const output = join("dist", manifest.version);
  await mkdir(output, { recursive: true });
  await Promise.all(["main.js", "manifest.json", "styles.css"].map(file => copyFile(file, join(output, file))));
  console.log(`Release assets staged in ${output}.`);
}
