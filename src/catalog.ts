// Component catalog — editorial metadata describing every component the
// constrained-TSX code editor understands (and that the visual builder maps
// onto). It powers three surfaces that must never drift apart:
//   1. the code-mode "insert component" pills (label, hover TLDR, props, the
//      snippet that gets inserted at the caret),
//   2. the public /components component-library reference, and
//   3. (future) the slash menu / inspector help text.
//
// SINGLE SOURCE OF TRUTH: this file does NOT re-declare prop defaults. Each prop
// references a block type + key, and its default is read from COMPONENT_DEFAULTS
// in schema.ts (the same constants the Zod schema and renderer use). So changing
// a default in one place updates the model, every rendered surface, AND the
// docs/tooltips together. `assertCatalogIntegrity()` (run in dev) fails loudly
// if the catalog and schema ever drift.
//
// The `snippet` for each component is written to round-trip cleanly through
// parseTsx/printTsx, so inserting a pill produces exactly the markup the parser
// expects. `{{variable}}` placeholders are intentional — they teach users the
// dynamic-data syntax.

import { COMPONENT_DEFAULTS, type BlockType } from "./schema";

export type ComponentPropType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "color"
  | "url"
  | "css";

export type ComponentProp = {
  // Attribute name as written in code (kebab-case in TSX, e.g. "margin-bottom").
  name: string;
  type: ComponentPropType;
  // Allowed values for enum props (rendered in docs).
  values?: readonly string[];
  // The schema key this prop maps to (camelCase, e.g. "marginBottom"). When set,
  // the displayed default is read from COMPONENT_DEFAULTS so docs can't drift.
  // Omit for props with no model default (e.g. optional color overrides).
  defaultKey?: string;
  // Explicit default override (rare — only when not derivable from the schema).
  default?: string;
  required?: boolean;
  description: string;
};

export type ComponentDoc = {
  // The component tag, e.g. "Section". Matches the TSX <Tag> used in code mode.
  tag: string;
  // The canonical block type this maps to (used to resolve defaults + validate
  // the catalog against the schema). "column" is a sub-block of a row.
  blockType: BlockType | "column";
  // URL-safe slug for deep-linking into /components#<slug>.
  slug: string;
  // One-line TLDR shown on hover and as the docs subtitle.
  summary: string;
  // Grouping for the docs nav + the pill rail.
  group: "Layout" | "Content" | "Media" | "Interactive" | "Advanced";
  // Whether the tag wraps children (vs. a self-closing / text-bearing leaf).
  container?: boolean;
  // Markup inserted when the pill is clicked. Round-trips through the codec.
  snippet: string;
  props: readonly ComponentProp[];
  // Longer prose for the docs page (optional; falls back to `summary`).
  details?: string;
};

// Resolve a prop's display default: explicit override wins, otherwise read it
// from the shared COMPONENT_DEFAULTS by block type + key. Returns undefined when
// the prop has no model default (so docs render "—").
export function resolvePropDefault(
  doc: ComponentDoc,
  prop: ComponentProp,
): string | undefined {
  if (prop.default !== undefined) return prop.default;
  if (!prop.defaultKey) return undefined;
  const defs = (COMPONENT_DEFAULTS as Record<string, Record<string, unknown>>)[
    doc.blockType
  ];
  const value = defs?.[prop.defaultKey];
  return value === undefined ? undefined : String(value);
}

// Props shared by virtually every block. Kept here so each entry stays focused
// on what's unique to it; the docs page appends these under "Common props".
export const COMMON_PROPS: readonly ComponentProp[] = [
  {
    name: "margin-bottom",
    type: "number",
    default: "16",
    description: "Vertical space (px) below the block.",
  },
  {
    name: "className",
    type: "string",
    description:
      "Tailwind-style utility classes compiled to inline CSS at render (e.g. \"mt-4 text-zinc-500 sm:hidden\"). Responsive/pseudo variants are hoisted into a <style> block. `class` and `tw` are accepted as aliases in code.",
  },
  {
    name: "custom-css",
    type: "css",
    description:
      "Extra inline CSS declarations merged onto the block's root element (e.g. \"letter-spacing: 1px; opacity: 0.9\"). Inlined so it survives every client.",
  },
];

