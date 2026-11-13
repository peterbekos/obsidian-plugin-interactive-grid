import MarkdownIt from "markdown-it";

const markdown = new MarkdownIt("commonmark");
const conflict = "The grid changed or could not be located. Reopen the note and try again.";

export function normalizeSource(source: string): string {
  return source.replace(/\r\n/g, "\n").trim();
}

export function replaceGridBlock(note: string, id: string, expected: string, replacement: string): { from: number; to: number; text: string } {
  const source = note.replace(/(?<![\s\S])---[ \t]*\r?\n[\s\S]*?^(?:---|\.\.\.)[ \t]*(?=\r?$)/m, frontmatter =>
    frontmatter.replace(/[^\r\n]/g, " "));
  const matches = markdown.parse(source, {}).filter(token => {
    if (token.type !== "fence" || token.info.trim() !== "grid" || !token.map) return false;
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
