import MarkdownIt from "markdown-it";
import { parseGrid } from "./grid";

export const gridFence = "interactive-grid";

interface NoteEdit {
  from: number;
  to: number;
  text: string;
}

const markdown = new MarkdownIt("commonmark");
const conflict = "The grid changed or could not be located. Reopen the note and try again.";

export function normalizeSource(source: string): string {
  return source.replace(/\r\n/g, "\n").trim();
}

function parseNote(note: string) {
  const frontmatter = /^---[ \t]*\r?\n[\s\S]*?^(?:---|\.\.\.)[ \t]*(?=\r?$)/m.exec(note);
  const source = frontmatter?.index === 0
    ? frontmatter[0].replace(/[^\r\n]/g, " ") + note.slice(frontmatter[0].length)
    : note;
  return markdown.parse(source, {});
}

export function migrateLegacyGrids(note: string): NoteEdit[] {
  const lines = note.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length;
  }

  const edits: NoteEdit[] = [];
  for (const token of parseNote(note)) {
    if (token.type !== "fence" || token.level !== 0 || token.info.trim() !== "grid" || !token.map) continue;
    const [first, end] = token.map;
    if (!isClosingFence(lines[end - 1] ?? "", token.markup)) continue;
    try {
      parseGrid(token.content);
    } catch {
      continue;
    }
    const from = offsets[first] + lines[first].indexOf("grid");
    edits.push({ from, to: from + "grid".length, text: gridFence });
  }
  return edits;
}

export function replaceGridBlock(note: string, id: string, expected: string, replacement: string): NoteEdit {
  const matches = parseNote(note).filter(token => {
    if (token.type !== "fence" || token.info.trim() !== gridFence || !token.map) return false;
    try {
      const value = JSON.parse(token.content) as { id?: unknown } | null;
      return value?.id === id;
    } catch {
      return false;
    }
  });
  if (matches.length > 1) throw new Error("Grid IDs must be unique within a note.");
  const match = matches[0];
  if (match?.level !== 0 || !match.map || normalizeSource(match.content) !== normalizeSource(expected)) throw new Error(conflict);

  const [first, end] = match.map;
  const lines = note.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const opening = lines[first] ?? "";
  const closing = lines[end - 1] ?? "";
  if (end <= first + 2 || !isClosingFence(closing, match.markup)) throw new Error(conflict);
  const newline = opening.endsWith("\r\n") ? "\r\n" : "\n";
  const indent = opening.match(/^ {0,3}/)?.[0] ?? "";
  const body = replacement.split("\n").map(line => indent + line + newline).join("");
  const from = lines.slice(0, first + 1).join("").length;
  const to = from + lines.slice(first + 1, end - 1).join("").length;
  return { from, to, text: body };
}

function isClosingFence(line: string, markup: string): boolean {
  const match = /^ {0,3}(`{3,}|~{3,})[ \t]*(?:\r?\n)?$/.exec(line);
  return !!match && match[1][0] === markup[0] && match[1].length >= markup.length;
}
