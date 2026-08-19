// ---------------------------------------------------------------------------
// Document diagnostics — editor-time "lint" for an EmailDocument.
//
// A pure pass over the canonical document tree that surfaces email-rendering
// concerns the author should know about BEFORE sending, e.g.:
//   • Tailwind utilities the email compiler doesn't support (silently dropped
//     at render — `compileClasses().unknown`), so the author sees the style
//     "isn't applying" and learns why + which class.
//   • Raw HTML blocks that the sanitizer strips/neutralizes (unsafe tags,
//     event handlers, javascript: URLs) — `sanitizeEmailHtml().report`.
//
// Note: marketing emails do NOT warn about a missing {{unsubscribe_url}} — the
// compliance footer (with a working unsubscribe) is ENFORCED and auto-appended
// to every marketing email by the renderer, so there's nothing actionable to
// flag (see render.ts `needsUnsubscribeFooter` / marketing-footer).
//
// This intentionally REUSES the same primitives the renderer + inspector use
// (`compileClasses`, `sanitizeEmailHtml`/`summarizeReport`) so the warnings can
// never drift from what actually ships. It returns data only (no UI), so the
// editor can render a floating pill and the engine/tests can assert on it.
// ---------------------------------------------------------------------------

import type {
  Block,
  ColumnBlock,
  EmailDocument,
  LeafBlock,
  SectionChild,
  Theme,
} from "./schema";
import { compileClasses } from "./tw-compile";
import { sanitizeEmailHtml, summarizeReport } from "./sanitize";

export type DocumentWarningKind = "unknown-classes" | "unsafe-html";

export type DocumentWarning = {
  kind: DocumentWarningKind;
  // Severity drives the pill color. "warning" = will silently misrender / drop;
  // "info" = compliance/heads-up that still renders.
  severity: "warning" | "info";
  // Short, human title (e.g. "Unsupported styles").
  title: string;
  // One-line detail naming the specific offending thing(s).
  detail: string;
  // The block this concerns (for deep-linking from the pill). Null = document
  // level (e.g. the body className).
  blockId: string | null;
  // A friendly location label, e.g. "Heading", "HTML block", "Email body".
  blockLabel: string;
};

// Human label for a block type (for the warning location). Kept here (not in
// schema) so it can stay UI-flavored without coupling the schema to copy.
const BLOCK_LABELS: Record<string, string> = {
  section: "Section",
  row: "Row",
  column: "Column",
  text: "Text",
  heading: "Heading",
  button: "Button",
  image: "Image",
  divider: "Divider",
  link: "Link",
  spacer: "Spacer",
  markdown: "Markdown",
  code: "Code",
  html: "HTML block",
};

function blockLabel(type: string): string {
  return BLOCK_LABELS[type] ?? "Block";
}

// Inspect one node's className + (for html blocks) raw HTML, pushing any
// warnings. `theme` lets className compilation resolve theme tokens identically
// to render (so e.g. a theme color isn't falsely reported unknown).
function inspectNode(
  node: { id?: string; type: string; className?: string; html?: string },
  theme: Theme | undefined,
  out: DocumentWarning[],
): void {
  const label = blockLabel(node.type);
  const id = node.id ?? null;

  if (node.className && node.className.trim()) {
    const { unknown } = compileClasses(node.className, theme);
    if (unknown.length) {
      out.push({
        kind: "unknown-classes",
        severity: "warning",
        title: "Unsupported styles",
        detail: `${label}: ${unknown.join(", ")} ${
          unknown.length === 1 ? "isn't" : "aren't"
        } supported in email and will be ignored.`,
        blockId: id,
        blockLabel: label,
      });
    }
  }

  if (node.type === "html" && typeof node.html === "string" && node.html.trim()) {
    const { report, changed } = sanitizeEmailHtml(node.html);
    if (changed) {
      const summary = summarizeReport(report);
      out.push({
        kind: "unsafe-html",
        severity: "warning",
        title: "Unsafe HTML removed",
        detail: `HTML block: ${
          summary ?? "some content was stripped for email safety"
        }.`,
        blockId: id,
        blockLabel: label,
      });
    }
  }
}

// Walk the full tree (body > Section* recursive, body > Row > Column > leaf),
// inspecting every node including the column wrappers. Mirrors the recursion in
// render.ts `collectVariables`.
function walk(
  node: Block | ColumnBlock | SectionChild,
  theme: Theme | undefined,
  out: DocumentWarning[],
): void {
  inspectNode(node, theme, out);
  if (node.type === "section") {
    node.children.forEach((child) => walk(child, theme, out));
  } else if (node.type === "row") {
    node.columns.forEach((col) => {
      inspectNode(col, theme, out);
      col.children.forEach((child) => walk(child, theme, out));
    });
  }
}

// Compute the full list of editor-time warnings for a document. Pure + cheap
// (string scans + table lookups), safe to call on every keystroke via useMemo.
export function collectDocumentWarnings(doc: EmailDocument): DocumentWarning[] {
  const out: DocumentWarning[] = [];

  // Document-level className (page-wide utilities, compiled like a block's).
  if (doc.className && doc.className.trim()) {
    const { unknown } = compileClasses(doc.className, doc.theme);
    if (unknown.length) {
      out.push({
        kind: "unknown-classes",
        severity: "warning",
        title: "Unsupported styles",
        detail: `Email body: ${unknown.join(", ")} ${
          unknown.length === 1 ? "isn't" : "aren't"
        } supported in email and will be ignored.`,
        blockId: null,
        blockLabel: "Email body",
      });
    }
  }

  doc.blocks.forEach((b) => walk(b, doc.theme, out));

  return out;
}