// Border props shared by the container blocks (Section/Row/Column) and Image.
// The model stores a nested `border` object; the TSX codec flattens it into
// these scalar attributes (and reassembles it on parse), so they're fully
// expressible in code mode.
const BORDER_PROPS: readonly ComponentProp[] = [
  {
    name: "border-width",
    type: "number",
    description: "Border stroke width (px). 0/absent = no visible border.",
  },
  {
    name: "border-style",
    type: "enum",
    values: ["solid", "dashed", "dotted"],
    description: "Border stroke style.",
  },
  { name: "border-color", type: "color", description: "Border stroke color." },
  {
    name: "border-radius",
    type: "number",
    description:
      "Corner rounding (px). Independent of width — round a filled card without a stroke.",
  },
];

const ALIGN_VALUES = ["left", "center", "right"] as const;

export const COMPONENT_CATALOG: readonly ComponentDoc[] = [
  {
    tag: "Section",
    blockType: "section",
    slug: "section",
    summary: "A padded layout container that groups blocks with a background.",
    group: "Layout",
    container: true,
    snippet: `<Section padding-x={24} padding-y={24}>
  <Text>Grouped content</Text>
</Section>`,
    details:
      "Use a Section to band content together — a hero, a card, a footer. It can hold any leaf block and can be nested inside another Section.",
    props: [
      {
        name: "background-color",
        type: "color",
        description: "Fill color behind the section.",
      },
      {
        name: "padding-x",
        type: "number",
        defaultKey: "paddingX",
        description: "Horizontal inner padding (px).",
      },
      {
        name: "padding-y",
        type: "number",
        defaultKey: "paddingY",
        description: "Vertical inner padding (px).",
      },
      ...BORDER_PROPS,
    ],
  },
  {
    tag: "Row",
    blockType: "row",
    slug: "row",
    summary: "A multi-column container — holds <Column> children side by side.",
    group: "Layout",
    container: true,
    snippet: `<Row column-gap={8}>
  <Column width={50}>
    <Text>Left</Text>
  </Column>
  <Column width={50}>
    <Text>Right</Text>
  </Column>
</Row>`,
    details:
      "Rows render as a single table row with one cell per column, so they stay side-by-side even in Outlook. A Row may only contain Column components.",
    props: [
      {
        name: "column-gap",
        type: "number",
        defaultKey: "columnGap",
        description: "Horizontal gap (px) between columns. Set 0 for flush.",
      },
      {
        name: "stack-on-mobile",
        type: "boolean",
        defaultKey: "stackOnMobile",
        description:
          "Best-effort: let columns wrap on narrow viewports (table emails stay side-by-side in Outlook).",
      },
      {
        name: "background-color",
        type: "color",
        description: "Fill color behind the row.",
      },
      {
        name: "padding-x",
        type: "number",
        defaultKey: "paddingX",
        description: "Horizontal inner padding (px).",
      },
      {
        name: "padding-y",
        type: "number",
        defaultKey: "paddingY",
        description: "Vertical inner padding (px).",
      },
      ...BORDER_PROPS,
    ],
  },
  {
    tag: "Column",
    blockType: "column",
    slug: "column",
    summary: "A vertical slice of a Row. Only valid inside <Row>.",
    group: "Layout",
    container: true,
    snippet: `<Column width={50}>
  <Text>Column content</Text>
</Column>`,
    details:
      "Columns are table cells. `width` is a percentage of the row; the widths of the columns in a row should add up to ~100.",
    props: [
      {
        name: "width",
        type: "number",
        defaultKey: "width",
        description: "Width as a percentage (1–100) of the parent Row.",
      },
      {
        name: "background-color",
        type: "color",
        description: "Fill color behind the column.",
      },
      {
        name: "padding-x",
        type: "number",
        defaultKey: "paddingX",
        description: "Horizontal inner padding (px).",
      },
      {
        name: "padding-y",
        type: "number",
        defaultKey: "paddingY",
        description: "Vertical inner padding (px).",
      },
      ...BORDER_PROPS,
    ],
  },
  {
    tag: "Heading",
    blockType: "heading",
    slug: "heading",
    summary: "A title (H1–H4). Inner text supports {{variables}}.",
    group: "Content",
    snippet: `<Heading level={2}>Welcome, {{first_name}}</Heading>`,
    props: [
      {
        name: "level",
        type: "enum",
        values: ["1", "2", "3", "4"],
        defaultKey: "level",
        description: "Heading level — controls size/weight.",
      },
      {
        name: "align",
        type: "enum",
        values: ALIGN_VALUES,
        defaultKey: "align",
        description: "Text alignment.",
      },
      { name: "color", type: "color", description: "Text color." },
      {
        name: "font-size",
        type: "number",
        description:
          "Font size (px). Overrides the level's default size (28/22/18/16 for H1–H4).",
      },
      {
        name: "font-family",
        type: "string",
        description: "Override the document font for this heading.",
      },
      {
        name: "font-weight",
        type: "string",
        description:
          "Font weight (e.g. 400, 600, 700). Overrides the default bold heading weight.",
      },
      {
        name: "line-height",
        type: "string",
        description: "Line height — a unitless multiplier (e.g. 1.3) or CSS length.",
      },
      {
        name: "letter-spacing",
        type: "number",
        description: "Letter spacing (tracking) in px. Great for eyebrow labels.",
      },
    ],
  },
  {
    tag: "Text",
    blockType: "text",
    slug: "text",
    summary: "A paragraph of body copy. Supports inline marks and {{variables}}.",
    group: "Content",
    snippet: `<Text>Hi {{first_name}}, thanks for signing up.</Text>`,
    details:
      "Inner content may include inline HTML for formatting: <strong>, <em>, <u>, <a href>, and <span style> (color / background-color). These round-trip through the visual editor.",
    props: [
      {
        name: "align",
        type: "enum",
        values: ALIGN_VALUES,
        defaultKey: "align",
        description: "Text alignment.",
      },
      { name: "color", type: "color", description: "Text color." },
      {
        name: "font-size",
        type: "number",
        defaultKey: "fontSize",
        description: "Font size (px).",
      },
      {
        name: "font-family",
        type: "string",
        description: "Override the document font for this block.",
      },
      {
        name: "font-weight",
        type: "string",
        description: "Font weight (e.g. 400, 500, 600, 700).",
      },
      {
        name: "line-height",
        type: "string",
        description: "Line height — a unitless multiplier (e.g. 1.5) or CSS length.",
      },
      {
        name: "letter-spacing",
        type: "number",
        description: "Letter spacing (tracking) in px.",
      },
    ],
  },
  {
    tag: "Button",
    blockType: "button",
    slug: "button",
    summary: "A call-to-action — a styled, padded link that looks like a button.",
    group: "Interactive",
    snippet: `<Button href="https://example.com/verify?token={{token}}">Verify email</Button>`,
    props: [
      {
        name: "href",
        type: "url",
        defaultKey: "href",
        required: true,
        description: "Destination URL. {{variables}} are allowed.",
      },
      {
        name: "align",
        type: "enum",
        values: ALIGN_VALUES,
        defaultKey: "align",
        description: "Horizontal alignment of the button.",
      },
      {
        name: "background-color",
        type: "color",
        defaultKey: "backgroundColor",
        description: "Button fill color.",
      },
      {
        name: "text-color",
        type: "color",
        defaultKey: "textColor",
        description: "Label color.",
      },
      {
        name: "border-radius",
        type: "number",
        defaultKey: "borderRadius",
        description: "Corner radius (px).",
      },
      {
        name: "inner-padding-x",
        type: "number",
        defaultKey: "innerPaddingX",
        description: "Horizontal padding inside the button (px).",
      },
      {
        name: "inner-padding-y",
        type: "number",
        defaultKey: "innerPaddingY",
        description: "Vertical padding inside the button (px).",
      },
    ],
  },
  {
    tag: "Link",
    blockType: "link",
    slug: "link",
    summary: "A standalone styled hyperlink (no button background).",
    group: "Interactive",
    snippet: `<Link href="https://example.com/reset-password?u={{user_id}}">Reset password</Link>`,
    props: [
      {
        name: "href",
        type: "url",
        defaultKey: "href",
        required: true,
        description: "Destination URL. {{variables}} are allowed.",
      },
      {
        name: "align",
        type: "enum",
        values: ALIGN_VALUES,
        defaultKey: "align",
        description: "Alignment.",
      },
      { name: "color", type: "color", description: "Link color." },
      {
        name: "font-size",
        type: "number",
        defaultKey: "fontSize",
        description: "Font size (px).",
      },
      {
        name: "font-family",
        type: "string",
        description: "Override the document font for this link.",
      },
      {
        name: "underline",
        type: "boolean",
        default: "true",
        description:
          "Whether the link is underlined. Defaults to underlined; set false to remove it.",
      },
    ],
  },
  {
    tag: "Image",
    blockType: "image",
    slug: "image",
    summary: "A responsive image, optionally wrapped in a link.",
    group: "Media",
    snippet: `<Image src="https://www.unitpost.com/web-app-manifest-192x192.png" alt="Logo" width={120} />`,
    props: [
      {
        name: "src",
        type: "url",
        required: true,
        description: "Image URL (use an absolute, hosted URL).",
      },
      {
        name: "alt",
        type: "string",
        description: "Alternative text (shown if the image can't load).",
      },
      {
        name: "href",
        type: "url",
        description: "Make the image a link to this URL.",
      },
      {
        name: "width",
        type: "number",
        description:
          "Container (frame) width in px. The image scales to fill it; defaults to full content width.",
      },
      {
        name: "height",
        type: "number",
        description:
          "Optional frame height in px. By default the height adapts to the image's aspect ratio — set this to pin an explicit height.",
      },
      {
        name: "objectFit",
        type: "enum",
        values: ["cover", "contain", "fill"],
        description:
          "How the image fills the frame when a height is set: cover (crop), contain (letterbox), or fill (stretch). Client support varies.",
      },
      {
        name: "backgroundColor",
        type: "color",
        description:
          "Frame background shown around the image when “contain” leaves gaps.",
      },
      {
        name: "borderRadius",
        type: "number",
        description: "Corner rounding in px.",
      },
      {
        name: "align",
        type: "enum",
        values: ALIGN_VALUES,
        defaultKey: "align",
        description: "Horizontal alignment.",
      },
      {
        name: "border-width",
        type: "number",
        description: "Frame border stroke width (px).",
      },
      {
        name: "border-style",
        type: "enum",
        values: ["solid", "dashed", "dotted"],
        description: "Frame border stroke style.",
      },
      {
        name: "border-color",
        type: "color",
        description: "Frame border stroke color.",
      },
    ],
  },
  {
    tag: "Divider",
    blockType: "divider",
    slug: "divider",
    summary: "A thin horizontal rule to separate sections.",
    group: "Content",
    snippet: `<Divider />`,
    props: [
      {
        name: "color",
        type: "color",
        defaultKey: "color",
        description: "Line color.",
      },
    ],
  },
  {
    tag: "Spacer",
    blockType: "spacer",
    slug: "spacer",
    summary: "Fixed vertical whitespace (a reliable cross-client gap).",
    group: "Content",
    snippet: `<Spacer height={24} />`,
    details:
      "Margins are unreliable across clients, so a Spacer renders as an explicit fixed-height cell.",
    props: [
      {
        name: "height",
        type: "number",
        defaultKey: "height",
        required: true,
        description: "Gap height (px).",
      },
    ],
  },
  {
    tag: "Markdown",
    blockType: "markdown",
    slug: "markdown",
    summary: "Author rich copy in Markdown — compiled to email-safe HTML.",
    group: "Content",
    snippet: `<Markdown>**Welcome!** Here's _what's new_ this week. [See all](https://example.com)</Markdown>`,
    props: [
      {
        name: "align",
        type: "enum",
        values: ALIGN_VALUES,
        defaultKey: "align",
        description: "Alignment.",
      },
      { name: "color", type: "color", description: "Base text color." },
      {
        name: "font-size",
        type: "number",
        defaultKey: "fontSize",
        description: "Base font size (px).",
      },
    ],
  },
  {
    tag: "Code",
    blockType: "code",
    slug: "code",
    summary: "A monospace code block — handy for API keys and snippets.",
    group: "Content",
    snippet: `<Code>npm install @unitpost/email</Code>`,
    props: [
      {
        name: "background-color",
        type: "color",
        defaultKey: "backgroundColor",
        description: "Block background.",
      },
      {
        name: "color",
        type: "color",
        defaultKey: "color",
        description: "Code text color.",
      },
    ],
  },
  {
    // The raw-HTML escape hatch. Unlike every other entry there is no <Html>
    // component tag: in code mode ANY unknown markup (a <table>, a <div>, a
    // pasted snippet) is preserved verbatim as an html block, and printTsx
    // emits the stored markup bare. Documented here so the /components docs,
    // the editor palette, and AI tooling all describe the block; the codec
    // needs no tag for it.
    tag: "Html",
    blockType: "html",
    slug: "html",
    summary:
      "A raw HTML escape hatch — pasted markup is preserved verbatim (sanitized).",
    group: "Advanced",
    snippet: `<table role="presentation" width="100%"><tr><td>Custom markup</td></tr></table>`,
    details:
      "There's no <Html> tag in code mode — any markup that isn't a known component (e.g. a <table> or <div>) automatically becomes an Html block and is emitted verbatim at render. Content passes through the 3-layer HTML sanitizer (scripts, event handlers, and javascript: URLs are stripped) both on save and at render. {{variables}} interpolate inside the markup. Prefer the built-in components when possible — raw HTML is on you to keep Outlook-safe.",
    props: [],
  },
];

