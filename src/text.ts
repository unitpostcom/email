import sanitizeHtml from "sanitize-html";
import {
  normalizeMarketingFooterFragment,
  type Block,
  type ComponentFragment,
  type EmailDocument,
  type InlineRun,
  type LeafBlock,
  type SectionChild,
} from "./schema";
import { safeUrl, sanitizeEmailHtml } from "./sanitize";
import { interpolate } from "./util";

type Vars = Record<string, string>;

export type TextRenderOptions = {
  marketingFooter?: ComponentFragment;
  footerVars?: Record<string, string>;
  showPoweredBy?: boolean;
};

function decodeEntities(value: string): string {
  const decodeCodePoint = (raw: string, radix: 10 | 16): string => {
    const point = Number.parseInt(raw, radix);
    return Number.isSafeInteger(point) && point >= 0 && point <= 0x10ffff
      ? String.fromCodePoint(point)
      : "�";
  };
  return value
    .replace(/&#(\d+);/g, (_match, digits: string) =>
      decodeCodePoint(digits, 10),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, digits: string) =>
      decodeCodePoint(digits, 16),
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function cleanLines(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Inline-CSS patterns that hide an element from the rendered email. Anything
// matching is invisible in the HTML variant, so it must not surface in the text
// variant either (the classic leak is the hidden inbox "preheader" span, which
// otherwise becomes the first line of the plain-text alternative).
const HIDDEN_STYLE =
  /display\s*:\s*none|visibility\s*:\s*hidden|mso-hide\s*:\s*all|opacity\s*:\s*0(?:[;\s]|$)|max-height\s*:\s*0(?:px)?(?:[;\s]|$)/i;

function isHiddenFrame(frame: sanitizeHtml.IFrame): boolean {
  const attribs = frame.attribs ?? {};
  // (The bare `hidden` attribute is stripped by sanitize-html before this
  // filter runs, so it can't be checked here; email templates hide via CSS.)
  if ((attribs["aria-hidden"] ?? "").toLowerCase() === "true") return true;
  if (HIDDEN_STYLE.test(attribs.style ?? "")) return true;
  // Common template-builder conventions for the hidden inbox snippet.
  return /(?:^|\s)(?:preheader|preview-text|hidden)(?:\s|$)/i.test(
    attribs.class ?? "",
  );
}

// Drop everything that never renders as visible body text: document metadata
// (<head>, <title>, <style>) and hidden elements with their contents. Tags
// themselves are all kept so the block-to-newline pass below still sees
// structure. Runs BEFORE sanitizeEmailHtml because that pass discards
// <head>/<title> tags while keeping their inner text.
// sanitize-html's `nonTextTags` only applies to tags that are NOT allowed, so
// with every tag allowed the metadata tags go through exclusiveFilter instead
// (true = drop the element together with its contents). `allowVulnerableTags`
// only silences the warning about <script>/<style> in `allowedTags`; both are
// removed here, and the output is reduced to text before anything consumes it.
const NON_VISIBLE_TAGS = new Set([
  "head",
  "title",
  "style",
  "script",
  "noscript",
  "template",
]);

function stripInvisible(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: false,
    allowedAttributes: false,
    allowVulnerableTags: true,
    exclusiveFilter: (frame) =>
      NON_VISIBLE_TAGS.has(frame.tag.toLowerCase()) || isHiddenFrame(frame),
  });
}

// Gmail's text/plain rendering of an inline image is "[image: <alt>]". Images
// with no alt (tracking pixels, spacers, decorative gifs) leave nothing behind.
function imagePlaceholder(tag: string): string {
  const match = /\balt\s*=\s*(["'])(.*?)\1/i.exec(tag);
  const alt = match
    ? decodeEntities(match[2]).replace(/\s+/g, " ").trim()
    : "";
  return alt ? `[image: ${alt}]` : "";
}

/** Convert a safe HTML fragment into readable text without pretending styles survive. */
export function htmlToPlainText(input: string): string {
  const safe = sanitizeEmailHtml(stripInvisible(input)).html.replace(
    /<img\b[^>]*>/gi,
    imagePlaceholder,
  );
  const linked = safe.replace(
    /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,
    (_match, _quote: string, rawHref: string, rawLabel: string) => {
      const label = decodeEntities(
        sanitizeHtml(rawLabel, { allowedTags: [], allowedAttributes: {} }),
      ).trim();
      const href = safeUrl(decodeEntities(rawHref)).trim();
      if (!href || href === "#" || href === label) return label || href;
      return label ? `${label} (${href})` : href;
    },
  );
  const withBreaks = linked
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    // Adjacent table cells collapse into one word ("Subtotal$10") without a
    // separator; a tab is normalized to a single space by cleanLines.
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<\/(?:p|div|h[1-6]|li|tr|table|blockquote|pre)>/gi, "\n")
    .replace(/<hr\b[^>]*>/gi, "\n———\n");
  return cleanLines(
    decodeEntities(
      sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} }),
    ),
  );
}

