import * as z from "zod";

// Canonical email document model. This JSON is the SINGLE SOURCE OF TRUTH for a
// template: both the code editor and the visual builder produce/consume it, and
// the renderer compiles it to cross-client HTML. Keep it serializable and
// version it so stored documents can be migrated forward.

// ---------------------------------------------------------------------------
// Shared style tokens
// ---------------------------------------------------------------------------

// A color is any CSS color string; we keep it permissive (hex, rgb, named).
const Color = z.string();

const Align = z.enum(["left", "center", "right"]);

// ---------------------------------------------------------------------------
// Numeric coercion — tolerate the string forms the AI (and hand-authored TSX)
// naturally emit for numeric props.
// ---------------------------------------------------------------------------
// A numeric prop can arrive as a real number (visual editor, well-formed TSX
// `fontSize={16}`) OR as a STRING the model reaches for just as readily:
//   • a quoted number ...................... fontSize="16", width="50"
//   • a CSS length with a unit ............. fontSize="16px", width="480px"
//   • a value with stray whitespace ........ padding=" 8 "
// All of these mean the same number, so coercing them (instead of failing the
// whole template update with an opaque Zod union error) is the graceful,
// provider-expected behavior. Anything that ISN'T a clean number — an
// expression (`{12 + 4}`), a percentage we can't model, a keyword — is left
// UNTOUCHED so the field's own validation still rejects it (and the codec's
// prop-sanitizer can then drop just that one attribute rather than the block).
//
// Only a leading numeric run is taken, and only a trailing `px` unit is
// stripped; "50%" or "2rem" are intentionally NOT coerced (they're not the px
// integer the model means) so they fall through to be dropped, not silently
// misread.
function coerceNumeric(input: unknown): unknown {
  if (typeof input !== "string") return input;
  const trimmed = input.trim();
  if (trimmed === "") return input;
  // Pure number, optionally with a trailing `px` unit (case-insensitive).
  const m = /^(-?\d+(?:\.\d+)?)(?:px)?$/i.exec(trimmed);
  return m ? Number(m[1]) : input;
}

// Build a coercing numeric schema. `round` snaps a coerced float to an int for
// px fields declared `.int()` (a fractional pixel is harmless and far better
// than a hard parse failure), while genuinely non-integer props (lineHeight,
// letterSpacing) keep the raw number. The returned schema's OUTPUT type is
// preserved (a `number`, or the narrowed constraint the builder applies) so
// consumers keep their precise types.
function numeric<S extends z.ZodTypeAny>(
  build: (n: z.ZodNumber) => S,
  { round = false }: { round?: boolean } = {},
) {
  return z.preprocess((v) => {
    const c = coerceNumeric(v);
    return round && typeof c === "number" ? Math.round(c) : c;
  }, build(z.number()));
}

// px integer helpers (the overwhelmingly common shape): non-negative by
// default, positive/bounded variants as needed. Each coerces "16"/"16px" → 16.
const pxInt = () => numeric((n) => n.int().min(0), { round: true });
const pxIntPositive = () => numeric((n) => n.int().positive(), { round: true });
const pxIntMin1 = () => numeric((n) => n.int().min(1), { round: true });

// ---------------------------------------------------------------------------
// Shared component tokens — the SINGLE source of truth for defaults and the
// fixed style constants the renderer uses. Both the Zod schemas (.default()),
// the renderer (render.ts), and the component catalog (catalog.ts) read from
// here, so changing a value once updates the model, every rendered surface, and
// the docs together. Never inline these numbers anywhere else.
// ---------------------------------------------------------------------------

// Default per-block prop values. Keyed by block type → prop → value. These feed
// the schema `.default()`s below (so the canonical model uses them) and are
// surfaced in the docs/palette so the "default" shown is always the real one.
export const COMPONENT_DEFAULTS = {
  text: { align: "left", fontSize: 16, marginBottom: 16 },
  heading: { level: 2, align: "left", marginBottom: 16 },
  button: {
    text: "Click here",
    href: "#",
    align: "left",
    // Brand defaults: near-black (zinc-900) pill on white — matches the app's
    // primary action style and the sample-template brandButton. Applies to
    // NEWLY inserted buttons only — createBlock bakes these in at insert time;
    // stored buttons keep their persisted values, so existing emails are
    // unchanged.
    backgroundColor: "#18181b",
    textColor: "#ffffff",
    // Fully rounded (pill). 9999 renders as a capsule at any button height —
    // the internal visual guideline for primary actions.
    borderRadius: 9999,
    marginBottom: 16,
    // Inner padding of the button pill itself (the clickable area), distinct
    // from the block-level `padding`/`margin` which space the button WITHIN the
    // row. Named `innerPadding*` to avoid colliding with the container-style
    // `paddingX`/`paddingY` the SpacingSection reads as a fallback. Pills need
    // more horizontal air than the old 6px-radius rectangle, hence 32/12.
    innerPaddingX: 32,
    innerPaddingY: 12,
  },
  image: { align: "center", marginBottom: 16 },
  divider: { color: "#e4e4e7", marginBottom: 16 },
  link: { text: "Link text", href: "#", align: "left", fontSize: 16, marginBottom: 16 },
  spacer: { height: 24 },
  markdown: { align: "left", fontSize: 16, marginBottom: 16 },
  code: { backgroundColor: "#f4f4f5", color: "#1a1a1a", marginBottom: 16 },
  html: { marginBottom: 0 },
  section: { paddingX: 24, paddingY: 24 },
  column: { width: 50, paddingX: 8, paddingY: 0 },
  row: { columnGap: 8, stackOnMobile: true, paddingX: 24, paddingY: 8 },
} as const;

// Canonical vertical padding (px) for the MARKETING FOOTER band section. The
// footer builder (brandingToFooterFragment) sets this on the band, and
// normalizeMarketingFooterFragment repairs stale stored footers up to it on
// render, so both the newly-derived and the healed footer agree. Defined once
// here so the builder (apps/web) and the normalizer (this file) can never
// drift. See normalizeMarketingFooterFragment below.
export const MARKETING_FOOTER_BAND_PADDING_Y = 32;

// Fixed render-time style constants (not author-editable per block). The
// renderer is the only consumer, but they live here so visual changes are made
// in one obvious place and stay consistent across the canvas + sent email.
export const STYLE_TOKENS = {
  // Heading font-size (px) by level. The canvas and renderer both use this map.
  headingSize: { 1: 28, 2: 22, 3: 18, 4: 16 } as Record<1 | 2 | 3 | 4, number>,
  // Button typography. Inner padding is now per-button (innerPaddingX/Y on the
  // ButtonBlock); the legacy fixed value lives only in COMPONENT_DEFAULTS.button.
  buttonFontSize: 16,
  buttonFontWeight: "600",
  // Body line-height for text-like blocks.
  bodyLineHeight: "1.5",
  headingLineHeight: "1.3",
  // Monospace stack for code blocks.
  codeFontFamily:
    "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
  codeFontSize: "13px",
} as const;

