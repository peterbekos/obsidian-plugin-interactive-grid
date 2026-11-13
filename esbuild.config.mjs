import * as esbuild from "esbuild";
import { readFile } from "node:fs/promises";

const config = {
  entryPoints: ["src/main.ts"],
  outfile: "main.js",
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  target: "es2020",
  platform: "browser",
  sourcemap: process.argv.includes("--watch") ? "inline" : false,
  logLevel: "info",
  banner: { js: `/*!
${(await readFile("THIRD-PARTY-NOTICES.md", "utf8")).replaceAll("*/", "* /")}*/` },
};

if (process.argv.includes("--watch")) {
  const context = await esbuild.context(config);
  await context.watch();
} else {
  await esbuild.build(config);
}