function inlineRunsToText(runs: InlineRun[], vars: Vars): string {
  return runs
    .map((run) => {
      const label = interpolate(run.text, vars);
      const href = run.marks?.link
        ? safeUrl(interpolate(run.marks.link, vars)).trim()
        : "";
      if (!href || href === "#" || href === label) return label || href;
      return label ? `${label} (${href})` : href;
    })
    .join("");
}

function markdownToText(markdown: string): string {
  return cleanLines(
    markdown
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "• ")
      .replace(/^\s*(\d+)\.\s+/gm, "$1. ")
      .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, "$1$2")
      .replace(/\*([^*]+)\*|_([^_]+)_/g, "$1$2")
      .replace(/`([^`]+)`/g, "$1"),
  );
}

function leafToText(block: LeafBlock, vars: Vars): string {
  switch (block.type) {
    case "text":
    case "heading":
      return block.content?.length
        ? inlineRunsToText(block.content, vars)
        : interpolate(block.text, vars);
    case "list":
      return block.items
        .map((item, i) => {
          const line = item.content?.length
            ? inlineRunsToText(item.content, vars)
            : interpolate(item.text, vars);
          return `${block.ordered ? `${i + 1}.` : "•"} ${line}`;
        })
        .join("\n");
    case "button": {
      const label = interpolate(block.text, vars).trim();
      const href = safeUrl(interpolate(block.href, vars)).trim();
      if (!href || href === "#" || href === label) return label || href;
      return label ? `${label}\n${href}` : href;
    }
    case "link": {
      const label = interpolate(block.text, vars).trim();
      const href = safeUrl(interpolate(block.href, vars)).trim();
      if (!href || href === "#" || href === label) return label || href;
      return label ? `${label} (${href})` : href;
    }
    case "image": {
      // Same "[image: alt]" convention as the HTML-to-text path (Gmail parity)
      // so a designed image and a raw <img> read identically in text/plain.
      const alt = interpolate(block.alt, vars).replace(/\s+/g, " ").trim();
      const label = alt ? `[image: ${alt}]` : "";
      const target = block.href
        ? safeUrl(interpolate(block.href, vars)).trim()
        : "";
      if (!target || target === "#") return label;
      return label ? `${label} (${target})` : target;
    }
    case "divider":
      return "———";
    case "spacer":
      return "";
    case "markdown":
      return markdownToText(interpolate(block.markdown, vars));
    case "code":
      return interpolate(block.code, vars);
    case "html":
      return htmlToPlainText(interpolate(block.html, vars));
  }
}

function nodeToParts(block: Block | SectionChild, vars: Vars): string[] {
  if (block.type === "section") {
    return block.children.flatMap((child) => nodeToParts(child, vars));
  }
  if (block.type === "row") {
    return block.columns.flatMap((column) =>
      column.children.flatMap((child) => nodeToParts(child, vars)),
    );
  }
  const text = cleanLines(leafToText(block, vars));
  return text ? [text] : [];
}

function fragmentToText(
  fragment: ComponentFragment,
  vars: Vars,
): string[] {
  return normalizeMarketingFooterFragment(fragment).blocks.flatMap((block) =>
    nodeToParts(block, vars),
  );
}

/**
 * Render the same versioned document used for HTML into its deterministic
 * text/plain MIME alternative. Formatting is removed, link destinations are
 * retained, variables use the same resolved bag, and marketing compliance is
 * appended from the same footer fragment/variables as the HTML renderer.
 */
export function renderToText(
  doc: EmailDocument,
  variables: Vars = {},
  options: TextRenderOptions = {},
): string {
  const parts = doc.blocks.flatMap((block) => nodeToParts(block, variables));

  if (doc.category === "marketing") {
    const footerVars: Vars = {
      company_name: "",
      company_address: "",
      ...variables,
      ...(options.footerVars ?? {}),
    };
    if (options.marketingFooter?.blocks.length) {
      parts.push(...fragmentToText(options.marketingFooter, footerVars));
    } else {
      const address = interpolate("{{company_address}}", footerVars).trim();
      const unsubscribe = safeUrl(
        interpolate("{{unsubscribe_url}}", footerVars),
      ).trim();
      parts.push("You are receiving this email because you opted in.");
      parts.push(
        unsubscribe && unsubscribe !== "{{unsubscribe_url}}"
          ? `Unsubscribe\n${unsubscribe}`
          : "Unsubscribe",
      );
      if (address && address !== "{{company_address}}") parts.push(address);
    }
  }

  if (options.showPoweredBy ?? true) {
    parts.push(
      "Powered by Unitpost\nhttps://www.unitpost.com?utm_source=email_footer&utm_medium=powered_by",
    );
  }

  return cleanLines(parts.filter(Boolean).join("\n\n"));
}