// Free-form custom CSS declarations (e.g. "letter-spacing: 1px; opacity: 0.9;")
// merged as INLINE styles onto a block's root element so they survive every
// email client. Optional on every block.
const CustomCss = z.string();

// Tailwind utility classes (e.g. "bg-blue-500 px-4 text-white"). This is the
// CANONICAL authoring layer: the
// renderer compiles these to inline `style=` (+ a hoisted <head><style> for
// responsive/pseudo rules) via tw-compile.ts. It's an INPUT that lowers to the
// same inline-style output, so it composes with the legacy style props and
// customCss. Precedence (locked in render.ts): theme -> className (compiled) ->
// schema style props -> customCss (wins last). Optional on every block + the
// document, so v4 documents migrate forward with className simply absent.
const ClassName = z.string();

// ---------------------------------------------------------------------------
// Component instance link
// ---------------------------------------------------------------------------
// When a saved Component is inserted into a template, its TOP-LEVEL blocks are
// stamped with `componentRef` — a back-pointer to the Component they came from.
// This turns a plain block into a component INSTANCE (Figma/Webflow semantics):
//   • the canvas renders it with a distinct (violet) outline + the component
//     name, so authors can see at a glance what's a reusable component;
//   • an instance is LOCKED by default — its content can't be edited inline.
//     UNLOCKING it (componentRef.unlocked) makes it editable like a plain block
//     AND auto-saves every edit back to the source Component, propagating to the
//     other instances of that component in the same document (a live link while
//     unlocked). This mirrors Figma/Webflow "edit component".
//   • DETACHING an instance clears this ref entirely, turning it back into a
//     plain, independent block with no link (edits no longer propagate).
//
// It's optional + additive, so existing documents (and freshly-created blocks)
// simply have no ref and behave exactly as before. `name` is denormalized for a
// label that survives even if the source Component is later renamed/deleted.
export const ComponentRefSchema = z.object({
  // The source Component's id (the DB row). Used by "Save changes to component"
  // to know which Component to overwrite, and to group instances of one source.
  id: z.string(),
  // The source Component's name AT INSERT TIME — shown on the canvas badge and
  // in the inspector. Denormalized so the label is stable if the source is
  // renamed or deleted (the instance keeps reading sensibly either way).
  name: z.string().default(""),
  // When true the instance is UNLOCKED for editing: its content can be edited
  // inline like a plain block, and those edits are auto-saved back to the
  // source Component (and propagated to sibling instances in the same document)
  // while it stays linked. When false/absent the instance is LOCKED (read-only
  // chrome) — Figma/Webflow "edit component" semantics. This is transient
  // editing state, not part of the saved Component design; it's stripped by
  // stripComponentRefs along with the rest of the ref when detaching/saving.
  unlocked: z.boolean().optional(),
});
export type ComponentRef = z.infer<typeof ComponentRefSchema>;

// ---------------------------------------------------------------------------
// Box spacing (padding / margin)
// ---------------------------------------------------------------------------
// Per-side spacing in px. Every side is optional so a block can set only the
// sides it cares about; the renderer treats missing sides as 0 (for padding)
// or as the legacy fallback (for margin — see resolveMargin in render).
//
// This is the NEW, uniform spacing model shared by ALL blocks. It is additive
// and backward compatible: blocks still carry their legacy fields
// (`paddingX`/`paddingY` on containers, `marginBottom` on leaves). When a
// `padding`/`margin` object is present it WINS; otherwise the renderer falls
// back to the legacy fields so existing documents render byte-identically.
//
// The inspector offers two editing modes over this same object:
//   • "All sides" (uniform box) — writes the same value to all four sides.
//   • "Per side" — edits each side independently.
export const BoxSpacingSchema = z.object({
  top: pxInt().optional(),
  right: pxInt().optional(),
  bottom: pxInt().optional(),
  left: pxInt().optional(),
});
export type BoxSpacing = z.infer<typeof BoxSpacingSchema>;

// ---------------------------------------------------------------------------
// Border — optional container/image border. All fields optional and additive:
// a block with no `border` renders exactly as before. The renderer only emits
// a `border` declaration when a width > 0 is set; width/style/color/radius are
// independent so an author can round corners without a visible stroke, or add
// a stroke without rounding. Surfaced as first-class controls rather than
// only via a raw `style` blob.
// ---------------------------------------------------------------------------
export const BorderStyle = z.enum(["solid", "dashed", "dotted"]);
export const BorderSchema = z.object({
  // Stroke width in px. 0 / absent = no visible border (but a radius can still
  // round the container — useful for a filled, rounded, border-less card).
  width: pxInt().optional(),
  style: BorderStyle.optional(),
  color: Color.optional(),
  // Corner rounding in px. Independent of width so you can round without a stroke.
  radius: pxInt().optional(),
});
export type Border = z.infer<typeof BorderSchema>;

// ---------------------------------------------------------------------------
// Inline rich text
// ---------------------------------------------------------------------------
// Text & heading blocks can carry inline formatting (bold/italic/link/color/
// highlight) as an ordered list of "runs". Each run is a piece of text plus the
// marks applied to it. This is a flat run-list (not nested) which maps cleanly
// to ProseMirror inline content and to email-safe <span>/<a> output.
//
// Backward compatible: blocks still keep a plain `text` field (the concatenated
// run text). If `content` is absent, the block is plain text. Variable scanning
// and any plain consumers keep using `text`.
export const InlineMarkSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  // Hyperlink href ({{variables}} allowed). Presence means the run is a link.
  link: z.string().optional(),
  // Foreground text color (any CSS color).
  color: Color.optional(),
  // Highlight / background color behind the run.
  background: Color.optional(),
  // Font family (a CSS font stack — see FONT_STACKS) and size (px). These let an
  // inline run — including a variable token — carry its own typography, not just
  // the block default.
  fontFamily: z.string().optional(),
  fontSize: pxIntPositive().optional(),
});
export type InlineMark = z.infer<typeof InlineMarkSchema>;

export const InlineRunSchema = z.object({
  text: z.string().default(""),
  marks: InlineMarkSchema.optional(),
  // When present, this run is a VARIABLE TOKEN (not literal copy). The editor
  // renders it as a single clickable/styleable atom; `text` mirrors the
  // canonical "{{name}}" form so the renderer's interpolation and all plain
  // consumers (variable scanning, fallbacks) keep working unchanged. `marks`
  // still apply, so a variable can be bold/colored/etc. independently.
  variable: z.string().optional(),
});
export type InlineRun = z.infer<typeof InlineRunSchema>;