// Lookup by tag (case-insensitive), used by the editor's insert + hover UI.
export function getComponentDoc(tag: string): ComponentDoc | undefined {
  const lower = tag.toLowerCase();
  return COMPONENT_CATALOG.find((c) => c.tag.toLowerCase() === lower);
}

// Stable group order for rendering nav / pill rails.
export const COMPONENT_GROUPS = [
  "Layout",
  "Content",
  "Media",
  "Interactive",
  "Advanced",
] as const;

// ---------------------------------------------------------------------------
// Drift guard. The catalog is editorial metadata layered over the schema; this
// asserts the two never diverge. It checks that:
//   • every catalog entry maps to a real block type with shared defaults, and
//   • every prop declaring a `defaultKey` actually resolves to a value.
// Returns the list of problems (empty when consistent). `assertCatalogIntegrity`
// throws — we run it on module load in dev so a bad edit fails fast instead of
// silently shipping stale docs/tooltips.
// ---------------------------------------------------------------------------
export function checkCatalogIntegrity(): string[] {
  const problems: string[] = [];
  const knownTypes = new Set(Object.keys(COMPONENT_DEFAULTS));
  for (const doc of COMPONENT_CATALOG) {
    if (!knownTypes.has(doc.blockType)) {
      problems.push(
        `<${doc.tag}>: blockType "${doc.blockType}" has no entry in COMPONENT_DEFAULTS.`,
      );
      continue;
    }
    const defs = (COMPONENT_DEFAULTS as Record<string, Record<string, unknown>>)[
      doc.blockType
    ];
    for (const prop of doc.props) {
      if (prop.defaultKey && defs[prop.defaultKey] === undefined) {
        problems.push(
          `<${doc.tag}>.${prop.name}: defaultKey "${prop.defaultKey}" is not in COMPONENT_DEFAULTS.${doc.blockType}.`,
        );
      }
    }
  }
  return problems;
}

export function assertCatalogIntegrity(): void {
  const problems = checkCatalogIntegrity();
  if (problems.length) {
    throw new Error(
      `Component catalog is out of sync with the schema:\n  - ${problems.join("\n  - ")}`,
    );
  }
}

// Fail fast in development (skipped in production builds to avoid any overhead).
if (process.env.NODE_ENV !== "production") {
  assertCatalogIntegrity();
}
