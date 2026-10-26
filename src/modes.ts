import { createBlock } from "./blocks";
import { htmlToBlocks } from "./codec";
import { fitImportedHtml, isWholeEmailHtml } from "./html-import";
import { renderToHtml } from "./render";
import { BRAND_THEME } from "./samples";
import { EmailDocumentSchema, type EmailDocument } from "./schema";
import { designEmailDocument, normalizeSimpleDocument, simplifyEmailDocument, templateKind } from "./simple";

// The three ways a template is authored (ADR-0099), named after the editor's
// tabs and read back on every API / MCP template as `editor`:
//
//   simple — a plain, personal email typed like Gmail (compositionMode
//            "simple"; the Simple tab, the `text` body).
//   design — built from @unitpost/email components (the Design tab, the
//            `tsx` body). The default for anything branded.
//   code   — raw HTML: a designed document whose body is nothing but Html
//            blocks (the `html` body, or HTML pasted into the Code tab). The
//            Design tab can show it but not edit it piece by piece.
//
// `kind` (simple | designed, ADR-0072) is the coarser split it refines:
// design and code are both "designed". The row's own `mode` (VISUAL / CODE) is
// only the tab the editor last opened.

export const TEMPLATE_EDITORS = ["simple", "design", "code"] as const;
export type TemplateEditor = (typeof TEMPLATE_EDITORS)[number];

/** Which editor a stored design belongs to (accepts the raw stored JSON). */
export function templateEditor(design: unknown): TemplateEditor {
  if (templateKind(design) === "simple") return "simple";
  const blocks = design && typeof design === "object" ? (design as { blocks?: unknown }).blocks : undefined;
  if (
    Array.isArray(blocks) &&
    blocks.length > 0 &&
    blocks.every((b) => b && typeof b === "object" && (b as { type?: unknown }).type === "html")
  ) {
    return "code";
  }
  return "design";
}

export type TemplateConversion = {
  doc: EmailDocument;
  /** What changed that a person would notice, in plain words. Empty when lossless. */
  warnings: string[];
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// Design -> Code: the body becomes the HTML the renderer produces, so it looks
// the same. Rendered as a transactional email without a preview line or the
// "Sent with" mark — the managed footer, the preview text and the mark are
// still added at send from the document, so baking them in would double them.
// {{variables}} stay literal and fill at send.
function designToCode(doc: EmailDocument): TemplateConversion {
  const html = renderToHtml(
    EmailDocumentSchema.parse({ ...doc, category: "transactional", previewText: "" }),
    {},
    { showPoweredBy: false },
  );
  const next = fitImportedHtml(
    EmailDocumentSchema.parse({ ...doc, blocks: [createBlock("html", { html })] }),
  );
  return {
    doc: next,
    warnings: [
      "Turned the design into HTML (Code). It looks the same, but it's no longer editable block by block; converting back to Design rebuilds it as components only where it can.",
    ],
  };
}

// Code -> Design, best effort (htmlToBlocks): headings, paragraphs, lists,
// images, rules, links and styled-link buttons become components; anything
// else stays as an Html block. When nothing maps, the template stays Code.
function codeToDesign(doc: EmailDocument): TemplateConversion {
  const html = doc.blocks.map((b) => (b.type === "html" ? b.html : "")).join("\n");
  const imported = htmlToBlocks(html);
  if (imported.rebuilt === 0) {
    return {
      doc,
      warnings: [
        "Couldn't rebuild any part of this HTML as components, so it stays in Code. To edit it in Design, write it as tsx with our components.",
      ],
    };
  }
  const keptWhole = imported.blocks.some((b) => b.type === "html" && isWholeEmailHtml(b.html));
  const next = EmailDocumentSchema.parse({
    ...doc,
    compositionMode: "designed",
    // Components get the brand shell; a whole email kept as HTML keeps the
    // stepped-aside fit so it isn't cropped.
    theme: keptWhole ? doc.theme : { ...doc.theme, ...BRAND_THEME, bodyBorder: undefined },
    blocks: imported.blocks,
  });
  const warnings = [
    `Rebuilt ${plural(imported.rebuilt, "part")} of the HTML as components; their inline styling (fonts, spacing, backgrounds) wasn't kept.`,
  ];
  if (imported.tables > 0) {
    warnings.push(`Unwrapped ${plural(imported.tables, "layout table")}: side-by-side columns now stack, and backgrounds or borders set on table cells were dropped.`);
  }
  if (imported.kept > 0) {
    warnings.push(`Kept ${plural(imported.kept, "part")} as raw HTML (no matching component); edit ${imported.kept === 1 ? "it" : "them"} in Code or replace ${imported.kept === 1 ? "it" : "them"} with components.`);
  }
  return { doc: next, warnings };
}

// Design / Code -> Simple: the Simple flattening (simplifyEmailDocument) with
// the Simple validator's plain-language report of what it changed.
function toSimple(doc: EmailDocument): TemplateConversion {
  const report = normalizeSimpleDocument(EmailDocumentSchema.parse({ ...doc, compositionMode: "simple" }));
  return { doc: simplifyEmailDocument(doc), warnings: report.changes };
}

/**
 * Convert a template document to another editor. Lossless where it can be
 * (Simple -> Design keeps every line), lossy otherwise with `warnings` saying
 * what changed. Same editor in, same document out.
 */
export function convertTemplateDocument(doc: EmailDocument, to: TemplateEditor): TemplateConversion {
  const from = templateEditor(doc);
  if (from === to) return { doc, warnings: [] };
  if (to === "simple") return toSimple(doc);
  if (from === "simple") {
    const designed = designEmailDocument(doc);
    return to === "design" ? { doc: designed, warnings: [] } : designToCode(designed);
  }
  return to === "code" ? designToCode(doc) : codeToDesign(doc);
}