// Curated, email-safe font stacks. Email clients only reliably support a small
// set of fonts, so we offer a fixed list (matching the major ESPs) rather than
// arbitrary fonts. `value` is the CSS font-family stack; `label` is for the UI.
export const FONT_STACKS = [
  {
    label: "System default",
    value:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  {
    label: "Trebuchet MS",
    value: "'Trebuchet MS', 'Lucida Grande', sans-serif",
  },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
] as const;
export type FontStack = (typeof FONT_STACKS)[number]["value"];

// Theme applies document-wide defaults so blocks can stay terse.
export const ThemeSchema = z.object({
  fontFamily: z
    .string()
    .default("-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"),
  textColor: Color.default("#1a1a1a"),
  backgroundColor: Color.default("#f4f4f5"),
  bodyColor: Color.default("#ffffff"),
  linkColor: Color.default("#2563eb"),
  contentWidth: numeric((n) => n.int().positive(), { round: true }).default(600),
  // Inner padding (px) applied to the body container — the space between the
  // paper edge and the content. Defaults to 24 for comfortable reading; set to
  // 0 for edge-to-edge content. Applied identically in the canvas and renderer.
  //
  // `bodyPadding` is the legacy uniform value (one number, all four sides).
  // `bodyPaddingSides` is the new per-side override using the SAME BoxSpacing
  // model as block padding/margin; when present it WINS over bodyPadding, so
  // existing documents (which only have bodyPadding) render byte-identically.
  bodyPadding: pxInt().default(24),
  bodyPaddingSides: BoxSpacingSchema.optional(),
  // Corner radius (px) of the body "paper" card. 0 = square corners (the classic
  // full-bleed look); a positive value rounds the card. Applied to the container
  // in BOTH the canvas and the renderer. The managed marketing/compliance footer
  // is attached edge-to-edge at the BOTTOM of the card and inherits the bottom
  // corners, so a rounded body yields a rounded footer bottom with no seam.
  bodyRadius: pxInt().default(0),
});
export type Theme = z.infer<typeof ThemeSchema>;

// ---------------------------------------------------------------------------
// Blocks (the starter set). Each has a discriminating `type`.
// ---------------------------------------------------------------------------

// Text / Paragraph — inline-formatted body copy. Content may contain
// {{variables}} that are substituted at render time.
export const TextBlockSchema = z.object({
  type: z.literal("text"),
  id: z.string(),
  text: z.string().default(""),
  // Optional inline rich-text runs. When present, the renderer uses these
  // (mark-aware); `text` mirrors the concatenated plain text for fallback +
  // variable scanning.
  content: z.array(InlineRunSchema).optional(),
  align: Align.default(COMPONENT_DEFAULTS.text.align),
  color: Color.optional(),
  fontSize: pxIntPositive().default(COMPONENT_DEFAULTS.text.fontSize),
  // Optional per-block font override; falls back to the document theme font.
  fontFamily: z.string().optional(),
  // Optional typography overrides (all additive/optional so existing documents
  // render byte-identically — the renderer only emits them when set, otherwise
  // it keeps the fixed STYLE_TOKENS.bodyLineHeight / inherited weight/spacing).
  //   • lineHeight   — unitless multiplier (e.g. 1.5) or CSS length string.
  //   • letterSpacing — px tracking (e.g. 0.5); common for eyebrows/labels.
  //   • fontWeight   — CSS weight ("400".."700" / "normal" / "bold"). Accepts a
  //     bare number too (400 as well as "400") since that's the natural way
  //     to write a numeric weight in TSX (`font-weight={600}`) and the two are
  //     equivalent CSS — coerced to a string so the renderer/printer only deal
  //     with one representation.
  lineHeight: z.union([z.number(), z.string()]).optional(),
  letterSpacing: numeric((n) => n).optional(),
  fontWeight: z.union([z.string(), z.number()]).transform(String).optional(),
  // Vertical spacing below the block, in px.
  marginBottom: pxInt().default(COMPONENT_DEFAULTS.text.marginBottom),
  // Per-side overrides (new model). When present, they win over the legacy
  // marginBottom; padding adds inner spacing (leaves have none by default).
  margin: BoxSpacingSchema.optional(),
  padding: BoxSpacingSchema.optional(),
  customCss: CustomCss.optional(),
  className: ClassName.optional(),
  componentRef: ComponentRefSchema.optional(),
});
export type TextBlock = z.infer<typeof TextBlockSchema>;

export const HeadingBlockSchema = z.object({
  type: z.literal("heading"),
  id: z.string(),
  text: z.string().default(""),
  content: z.array(InlineRunSchema).optional(),
  level: z
    .preprocess(
      coerceNumeric,
      z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    )
    .default(COMPONENT_DEFAULTS.heading.level),
  // Optional explicit pixel size. When set it OVERRIDES the level-derived size
  // (STYLE_TOKENS.headingSize[level]); when absent the level default applies, so
  // existing headings render unchanged. Changing the level still rewrites this
  // to the new default size from the inspector.
  fontSize: pxIntPositive().optional(),
  align: Align.default(COMPONENT_DEFAULTS.heading.align),
  color: Color.optional(),
  fontFamily: z.string().optional(),
  // Optional typography overrides (additive/optional; see TextBlock). When
  // absent the renderer keeps STYLE_TOKENS.headingLineHeight and the default
  // 700 weight, so existing headings are unchanged.
  lineHeight: z.union([z.number(), z.string()]).optional(),
  letterSpacing: numeric((n) => n).optional(),
  // Accepts a bare number too (see TextBlockSchema) — coerced to a string.
  fontWeight: z.union([z.string(), z.number()]).transform(String).optional(),
  marginBottom: pxInt().default(COMPONENT_DEFAULTS.heading.marginBottom),
  margin: BoxSpacingSchema.optional(),
  padding: BoxSpacingSchema.optional(),
  customCss: CustomCss.optional(),
  className: ClassName.optional(),
  componentRef: ComponentRefSchema.optional(),
});
export type HeadingBlock = z.infer<typeof HeadingBlockSchema>;

export const ButtonBlockSchema = z.object({
  type: z.literal("button"),
  id: z.string(),
  text: z.string().default(COMPONENT_DEFAULTS.button.text),
  href: z.string().default(COMPONENT_DEFAULTS.button.href),
  align: Align.default(COMPONENT_DEFAULTS.button.align),
  backgroundColor: Color.default(COMPONENT_DEFAULTS.button.backgroundColor),
  textColor: Color.default(COMPONENT_DEFAULTS.button.textColor),
  borderRadius: pxInt().default(COMPONENT_DEFAULTS.button.borderRadius),
  // Inner padding of the button pill (the clickable area). Distinct from the
  // block-level `padding` (space around the button within the row). Defaults
  // match the legacy fixed token so older buttons are unchanged.
  innerPaddingX: pxInt().default(COMPONENT_DEFAULTS.button.innerPaddingX),
  innerPaddingY: pxInt().default(COMPONENT_DEFAULTS.button.innerPaddingY),
  marginBottom: pxInt().default(COMPONENT_DEFAULTS.button.marginBottom),
  margin: BoxSpacingSchema.optional(),
  padding: BoxSpacingSchema.optional(),
  customCss: CustomCss.optional(),
  className: ClassName.optional(),
  componentRef: ComponentRefSchema.optional(),
});
export type ButtonBlock = z.infer<typeof ButtonBlockSchema>;

export const ImageBlockSchema = z.object({
  type: z.literal("image"),
  id: z.string(),
  src: z.string().default(""),
  alt: z.string().default(""),
  href: z.string().optional(),
  // The CONTAINER (frame) width in px. The image scales to fill the frame
  // (width:100%, max-width:100%), so changing this resizes the box the image
  // lives in — not the image element directly. When absent the frame is full
  // content width.
  width: pxIntPositive().optional(),
  // Optional explicit FRAME height in px. When absent the frame height adapts
  // to the image's intrinsic aspect ratio (height auto) — overridable by
  // setting an explicit value. Set by the drag-resize handle / inspector.
  height: pxIntPositive().optional(),
  // Corner rounding (px). 0 = square corners (default).
  borderRadius: pxInt().optional(),
  // Optional stroke around the image frame (additive; radius here is redundant
  // with `borderRadius` above so the inspector maps its radius control to
  // `borderRadius` and uses `border` only for width/style/color).
  border: BorderSchema.optional(),
  // How the image fills the frame when an explicit height is set. Email-client
  // support is limited (documented caveat); only meaningful with a fixed height.
  objectFit: z.enum(["cover", "contain", "fill"]).optional(),
  // Frame background, shown around the image when object-fit leaves gaps
  // (e.g. "contain" letterboxing). Optional; transparent when unset.
  backgroundColor: Color.optional(),
  align: Align.default(COMPONENT_DEFAULTS.image.align),
  marginBottom: pxInt().default(COMPONENT_DEFAULTS.image.marginBottom),
  margin: BoxSpacingSchema.optional(),
  padding: BoxSpacingSchema.optional(),
  customCss: CustomCss.optional(),
  className: ClassName.optional(),
  componentRef: ComponentRefSchema.optional(),
});
export type ImageBlock = z.infer<typeof ImageBlockSchema>;

export const DividerBlockSchema = z.object({
  type: z.literal("divider"),
  id: z.string(),
  color: Color.default(COMPONENT_DEFAULTS.divider.color),
  marginBottom: pxInt().default(COMPONENT_DEFAULTS.divider.marginBottom),
  margin: BoxSpacingSchema.optional(),
  padding: BoxSpacingSchema.optional(),
  customCss: CustomCss.optional(),
  className: ClassName.optional(),
  componentRef: ComponentRefSchema.optional(),
});
export type DividerBlock = z.infer<typeof DividerBlockSchema>;

// Link — a standalone hyperlink. Distinct from a button:
// no padded background, just styled anchor text. Content may contain {{vars}}.
export const LinkBlockSchema = z.object({
  type: z.literal("link"),
  id: z.string(),
  text: z.string().default(COMPONENT_DEFAULTS.link.text),
  href: z.string().default(COMPONENT_DEFAULTS.link.href),
  align: Align.default(COMPONENT_DEFAULTS.link.align),
  color: Color.optional(),
  fontSize: pxIntPositive().default(COMPONENT_DEFAULTS.link.fontSize),
  // Optional per-block font override; falls back to the document theme font.
  fontFamily: z.string().optional(),
  // Whether the link text is underlined. Optional so existing links (which have
  // no stored value) keep the historical always-underlined look: the renderer
  // treats `undefined` as `true`. Setting it to `false` removes the underline;
  // `true` forces it.
  underline: z.boolean().optional(),
  marginBottom: pxInt().default(COMPONENT_DEFAULTS.link.marginBottom),
  margin: BoxSpacingSchema.optional(),
  padding: BoxSpacingSchema.optional(),
  customCss: CustomCss.optional(),
  className: ClassName.optional(),
  componentRef: ComponentRefSchema.optional(),
});
export type LinkBlock = z.infer<typeof LinkBlockSchema>;

// Spacer — vertical whitespace. Cross-client spacing is unreliable with
// margins alone, so this renders as an explicit fixed-height cell.
export const SpacerBlockSchema = z.object({
  type: z.literal("spacer"),
  id: z.string(),
  height: pxIntMin1().default(COMPONENT_DEFAULTS.spacer.height),
  margin: BoxSpacingSchema.optional(),
  customCss: CustomCss.optional(),
  className: ClassName.optional(),
  componentRef: ComponentRefSchema.optional(),
});
export type SpacerBlock = z.infer<typeof SpacerBlockSchema>;

// Markdown — authored as markdown, compiled to email-safe HTML at render time.
// Lets non-designers write rich copy without the block palette. {{vars}} work.
export const MarkdownBlockSchema = z.object({
  type: z.literal("markdown"),
  id: z.string(),
  markdown: z.string().default(""),
  align: Align.default(COMPONENT_DEFAULTS.markdown.align),
  color: Color.optional(),
  fontSize: pxIntPositive().default(COMPONENT_DEFAULTS.markdown.fontSize),
  marginBottom: pxInt().default(COMPONENT_DEFAULTS.markdown.marginBottom),
  margin: BoxSpacingSchema.optional(),
  padding: BoxSpacingSchema.optional(),
  customCss: CustomCss.optional(),
  className: ClassName.optional(),
  componentRef: ComponentRefSchema.optional(),
});
export type MarkdownBlock = z.infer<typeof MarkdownBlockSchema>;

// Code — monospace code block. Useful
// for transactional emails (API keys, snippets). Rendered verbatim, escaped.
export const CodeBlockSchema = z.object({
  type: z.literal("code"),
  id: z.string(),
  code: z.string().default(""),
  backgroundColor: Color.default(COMPONENT_DEFAULTS.code.backgroundColor),
  color: Color.default(COMPONENT_DEFAULTS.code.color),
  marginBottom: pxInt().default(COMPONENT_DEFAULTS.code.marginBottom),
  margin: BoxSpacingSchema.optional(),
  padding: BoxSpacingSchema.optional(),
  customCss: CustomCss.optional(),
  className: ClassName.optional(),
  componentRef: ComponentRefSchema.optional(),
});
export type CodeBlock = z.infer<typeof CodeBlockSchema>;

// Html — an OPAQUE block holding raw, user-authored HTML. This is the escape
// hatch that lets the visual editor stay lossless without locking users out of
// manual edits: anything the structured importer can't map to a known block
// (a wrapping <div>, a <table> layout, a pasted snippet) is preserved verbatim
// here. The renderer emits `html` as-is (NOT escaped — it IS markup), and the
// canvas renders it non-interactively (select/drag/delete, but no click-into).
export const HtmlBlockSchema = z.object({
  type: z.literal("html"),
  id: z.string(),
  html: z.string().default(""),
  marginBottom: pxInt().default(COMPONENT_DEFAULTS.html.marginBottom),
  margin: BoxSpacingSchema.optional(),
  padding: BoxSpacingSchema.optional(),
  customCss: CustomCss.optional(),
  className: ClassName.optional(),
  componentRef: ComponentRefSchema.optional(),
});
export type HtmlBlock = z.infer<typeof HtmlBlockSchema>;

// ---------------------------------------------------------------------------
// Leaf blocks — atomic content that can live directly in the body, in a
// Section, or in a Column. They never contain other blocks.
// ---------------------------------------------------------------------------
export const LeafBlockSchema = z.discriminatedUnion("type", [
  TextBlockSchema,
  HeadingBlockSchema,
  ButtonBlockSchema,
  ImageBlockSchema,
  DividerBlockSchema,
  LinkBlockSchema,
  SpacerBlockSchema,
  MarkdownBlockSchema,
  CodeBlockSchema,
  HtmlBlockSchema,
]);
export type LeafBlock = z.infer<typeof LeafBlockSchema>;

// Section — a layout container holding leaf blocks (and, since v3, nested
// Sections). It carries padding + background so the visual builder can group
// content. `children` is recursive via z.lazy to allow Section-in-Section.
export type SectionChild = LeafBlock | SectionBlock;
export const SectionBlockSchema: z.ZodType<SectionBlock> = z.lazy(() =>
  z.object({
    type: z.literal("section"),
    id: z.string(),
    backgroundColor: Color.optional(),
    border: BorderSchema.optional(),
    paddingX: pxInt().default(COMPONENT_DEFAULTS.section.paddingX),
    paddingY: pxInt().default(COMPONENT_DEFAULTS.section.paddingY),
    margin: BoxSpacingSchema.optional(),
    padding: BoxSpacingSchema.optional(),
    customCss: CustomCss.optional(),
    className: ClassName.optional(),
    children: z
      .array(z.union([LeafBlockSchema, SectionBlockSchema]))
      .default([]),
  }),
);
export type SectionBlock = {
  type: "section";
  id: string;
  backgroundColor?: string;
  border?: Border;
  paddingX: number;
  paddingY: number;
  margin?: BoxSpacing;
  padding?: BoxSpacing;
  customCss?: string;
  className?: string;
  componentRef?: ComponentRef;
  children: SectionChild[];
};

// Column — a vertical slice of a Row. Holds leaf blocks. `width` is a percentage
// (1-100) of the row; columns in a row should sum to ~100. Email columns are
// table cells, so this maps to a <td width="N%">.
export const ColumnBlockSchema = z.object({
  type: z.literal("column"),
  id: z.string(),
  width: numeric((n) => n.int().min(1).max(100), { round: true }).default(
    COMPONENT_DEFAULTS.column.width,
  ),
  backgroundColor: Color.optional(),
  border: BorderSchema.optional(),
  paddingX: pxInt().default(COMPONENT_DEFAULTS.column.paddingX),
  paddingY: pxInt().default(COMPONENT_DEFAULTS.column.paddingY),
  margin: BoxSpacingSchema.optional(),
  padding: BoxSpacingSchema.optional(),
  customCss: CustomCss.optional(),
  className: ClassName.optional(),
  componentRef: ComponentRefSchema.optional(),
  children: z.array(LeafBlockSchema).default([]),
});
export type ColumnBlock = z.infer<typeof ColumnBlockSchema>;

// Row — a horizontal multi-column container.
// This is the second level of nesting: Row > Column > leaf blocks. Renders as a
// single table row with one <td> per column so it survives Outlook.
export const RowBlockSchema = z.object({
  type: z.literal("row"),
  id: z.string(),
  backgroundColor: Color.optional(),
  border: BorderSchema.optional(),
  paddingX: pxInt().default(COMPONENT_DEFAULTS.row.paddingX),
  paddingY: pxInt().default(COMPONENT_DEFAULTS.row.paddingY),
  // Horizontal gap (px) between columns. Defaults to 8 for visual separation;
  // set to 0 for flush columns. Applied identically in the canvas and renderer.
  columnGap: pxInt().default(COMPONENT_DEFAULTS.row.columnGap),
  // `stackOnMobile` hints the renderer to allow columns to wrap on narrow
  // viewports (best-effort; pure-table emails stay side-by-side in Outlook).
  stackOnMobile: z.boolean().default(COMPONENT_DEFAULTS.row.stackOnMobile),
  margin: BoxSpacingSchema.optional(),
  padding: BoxSpacingSchema.optional(),
  customCss: CustomCss.optional(),
  className: ClassName.optional(),
  componentRef: ComponentRefSchema.optional(),
  columns: z.array(ColumnBlockSchema).default([]),
});
export type RowBlock = z.infer<typeof RowBlockSchema>;

// A top-level block is either a container (Section / Row) or a leaf block placed
// directly in the body. SectionBlockSchema is a z.lazy (recursive) schema, so we
// use z.union rather than z.discriminatedUnion (which requires object schemas).
export type Block = LeafBlock | SectionBlock | RowBlock;
export const BlockSchema: z.ZodType<Block> = z.union([
  SectionBlockSchema,
  RowBlockSchema,
  TextBlockSchema,
  HeadingBlockSchema,
  ButtonBlockSchema,
  ImageBlockSchema,
  DividerBlockSchema,
  LinkBlockSchema,
  SpacerBlockSchema,
  MarkdownBlockSchema,
  CodeBlockSchema,
  HtmlBlockSchema,
]);

// Leaf block type names — the atomic content blocks (no containers).
export const LEAF_BLOCK_TYPES = [
  "text",
  "heading",
  "button",
  "image",
  "divider",
  "link",
  "spacer",
  "markdown",
  "code",
  "html",
] as const;
export type LeafBlockType = (typeof LEAF_BLOCK_TYPES)[number];

export const BLOCK_TYPES = [
  "section",
  "row",
  ...LEAF_BLOCK_TYPES,
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

// ---------------------------------------------------------------------------
// Variable manifest — typed variables.
//
// A template declares the variables it expects (name, type, source). It does
// NOT carry per-variable defaults — a template is a shape, never a source of
// data. At send time every referenced variable must resolve from:
//   1. an explicit caller-supplied value (transactional `template.variables`,
//      or a system-token override the engine mints);
//   2. the recipient's contact row (built-in field or custom property) —
//      including workspace-level custom-field defaults, which fill in as if
//      they were a real contact value;
//   3. a per-campaign fill-only default (chosen in the pre-send report to
//      resolve a blocked send without clobbering contacts who already have a
//      value).
// A variable that resolves to none of the above is REPORTED AS MISSING and the
// send is blocked. Templates deliberately have no fallback slot: silent
// per-template defaults were shipping placeholder copy ("there", "Acme") to
// real recipients without any UI surfacing, so the field was removed and
// legacy stored values are stripped on load (see migrateDocument).
// ---------------------------------------------------------------------------
export const VARIABLE_TYPES = ["string", "number"] as const;
export type VariableType = (typeof VARIABLE_TYPES)[number];

// Where a variable's value comes from at send time:
//   - "input"   : supplied by the caller per send (transactional path) —
//                 1:1 system mail.
//   - "contact" : resolved from the recipient's Contact row (marketing/broadcast
//                 path). `contactField` names the source: a built-in field
//                 ("first_name", "last_name", "email") or a custom properties key.
// Both interpolate the SAME `{{name}}` token; they differ only in who fills it.
export const VARIABLE_SOURCES = ["input", "contact"] as const;
export type VariableSource = (typeof VARIABLE_SOURCES)[number];

// Built-in contact fields that always exist on a Contact. Custom properties
// are any other string key.
export const CONTACT_FIELDS = ["first_name", "last_name", "email"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

// System-minted token: a per-recipient one-click unsubscribe link the engine
// fills at send time. It is NOT a contact field and may never be declared as a
// user variable (declaring it would let a template inject a spoofed/static
// unsubscribe link over the real per-recipient one).
export const SYSTEM_VARIABLE_NAMES = ["unsubscribe_url"] as const;
export type SystemVariableName = (typeof SYSTEM_VARIABLE_NAMES)[number];

// All reserved names a user-declared variable can't *own* with arbitrary
// semantics. Matched case-insensitively. Built-in contact fields may still be
// referenced as {{first_name}} and declared — but only as `source: "contact"`
// (their built-in meaning); system tokens may not be declared at all. The send
// API also rejects supplying values for any of these via `template.variables`
// (see apps/web .../resources/email.ts:RESERVED_VARIABLE_NAMES — kept in sync).
export const RESERVED_VARIABLE_NAMES: readonly string[] = [
  ...CONTACT_FIELDS,
  ...SYSTEM_VARIABLE_NAMES,
];
const RESERVED_VARIABLE_NAME_SET = new Set<string>(RESERVED_VARIABLE_NAMES);
const SYSTEM_VARIABLE_NAME_SET = new Set<string>(SYSTEM_VARIABLE_NAMES);
const CONTACT_FIELD_SET = new Set<string>(CONTACT_FIELDS);

export function isReservedVariableName(name: string): boolean {
  return RESERVED_VARIABLE_NAME_SET.has(name.toLowerCase());
}
export function isSystemVariableName(name: string): boolean {
  return SYSTEM_VARIABLE_NAME_SET.has(name.toLowerCase());
}
export function isBuiltInContactField(name: string): boolean {
  return CONTACT_FIELD_SET.has(name.toLowerCase());
}

// Default styling baked onto a variable's *declaration*, so every insertion of
// that variable shares one look (color, background, typography, link). A single
// insertion can still override locally via its run marks. This is a subset of
// InlineMarkSchema (no per-instance link text — `href` is the link target).
export const VariableStyleSchema = z.object({
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  color: Color.optional(),
  background: Color.optional(),
  fontFamily: z.string().optional(),
  fontSize: pxIntPositive().optional(),
  // Hyperlink target. Variables ({{name}}) are allowed inside the href.
  href: z.string().optional(),
});
export type VariableStyle = z.infer<typeof VariableStyleSchema>;

export const VariableSchema = z.object({
  // The token name, e.g. "first_name" (referenced as {{first_name}}).
  name: z
    .string()
    .min(1)
    .regex(/^[\w.]+$/, "Variable names may use letters, numbers, _ and ."),
  type: z.enum(VARIABLE_TYPES).default("string"),
  // Value source (see VARIABLE_SOURCES). Defaults to caller-supplied input so
  // existing transactional templates are unaffected.
  source: z.enum(VARIABLE_SOURCES).default("input"),
  // For source === "contact": which contact field/property feeds the value.
  contactField: z.string().optional(),
  // Default styling applied to every insertion of this variable.
  style: VariableStyleSchema.optional(),
}).superRefine((v, ctx) => {
  // Reserved-name policy (enforced at template create/update through
  // EmailDocumentSchema, for both the dashboard and the public API).
  // A template may reference {{first_name}} etc., but it may
  // not REDECLARE a reserved name with conflicting semantics that would let it
  // override an identity/contact value or the system unsubscribe link.
  const lower = v.name.toLowerCase();

  // System tokens (unsubscribe_url) are minted per-recipient by the engine and
  // can never be a user-declared variable — declaring one (any source) would
  // let a template inject a spoofed or static unsubscribe link.
  if (SYSTEM_VARIABLE_NAME_SET.has(lower)) {
    ctx.addIssue({
      code: "custom",
      path: ["name"],
      message: `"${v.name}" is a reserved system variable filled automatically per recipient and can't be declared.`,
    });
    return;
  }

  // Built-in contact fields (first_name/last_name/email) may be declared, but
  // only with their built-in contact meaning — never as a caller-supplied
  // "input" variable (which would let a transactional send spoof the value).
  if (CONTACT_FIELD_SET.has(lower)) {
    const source = v.source ?? "input";
    if (source !== "contact") {
      ctx.addIssue({
        code: "custom",
        path: ["source"],
        message: `"${v.name}" is a reserved contact field and must use the "contact" value source (it's resolved per recipient, not supplied at send time).`,
      });
    }
    if (v.contactField !== undefined && v.contactField.toLowerCase() !== lower) {
      ctx.addIssue({
        code: "custom",
        path: ["contactField"],
        message: `"${v.name}" is a reserved contact field; it can't be remapped to "${v.contactField}".`,
      });
    }
  }
});
export type Variable = z.infer<typeof VariableSchema>;

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

// Templates serve two distinct purposes with different compliance rules:
//   - transactional: 1:1 system mail (receipts, OTP, password reset). No
//     unsubscribe legally required.
//   - marketing: bulk/promotional. Requires an unsubscribe mechanism + sender
//     postal address (CAN-SPAM / GDPR). The renderer enforces/warns on this.
export const TEMPLATE_CATEGORIES = ["transactional", "marketing"] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

// Bumped to 5: Tailwind `className` is now an optional authoring layer on every
// block, the document body, and component fragments. The renderer compiles it
// to inline styles (see tw-compile.ts). v1–v4 documents migrate forward
// transparently (see migrateDocument): className is additive/optional, so older
// blocks simply have no classes and render byte-identically from their legacy
// style props.
//
// History — v4: per-side `padding`/`margin` BoxSpacing overrides on every block
// (the spacing model). v1–v3 fall back to legacy paddingX/paddingY +
// marginBottom when those are absent.
export const CURRENT_DOCUMENT_VERSION = 5 as const;

export const EmailDocumentSchema = z.object({
  version: z.literal(CURRENT_DOCUMENT_VERSION).default(CURRENT_DOCUMENT_VERSION),
  // Inbox preview text (the snippet shown after the subject in most clients).
  // Injected as a hidden preheader span at the top of the body.
  previewText: z.string().default(""),
  category: z.enum(TEMPLATE_CATEGORIES).default("transactional"),
  // Per-template defaults for engagement tracking, split into independent
  // open and click flags. Optional: when unset, send-time
  // resolution falls back to the category default (marketing on, transactional
  // off). Explicit per-send open_tracking/click_tracking flags always override.
  // Kept optional/additive so existing documents need no migration. The legacy
  // single `tracking` field is retained for back-compat (documents authored
  // before the split); migrateDocument fans it out to both when the split
  // fields are absent, and send-time resolution still honors it as a fallback.
  openTracking: z.boolean().optional(),
  clickTracking: z.boolean().optional(),
  /** @deprecated Use openTracking + clickTracking. Retained for old documents. */
  tracking: z.boolean().optional(),
  // Optional default "From" address for this template (e.g. hello@mail.acme.com
  // or `Acme <hello@mail.acme.com>`). A convenience pre-selection surfaced in
  // the campaign flow; the campaign's own From always wins. Empty/absent means
  // "no default" — the sender is chosen at send time. We DON'T validate the
  // domain here (it may be deleted later); resolvers fall back to empty when it
  // can't be matched to a sendable domain.
  from: z.string().default(""),
  theme: ThemeSchema.default(ThemeSchema.parse({})),
  // Declared variables (typed). May be empty. Templates carry no per-variable
  // defaults — see the "Variable manifest" header block above.
  variables: z.array(VariableSchema).default([]),
  // Optional Tailwind classes applied to the body container (the "paper"). Same
  // compile path as block className; lets authors set page-wide utilities.
  className: ClassName.optional(),
  blocks: z.array(BlockSchema).default([]),
});
export type EmailDocument = z.infer<typeof EmailDocumentSchema>;

// ---------------------------------------------------------------------------
// Component fragment — a reusable, named slice of a document (one or more
// top-level blocks) that can be inserted into any template. This is the stored
// payload for the Component primitive (e.g. the system unsubscribe footer).
//
// It is a SUBTREE, not a full document: it has no theme/variables/category of
// its own — it inherits those from the host template at insert/render time.
// Like the document, every contained block keeps its own optional Tailwind
// `className`, so a fragment authored with Tailwind composes seamlessly once
// inserted. The optional `className` here applies to a wrapper the editor adds
// when the fragment is rendered standalone (preview).
// ---------------------------------------------------------------------------
export const ComponentFragmentSchema = z.object({
  // Schema version of the fragment payload; tracks the document version so a
  // fragment authored under v5 can be migrated alongside documents.
  version: z.literal(CURRENT_DOCUMENT_VERSION).default(CURRENT_DOCUMENT_VERSION),
  className: ClassName.optional(),
  blocks: z.array(BlockSchema).default([]),
});
export type ComponentFragment = z.infer<typeof ComponentFragmentSchema>;

// Migrate an older stored document forward to the current shape BEFORE parsing.
// Older docs (v1–v4) lack newer fields; we strip the stale version literal so
// the schema applies current defaults. Block shapes are forward-compatible (new
// fields like `className` are additive/optional), so no per-block rewriting is
// needed — older blocks render byte-identically from their legacy style props.
export function migrateDocument(input: unknown): unknown {
  if (input === null || typeof input !== "object") return input;
  const doc = input as Record<string, unknown>;
  // Fan out the legacy coupled `tracking` flag onto the split open/click fields
  // for any document that predates the split, regardless of version. The old
  // single toggle controlled BOTH the open pixel and link rewriting, so it maps
  // to both. We only fill a split field when it's absent so an explicitly-set
  // open/click value is never clobbered. `tracking` is left intact for any
  // legacy reader still keying off it.
  if (
    typeof doc.tracking === "boolean" &&
    doc.openTracking === undefined &&
    doc.clickTracking === undefined
  ) {
    doc.openTracking = doc.tracking;
    doc.clickTracking = doc.tracking;
  }
  const version = typeof doc.version === "number" ? doc.version : 1;
  // Normalize legacy reserved-variable declarations so older stored documents
  // still parse under the stricter VariableSchema. Without this, a template saved before the
  // rule — e.g. declaring {{first_name}} as `input`, or declaring the system
  // {{unsubscribe_url}} token — would fail safeParseDocument on load and get
  // silently replaced with an empty document. We coerce instead: built-in
  // contact fields become `contact`-sourced (their only valid form) and any
  // declaration of a system token is dropped (the engine mints it per
  // recipient; a bare {{unsubscribe_url}} reference in the body is untouched).
  //
  // Also strips the LEGACY per-template `fallback` string from every declared
  // variable. Templates no longer carry per-variable defaults (they were
  // shipping silent placeholder copy to real recipients without any UI
  // surfacing — see MESSAGING_MODEL.md §1.4). Older docs may still have the
  // field on disk; drop it here so VariableSchema (which no longer permits it)
  // parses the document cleanly, and the next save persists the migrated shape.
  if (Array.isArray(doc.variables)) {
    doc.variables = doc.variables
      .filter(
        (v) =>
          !(
            v !== null &&
            typeof v === "object" &&
            typeof (v as { name?: unknown }).name === "string" &&
            isSystemVariableName((v as { name: string }).name)
          ),
      )
      .map((v) => {
        if (
          v === null ||
          typeof v !== "object" ||
          typeof (v as { name?: unknown }).name !== "string"
        ) {
          return v;
        }
        // Drop the legacy per-template `fallback` on every variable, regardless
        // of source. Never carry it forward.
        const { fallback: _dropFallback, ...entry } = v as Record<
          string,
          unknown
        > & { fallback?: unknown };
        if (isBuiltInContactField(entry.name as string)) {
          return {
            ...entry,
            source: "contact",
            contactField: entry.name,
          };
        }
        return entry;
      });
  }
  if (version >= CURRENT_DOCUMENT_VERSION) return doc;
  // Drop the old version so EmailDocumentSchema fills the current default, and
  // let any newly-added fields fall to their schema defaults.
  const { version: _omit, ...rest } = doc;
  return rest;
}

// Safe-parse helper that also fills defaults and migrates older documents
// forward. Returns a typed document or throws with a readable message.
export function parseDocument(input: unknown): EmailDocument {
  return EmailDocumentSchema.parse(migrateDocument(input));
}

// Non-throwing variant (mirrors Zod's safeParse) that migrates first. Use this
// at boundaries that load possibly-old stored documents (DB `design` columns).
export function safeParseDocument(
  input: unknown,
): ReturnType<typeof EmailDocumentSchema.safeParse> {
  return EmailDocumentSchema.safeParse(migrateDocument(input));
}

// An empty starting document for new templates.
export function emptyDocument(): EmailDocument {
  return EmailDocumentSchema.parse({ blocks: [] });
}

// Parse a stored component fragment, migrating it forward (same strategy as
// documents: drop a stale version so the schema fills current defaults).
export function parseFragment(input: unknown): ComponentFragment {
  return ComponentFragmentSchema.parse(migrateDocument(input));
}

export function safeParseFragment(
  input: unknown,
): ReturnType<typeof ComponentFragmentSchema.safeParse> {
  return ComponentFragmentSchema.safeParse(migrateDocument(input));
}

// Normalize a STORED marketing-footer fragment for rendering.
//
// WHY: the workspace footer is a persisted snapshot (MarketingFooter.design),
// not re-derived on every send. Older footers were saved with a decorative
// LEADING rule — a `spacer` + `divider` pair above the fine print — that we've
// since removed from the canonical footer (it read as an ugly light hairline
// between the body and the black footer band, especially in Gmail light mode).
// Those stale rows keep shipping the divider until the workspace happens to
// re-save branding. This strips that legacy leading spacer/divider run so a
// stale stored footer renders like the current clean design — at the top level
// AND inside a single leading wrapper `section` (the shape the footer uses).
//
// It ONLY removes LEADING spacer/divider blocks (the pre-text rule); dividers
// that sit between real footer text lines are left untouched. Pure — returns a
// new fragment; input is not mutated.
//
// It ALSO heals a padding-less band: stored footers created before the band
// carried vertical padding shipped `padding:0px 0px` (no top/bottom breathing
// room around the fine print). For the leading top-level footer `section` (the
// band), when it has no per-side `padding` set and its `paddingY` is missing or
// 0, we coerce `paddingY` up to MARKETING_FOOTER_BAND_PADDING_Y — same
// "stale stored snapshot" rationale as the divider strip. `paddingX` is left
// untouched (the footer intentionally has no side padding).
export function normalizeMarketingFooterFragment(
  fragment: ComponentFragment,
): ComponentFragment {
  const isDecorative = (b: { type: string }) =>
    b.type === "spacer" || b.type === "divider";
  const dropLeading = <T extends { type: string }>(blocks: T[]): T[] => {
    let i = 0;
    while (i < blocks.length && isDecorative(blocks[i])) i++;
    return blocks.slice(i);
  };

  const blocks = fragment.blocks.map((b) => {
    if (b.type === "section") {
      return { ...b, children: dropLeading(b.children) };
    }
    return b;
  });

  const trimmed = dropLeading(blocks);

  // Repair the band's vertical padding on the LEADING top-level section only
  // (the footer band). Skip if it already carries an explicit per-side
  // `padding` (that wins in resolvePadding, so we must not clobber intent).
  const first = trimmed[0];
  if (
    first &&
    first.type === "section" &&
    !(first.padding && hasAnyPaddingSide(first.padding)) &&
    (first.paddingY === undefined || first.paddingY === 0)
  ) {
    const repaired = { ...first, paddingY: MARKETING_FOOTER_BAND_PADDING_Y };
    return { ...fragment, blocks: [repaired, ...trimmed.slice(1)] };
  }

  return { ...fragment, blocks: trimmed };
}

// True when a BoxSpacing has any explicit side set (mirrors render.ts's
// hasAnySide). Used by the footer normalizer to avoid clobbering a section that
// already carries per-side padding.
function hasAnyPaddingSide(s: {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}): boolean {
  return (
    s.top != null || s.right != null || s.bottom != null || s.left != null
  );
}

// Recursively strip `componentRef` from a block subtree. Used when SAVING a
// selection as a component (or updating one): the saved Component's design is a
// clean template, not itself an instance — so any instance tags inside the
// selection are dropped. Pure (returns a new object). Also used to "detach" an
// instance in the document by clearing the tag at the top level.
export function stripComponentRefs(block: unknown): unknown {
  if (block === null || typeof block !== "object") return block;
  if (Array.isArray(block)) return block.map(stripComponentRefs);
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(block as Record<string, unknown>)) {
    if (k === "componentRef") continue;
    next[k] =
      v && typeof v === "object" ? (stripComponentRefs(v) as unknown) : v;
  }
  return next;
}

// Build a ComponentFragment from a single selected block — the "Save as
// component" path in the editor. A container block (section/row) is saved as
// one top-level block (its children ride along). A bare COLUMN can't be a
// top-level fragment block (columns only live inside rows), so we unwrap it to
// its children. Leaf blocks save as a single-block fragment. Any nested
// `componentRef` instance tags are stripped so the saved component is a clean,
// reusable template (not itself an instance). The result is re-parsed so it's
// always a valid fragment.
export function blockToFragment(block: unknown): ComponentFragment {
  const cleaned = stripComponentRefs(block) as {
    type?: string;
    children?: unknown[];
  } | null;
  if (cleaned && cleaned.type === "column") {
    return ComponentFragmentSchema.parse({ blocks: cleaned.children ?? [] });
  }
  return ComponentFragmentSchema.parse({ blocks: cleaned ? [cleaned] : [] });
}

