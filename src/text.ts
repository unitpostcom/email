import { POWERED_BY_SENTINEL, POWERED_BY_TEXT } from "./brand-mark";
import sanitizeHtml from "sanitize-html";
import {
  normalizeMarketingFooterFragment,
  type Block,
  type ComponentFragment,
  type EmailDocument,
  type ImageBlock,
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
  // false: body links print their label only, never the URL (our own system
  // emails). "action": the same, except a button prints "Label: url" on one
  // line, for an email whose one action is that link (a team invite). The
  // marketing footer and the powered-by line are unaffected.
  links?: TextLinks;
};

export type TextLinks = boolean | "action";

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
      // Our own mark keeps its words and drops the URL — never "Sent with
      // Unitpost (https://www.unitpost.com?utm_source=…)". The pill links the
      // whole phrase; Simple's line links only "Unitpost" ("Sent with " sits
      // outside the <a>), so the label alone is right for both.
      if (href.includes(POWERED_BY_SENTINEL)) return label.replace(/\s+/g, " ") || POWERED_BY_TEXT;
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

function inlineRunsToText(runs: InlineRun[], vars: Vars, links: TextLinks): string {
  return runs
    .map((run) => {
      const label = interpolate(run.text, vars);
      if (links !== true) return label;
      const href = run.marks?.link
        ? safeUrl(interpolate(run.marks.link, vars)).trim()
        : "";
      if (!href || href === "#" || href === label) return label || href;
      return label ? `${label} (${href})` : href;
    })
    .join("");
}

function markdownToText(markdown: string, links: TextLinks): string {
  return cleanLines(
    markdown
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, links === true ? "$1 ($2)" : "$1")
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "• ")
      .replace(/^\s*(\d+)\.\s+/gm, "$1. ")
      .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, "$1$2")
      .replace(/\*([^*]+)\*|_([^_]+)_/g, "$1$2")
      .replace(/`([^`]+)`/g, "$1"),
  );
}

function leafToText(block: LeafBlock, vars: Vars, links: TextLinks): string {
  switch (block.type) {
    case "text":
    case "heading":
      return block.content?.length
        ? inlineRunsToText(block.content, vars, links)
        : interpolate(block.text, vars);
    case "list":
      return block.items
        .map((item, i) => {
          const line = item.content?.length
            ? inlineRunsToText(item.content, vars, links)
            : interpolate(item.text, vars);
          return `${block.ordered ? `${i + 1}.` : "•"} ${line}`;
        })
        .join("\n");
    case "button": {
      const label = interpolate(block.text, vars).trim();
      if (links === false) return label;
      const href = safeUrl(interpolate(block.href, vars)).trim();
      if (!href || href === "#" || href === label) return label || href;
      if (links === "action") return label ? `${label}: ${href}` : href;
      return label ? `${label}\n${href}` : href;
    }
    case "link": {
      const label = interpolate(block.text, vars).trim();
      if (links !== true) return label;
      const href = safeUrl(interpolate(block.href, vars)).trim();
      if (!href || href === "#" || href === label) return label || href;
      return label ? `${label} (${href})` : href;
    }
    case "image": {
      // Same "[image: alt]" convention as the HTML-to-text path (Gmail parity)
      // so a designed image and a raw <img> read identically in text/plain.
      const alt = interpolate(block.alt, vars).replace(/\s+/g, " ").trim();
      const label = alt ? `[image: ${alt}]` : "";
      if (links !== true) return label;
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
      return markdownToText(interpolate(block.markdown, vars), links);
    case "code":
      return interpolate(block.code, vars);
    case "html":
      return htmlToPlainText(interpolate(block.html, vars));
  }
}

// A Simple image is content the author pasted (a screenshot of a table, a
// photo), not decoration, so it always leaves its own line: Gmail's
// "[image: alt]", "[image]" when it has no alt, and the link it opens.
function simpleImageText(block: ImageBlock, vars: Vars, links: TextLinks): string {
  const alt = interpolate(block.alt, vars).replace(/\s+/g, " ").trim();
  const target = block.href ? safeUrl(interpolate(block.href, vars)).trim() : "";
  const link = links === true && target && target !== "#" ? target : "";
  // An empty placeholder (no picture, no words, no link) leaves nothing.
  if (!block.src.trim() && !alt && !link) return "";
  const label = alt ? `[image: ${alt}]` : "[image]";
  return link ? `${label} (${link})` : label;
}

function nodeToParts(
  block: Block | SectionChild,
  vars: Vars,
  links: TextLinks = true,
): string[] {
  if (block.type === "section") {
    return block.children.flatMap((child) => nodeToParts(child, vars, links));
  }
  if (block.type === "row") {
    return block.columns.flatMap((column) =>
      column.children.flatMap((child) => nodeToParts(child, vars, links)),
    );
  }
  const text = cleanLines(leafToText(block, vars, links));
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
 * retained (unless `links: false`), variables use the same resolved bag, and
 * marketing compliance is appended from the same footer fragment/variables as
 * the HTML renderer.
 */
export function renderToText(
  doc: EmailDocument,
  variables: Vars = {},
  options: TextRenderOptions = {},
): string {
  const simple = doc.compositionMode === "simple";
  const links = options.links ?? true;
  const parts = doc.blocks.flatMap((block) =>
    simple && block.type === "image"
      ? [simpleImageText(block, variables, links)].filter(Boolean)
      : nodeToParts(block, variables, links),
  );

  if (simple) {
    // Simple: the footer is ONE line, mirroring the HTML fragment's single
    // muted line — a signature, not a footer block.
    const fv: Vars = { company_name: "", company_address: "", ...variables, ...(options.footerVars ?? {}) };
    const pieces: string[] = [];
    if (doc.category === "marketing") {
      const who = [interpolate("{{company_name}}", fv).trim(), interpolate("{{company_address}}", fv).trim()]
        .filter((x) => x && !/^\{\{/.test(x))
        .join(", ");
      if (who) pieces.push(`Sent by ${who}`);
      const unsub = safeUrl(interpolate("{{unsubscribe_url}}", fv)).trim();
      if (unsub && unsub !== "{{unsubscribe_url}}") pieces.push(`Unsubscribe: ${unsub}`);
    }
    // The same one-line mark as every other text part (POWERED_BY_TEXT).
    if (options.showPoweredBy ?? true) pieces.push(POWERED_BY_TEXT);
    if (pieces.length) parts.push(pieces.join(" · "));
    return cleanLines(parts.filter(Boolean).join("\n\n"));
  }

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
    parts.push(POWERED_BY_TEXT);
  }

  return cleanLines(parts.filter(Boolean).join("\n\n"));
}
