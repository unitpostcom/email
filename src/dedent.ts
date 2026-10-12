// Shared by the TSX codec (parseTsx) and the React codec (fromJsx) so a
// <Markdown>/<Code> body dedents the same way whichever way it was written.
// Internal: not re-exported from the public entry.

// Reverse the printer's pretty-indentation for whitespace-significant content
// (markdown/code): drop leading/trailing blank lines, blank out whitespace-only
// interior lines, and remove the largest indent common to every non-empty line.
// Mirrors how tagged-template `dedent` helpers behave, and is idempotent — so
// repeated print→parse cycles (the Code editor re-parses on every keystroke)
// can never drift the stored content.
export function dedentText(raw: string): string {
  const lines = raw
    .replace(/^[ \t]*\n/, "") // leading blank line (after the opening tag)
    .replace(/\n[ \t]*$/, "") // trailing indent before the closing tag
    .split("\n")
    .map((l) => (/^[ \t]*$/.test(l) ? "" : l));
  let indent: number | null = null;
  for (const l of lines) {
    if (!l) continue;
    const lead = l.match(/^[ \t]*/)?.[0].length ?? 0;
    indent = indent === null ? lead : Math.min(indent, lead);
  }
  if (!indent) return lines.join("\n").trim() === "" ? "" : lines.join("\n");
  return lines.map((l) => (l ? l.slice(indent) : "")).join("\n");
}
