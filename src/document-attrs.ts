import {
  EmailDocumentSchema,
  TEMPLATE_CATEGORIES,
  ThemeSchema,
  type EmailDocument,
  type Theme,
} from "./schema";

// The <Email> document element — the ONE place the page-level settings live in
// code: the theme (backdrop, paper, width, padding, radius, border, fonts,
// colors), the inbox preview text, the category, and the body className.
//
//   <Email background-color="#f5f5f4" body-color="#ffffff" content-width={560}
//          body-radius={16} body-padding={0} preview-text="…" category="marketing">
//     <Section>…</Section>
//   </Email>
//
// Before it existed the TSX dialect only encoded the block tree, so a one-shot
// branded design was impossible through the API, MCP or Ask Unit: the theme
// stayed whatever the template already had (2026-10-23, the October newsletter
// had to be patched through the dashboard). The element is optional — a bare
// block fragment still parses against the base document, as before — and both
// codecs read it: parseTsx (kebab-case attributes) and fromJsx (camelCase
// props on the React `Email` component).

// Theme keys an attribute may set directly (camelCase after kebabToCamel).
const THEME_KEYS = [
  "fontFamily",
  "textColor",
  "backgroundColor",
  "bodyColor",
  "linkColor",
  "contentWidth",
  "bodyPadding",
  "bodyRadius",
  "darkMode",
] as const satisfies readonly (keyof Theme)[];

const BORDER_KEYS = {
  bodyBorderWidth: "width",
  bodyBorderStyle: "style",
  bodyBorderColor: "color",
} as const;

const OTHER_KEYS = new Set(["previewText", "category", "className", "class", "tw", "theme", "bodyPaddingSides", "children"]);

/** Every attribute name the <Email> element accepts, kebab-case, for docs and errors. */
export const EMAIL_ELEMENT_ATTRIBUTES = [
  "background-color",
  "body-color",
  "content-width",
  "body-padding",
  "body-padding-sides",
  "body-radius",
  "body-border-width",
  "body-border-style",
  "body-border-color",
  "font-family",
  "text-color",
  "link-color",
  "dark-mode",
  "dark-colors",
  "preview-text",
  "category",
  "className",
] as const;

export type DocumentAttrsResult = {
  doc: EmailDocument;
  /** Attributes that were ignored or values that couldn't be used, in plain words. */
  warnings: string[];
};

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function numberish(v: unknown): unknown {
  if (typeof v === "string" && /^\s*-?\d+(\.\d+)?(px)?\s*$/i.test(v)) return Number(v.replace(/px/i, ""));
  return v;
}

/**
 * Apply the <Email> element's attributes (already camelCase) to a document.
 * Unknown attributes and invalid values are dropped one by one and reported —
 * a typo never fails the whole write, and never passes silently either.
 */
export function applyDocumentAttrs(
  doc: EmailDocument,
  attrs: Record<string, unknown>,
): DocumentAttrsResult {
  const warnings: string[] = [];
  const theme: Record<string, unknown> = { ...doc.theme };

  // `theme={{ … }}` (an object literal) is accepted too; flat attributes win.
  const nested = attrs.theme && typeof attrs.theme === "object" ? (attrs.theme as Record<string, unknown>) : {};
  const flat: Record<string, unknown> = { ...nested, ...attrs };
  delete flat.theme;

  const border: Record<string, unknown> = { ...(doc.theme.bodyBorder ?? {}) };
  let borderTouched = false;
  for (const [key, raw] of Object.entries(flat)) {
    if ((THEME_KEYS as readonly string[]).includes(key)) {
      theme[key] = numberish(raw);
    } else if (key in BORDER_KEYS) {
      border[BORDER_KEYS[key as keyof typeof BORDER_KEYS]] = key === "bodyBorderWidth" ? numberish(raw) : raw;
      borderTouched = true;
    } else if (key === "bodyBorder" && raw && typeof raw === "object") {
      Object.assign(border, raw);
      borderTouched = true;
    } else if (key === "darkColors" && raw && typeof raw === "object") {
      // The dark palette (`dark-colors={{ bodyColor: "#111111" }}`), checked
      // with the rest of the theme below; it used to be dropped silently
      // (verifier on #1056).
      theme.darkColors = { ...(doc.theme.darkColors ?? {}), ...(raw as Record<string, unknown>) };
    } else if (!OTHER_KEYS.has(key)) {
      warnings.push(`<Email> has no \`${kebab(key)}\` attribute; it was ignored.`);
    }
  }
  if (flat.bodyPaddingSides && typeof flat.bodyPaddingSides === "object") theme.bodyPaddingSides = flat.bodyPaddingSides;
  if (borderTouched) theme.bodyBorder = border;

  // Drop each invalid theme value (keeping the base value) instead of failing.
  let parsed = ThemeSchema.safeParse(theme);
  for (let i = 0; !parsed.success && i < 12; i++) {
    const bad = new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "")));
    for (const key of bad) {
      if (!key) continue;
      const fallback = (doc.theme as Record<string, unknown>)[key];
      warnings.push(`<Email> \`${kebab(key)}\` value isn't valid; ${fallback === undefined ? "it was ignored" : "the previous value was kept"}.`);
      if (fallback === undefined) delete theme[key];
      else theme[key] = fallback;
    }
    parsed = ThemeSchema.safeParse(theme);
  }

  const next: Record<string, unknown> = { ...doc, theme: parsed.success ? parsed.data : doc.theme };
  if (typeof flat.previewText === "string") next.previewText = flat.previewText;
  if (flat.category !== undefined) {
    if ((TEMPLATE_CATEGORIES as readonly unknown[]).includes(flat.category)) next.category = flat.category;
    else warnings.push(`<Email> \`category\` must be "transactional" or "marketing"; it was ignored.`);
  }
  const className = flat.className ?? flat.class ?? flat.tw;
  if (typeof className === "string") next.className = className.trim() || undefined;

  return { doc: EmailDocumentSchema.parse(next), warnings };
}

// `<` and `>` too: the TSX tokenizer ends a tag at the first `>`, so preview
// text like "Save > spend" must not print raw (verifier on #1036). The parser
// decodes all four (liftDocumentElement).
function attrString(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * The <Email …> opening tag that states a document's page-level settings.
 * `meta: false` leaves out preview-text and category (the theme only), for
 * designs meant to be adapted into another template, like the samples.
 */
export function printDocumentOpenTag(doc: EmailDocument, options: { meta?: boolean } = {}): string {
  const meta = options.meta ?? true;
  const t = doc.theme;
  const parts: string[] = [
    `background-color="${attrString(t.backgroundColor)}"`,
    `body-color="${attrString(t.bodyColor)}"`,
    `content-width={${t.contentWidth}}`,
    `body-padding={${t.bodyPadding}}`,
  ];
  if (t.bodyPaddingSides) {
    const s = t.bodyPaddingSides;
    const sides = (["top", "right", "bottom", "left"] as const)
      .filter((k) => typeof s[k] === "number")
      .map((k) => `${k}: ${s[k]}`)
      .join(", ");
    if (sides) parts.push(`body-padding-sides={{ ${sides} }}`);
  }
  parts.push(`body-radius={${t.bodyRadius}}`);
  if (t.bodyBorder) {
    if (typeof t.bodyBorder.width === "number") parts.push(`body-border-width={${t.bodyBorder.width}}`);
    if (t.bodyBorder.style) parts.push(`body-border-style="${t.bodyBorder.style}"`);
    if (t.bodyBorder.color) parts.push(`body-border-color="${attrString(t.bodyBorder.color)}"`);
  }
  parts.push(
    `font-family="${attrString(t.fontFamily)}"`,
    `text-color="${attrString(t.textColor)}"`,
    `link-color="${attrString(t.linkColor)}"`,
  );
  // Opt-in, so printed only when a theme states it ("auto" or "off").
  if (t.darkMode) parts.push(`dark-mode="${t.darkMode}"`);
  if (t.darkColors) {
    const c = t.darkColors;
    const colors = (["backgroundColor", "bodyColor", "textColor", "linkColor"] as const)
      .filter((k) => typeof c[k] === "string")
      .map((k) => `${k}: "${attrString(c[k]!)}"`)
      .join(", ");
    if (colors) parts.push(`dark-colors={{ ${colors} }}`);
  }
  if (meta && doc.previewText) parts.push(`preview-text="${attrString(doc.previewText)}"`);
  if (meta) parts.push(`category="${doc.category}"`);
  if (doc.className) parts.push(`className="${attrString(doc.className)}"`);
  return `<Email ${parts.join(" ")}>`;
}
