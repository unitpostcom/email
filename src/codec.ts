import {
  BlockSchema,
  ButtonBlockSchema,
  CodeBlockSchema,
  ColumnBlockSchema,
  DividerBlockSchema,
  HeadingBlockSchema,
  HtmlBlockSchema,
  ImageBlockSchema,
  LeafBlockSchema,
  LinkBlockSchema,
  MarkdownBlockSchema,
  RowBlockSchema,
  SectionBlockSchema,
  SpacerBlockSchema,
  TextBlockSchema,
  EmailDocumentSchema,
  type Block,
  type ColumnBlock,
  type ComponentFragment,
  type EmailDocument,
  type InlineRun,
  type LeafBlock,
  type SectionBlock,
  type SectionChild,
} from "./schema";
import { newBlockId } from "./blocks";

// Constrained TSX <-> JSON codec.
//
// The "code mode" editor speaks a RESTRICTED JSX dialect: only our components,
// attributes map to block props, and dynamic data uses {{variable}} (no JS
// expressions, loops, or conditionals). Because the grammar is constrained,
// parseTsx -> JSON is reliable and printTsx -> string is a clean pretty-print,
// so both editors round-trip against the same canonical document.
//
// Component <-> block-type mapping:
//   <Section>  section (container; may hold leaf blocks)
//   <Row>      row     (container; holds <Column> children)
//   <Column>   column  (container; holds leaf blocks; only valid inside <Row>)
//   <Heading>  heading
//   <Text>     text
//   <Button>   button
//   <Image>    image
//   <Divider>  divider
//   <Link>     link
//   <Spacer>   spacer
//   <Markdown> markdown
//   <Code>     code

const TAG_TO_TYPE: Record<string, Block["type"] | "column"> = {
  Section: "section",
  Row: "row",
  Column: "column",
  Heading: "heading",
  Text: "text",
  Button: "button",
  Image: "image",
  Divider: "divider",
  Link: "link",
  Spacer: "spacer",
  Markdown: "markdown",
  Code: "code",
};

const TYPE_TO_TAG: Record<Block["type"] | "column", string> = {
  section: "Section",
  row: "Row",
  column: "Column",
  heading: "Heading",
  text: "Text",
  button: "Button",
  image: "Image",
  divider: "Divider",
  link: "Link",
  spacer: "Spacer",
  markdown: "Markdown",
  code: "Code",
  // `html` blocks don't have a component tag; their content IS raw markup and
  // is emitted verbatim (see printBlock).
  html: "",
};

// Known component tags (everything else is treated as raw HTML — Tier 2). We
// keep matching CASE-INSENSITIVELY against this set so `<text>` still maps to
// the Text block, but truly unknown tags (`<div>`, `<table>`, ...) fall back to
// an `html` block instead of throwing.
const KNOWN_TAGS = new Set(Object.keys(TAG_TO_TYPE));
function resolveKnownTag(tag: string): string | null {
  if (KNOWN_TAGS.has(tag)) return tag;
  const match = [...KNOWN_TAGS].find(
    (t) => t.toLowerCase() === tag.toLowerCase(),
  );
  return match ?? null;
}

// Leaf tags whose inner text maps to a `text` prop.
const TEXT_BEARING = new Set(["Text", "Heading", "Button", "Link"]);

// Attribute names use kebab-case in TSX (e.g. margin-bottom) but camelCase in
// the JSON model (marginBottom). Convert between them.
function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}
function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

// ---------------------------------------------------------------------------
// Inline runs <-> inline HTML (for code mode round-trip)
// ---------------------------------------------------------------------------
// Text/Heading blocks may carry inline formatting as `content` runs. In code
// mode we print those as inline HTML (<strong>/<em>/<u>/<a>/<span style>) inside
// the <Text>/<Heading> tag and parse them back into runs. {{variables}} stay
// literal (not interpolated) so they survive the round-trip.

function escapeInline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// True when any run carries marks (so it must be printed as inline HTML).
function runsHaveMarks(runs: InlineRun[] | undefined): boolean {
  return Boolean(runs && runs.some((r) => r.marks));
}

function printInlineRuns(runs: InlineRun[]): string {
  return runs
    .map((run) => {
      let html = escapeInline(run.text);
      const m = run.marks ?? {};
      if (m.bold) html = `<strong>${html}</strong>`;
      if (m.italic) html = `<em>${html}</em>`;
      if (m.underline) html = `<u>${html}</u>`;
      const styles: string[] = [];
      if (m.color) styles.push(`color: ${m.color}`);
      if (m.background) styles.push(`background-color: ${m.background}`);
      if (m.link != null) {
        const style = styles.length ? ` style="${styles.join("; ")}"` : "";
        html = `<a href="${escapeInline(m.link)}"${style}>${html}</a>`;
      } else if (styles.length) {
        html = `<span style="${styles.join("; ")}">${html}</span>`;
      }
      return html;
    })
    .join("");
}

// Parse a fragment of inline HTML back into runs. Tolerant: unknown tags are
// stripped (their text is kept). Recognizes strong/b, em/i, u, a[href], span,
// and reads color / background-color from inline style attributes.
function parseInlineRuns(html: string): InlineRun[] {
  type Active = NonNullable<InlineRun["marks"]>;
  const runs: InlineRun[] = [];
  const stack: Active[] = [];
  const merged = (): Active => Object.assign({}, ...stack);

  const re = /<\/?([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [whole, tagName, attrs, textChunk] = m;
    if (textChunk != null) {
      const text = decodeInline(textChunk).replace(/\s+/g, " ");
      if (text) {
        const marks = merged();
        runs.push(
          Object.keys(marks).length ? { text, marks } : { text },
        );
      }
      continue;
    }
    const isClose = whole.startsWith("</");
    const tag = tagName.toLowerCase();
    if (isClose) {
      stack.pop();
      continue;
    }
    // Self-closing/void inline tags carry no formatting we model — skip.
    const mark: Active = {};
    if (tag === "strong" || tag === "b") mark.bold = true;
    else if (tag === "em" || tag === "i") mark.italic = true;
    else if (tag === "u") mark.underline = true;
    else if (tag === "a") {
      const href = /href\s*=\s*"([^"]*)"/.exec(attrs ?? "");
      mark.link = href ? decodeInline(href[1]) : "";
      readStyle(attrs ?? "", mark);
    } else if (tag === "span") {
      readStyle(attrs ?? "", mark);
    }
    // Push even an empty mark so the matching close tag pops correctly.
    stack.push(mark);
    if (whole.endsWith("/>")) stack.pop();
  }
  return runs;
}

function readStyle(attrs: string, mark: NonNullable<InlineRun["marks"]>) {
  const style = /style\s*=\s*"([^"]*)"/.exec(attrs);
  if (!style) return;
  for (const decl of style[1].split(";")) {
    const [k, v] = decl.split(":");
    if (!k || !v) continue;
    const key = k.trim().toLowerCase();
    const val = v.trim();
    if (key === "color") mark.color = val;
    else if (key === "background-color" || key === "background")
      mark.background = val;
  }
}

function decodeInline(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// ---------------------------------------------------------------------------
// Nested `border` <-> scalar border-* attributes
// ---------------------------------------------------------------------------
// The model's `border` prop is a nested object ({width,style,color,radius}) on
// sections/rows/columns/images, but the TSX attribute grammar is scalar-only
// (name="…" | name={…} — no nested braces). So the codec flattens it into
// scalar attributes border-width / border-style / border-color /
// border-radius and reassembles the object on parse. This keeps bordered cards
// (our pre-built layouts lean on border={radius:12}) fully expressible in code
// mode and in AI-generated TSX.
//
// Radius nuance: <Button> and <Image> already carry a SCALAR `borderRadius`
// prop, so for those `border-radius` maps to the scalar; for the containers
// (section/row/column) it maps into `border.radius`.

const NESTED_BORDER_TYPES = new Set(["section", "row", "column", "image"]);
const SCALAR_RADIUS_TYPES = new Set(["button", "image"]);

function normalizeBorderAttrs(
  type: string,
  attrs: Record<string, unknown>,
): Record<string, unknown> {
  const { borderWidth, borderStyle, borderColor, borderRadius, ...rest } =
    attrs;
  if (
    borderWidth === undefined &&
    borderStyle === undefined &&
    borderColor === undefined &&
    borderRadius === undefined
  ) {
    return attrs;
  }
  const border: Record<string, unknown> = {};
  if (NESTED_BORDER_TYPES.has(type)) {
    if (typeof borderWidth === "number") border.width = borderWidth;
    if (typeof borderStyle === "string") border.style = borderStyle;
    if (typeof borderColor === "string") border.color = borderColor;
  }
  if (typeof borderRadius === "number") {
    if (SCALAR_RADIUS_TYPES.has(type)) rest.borderRadius = borderRadius;
    else if (NESTED_BORDER_TYPES.has(type)) border.radius = borderRadius;
  }
  if (Object.keys(border).length) rest.border = border;
  return rest;
}

export class TsxParseError extends Error {}

// ---------------------------------------------------------------------------
// Lenient block parsing — drop unparseable STYLE props instead of nuking the
// whole update.
// ---------------------------------------------------------------------------
// The codec is fed by an AI (and by hand-authored TSX), so a single stray
// attribute the schema can't accept — an expression it degraded to a string
// (`fontSize={12 + 4}` → "12 + 4"), a unit we don't model (`width="50%"`,
// `fontSize="2rem"`), an out-of-range value (`width={9999}`, a negative pad) —
// should NOT fail the entire template write with an opaque Zod union error.
// Structure is load-bearing; a decorative style prop is not. So we parse
// leniently: if a block fails validation, we DROP just the offending
// attribute(s) (identified by the Zod issue paths) and retry, keeping the block
// with its valid props and letting the schema default fill the dropped one.
//
// Only *own* style attributes are ever dropped. Structural keys (type, id,
// children, columns) are never touched — if one of those is the problem the
// error is real and propagates (surfaced as an actionable TsxParseError by the
// container parsers). `text`/content and the container child arrays are
// likewise preserved.
const PROTECTED_KEYS = new Set([
  "type",
  "id",
  "children",
  "columns",
  "text",
  "content",
  "markdown",
  "code",
  "html",
]);

// Resolve the CONCRETE block schema for a raw block by its `type` discriminant.
// Parsing against the concrete schema (rather than the BlockSchema union) gives
// unambiguous Zod issue paths — a union reports a tangle of per-branch errors,
// so a valid prop on the real branch can look "bad" under a sibling branch.
// Falls back to the given union schema when the type is missing/unknown.
function concreteSchemaFor(
  raw: Record<string, unknown>,
  fallback: { safeParse: (v: unknown) => unknown },
): { safeParse: (v: unknown) => unknown } {
  const type = typeof raw.type === "string" ? raw.type : undefined;
  switch (type) {
    case "section":
      return SectionBlockSchema;
    case "row":
      return RowBlockSchema;
    case "column":
      return ColumnBlockSchema;
    case "text":
      return TextBlockSchema;
    case "heading":
      return HeadingBlockSchema;
    case "button":
      return ButtonBlockSchema;
    case "image":
      return ImageBlockSchema;
    case "divider":
      return DividerBlockSchema;
    case "link":
      return LinkBlockSchema;
    case "spacer":
      return SpacerBlockSchema;
    case "markdown":
      return MarkdownBlockSchema;
    case "code":
      return CodeBlockSchema;
    case "html":
      return HtmlBlockSchema;
    default:
      return fallback as { safeParse: (v: unknown) => unknown };
  }
}

function lenientParse<T>(
  schema: {
    safeParse: (v: unknown) => {
      success: boolean;
      data?: T;
      error?: { issues: { path: PropertyKey[] }[] };
    };
  },
  raw: Record<string, unknown>,
): T {
  // Prefer the concrete schema (unambiguous issue paths); fall back to the
  // caller's schema for unknown types.
  const target = concreteSchemaFor(raw, schema) as typeof schema;
  let candidate: Record<string, unknown> = raw;
  // Bounded retries — at most one drop per own key, plus a final attempt.
  for (let attempt = 0; attempt <= Object.keys(raw).length + 1; attempt++) {
    const result = target.safeParse(candidate);
    if (result.success) return result.data as T;
    // Collect the TOP-LEVEL prop names the failing issues point at. A nested
    // object prop (border/margin/padding) reports its bad leaf deeper in the
    // path; we drop the whole top-level prop, which is the safe granular unit
    // (defaults refill it). For UNION schemas (BlockSchema) Zod prefixes each
    // issue path with the branch index (a number), so we scan the path for the
    // first segment that names an actual own key of the candidate rather than
    // assuming it's at position 0.
    const ownKeys = new Set(Object.keys(candidate));
    const badKeys = new Set<string>();
    for (const issue of result.error?.issues ?? []) {
      const key = issue.path.find(
        (seg): seg is string => typeof seg === "string" && ownKeys.has(seg),
      );
      if (key && !PROTECTED_KEYS.has(key)) badKeys.add(key);
    }
    if (badKeys.size === 0) {
      // The failure is structural / on a protected key — not something we can
      // fix by dropping a style prop. Surface it to the caller.
      throw result.error ?? new TsxParseError("Invalid block.");
    }
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(candidate)) {
      if (!badKeys.has(k)) next[k] = v;
    }
    candidate = next;
  }
  // Exhausted retries — parse strictly one last time so the real error throws.
  return (target.safeParse(candidate).data ?? raw) as T;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type Token =
  | {
      kind: "open";
      tag: string;
      attrs: Record<string, unknown>;
      selfClose: boolean;
      raw: string;
    }
  | { kind: "close"; tag: string; raw: string }
  | { kind: "text"; value: string; raw: string };

// Find the index just past the `{` at `openIdx` that BALANCES it — i.e. the
// matching `}` for nested braces (an inline object literal like
// `border={{ style: "solid" }}`), skipping over braces inside quoted strings
// so a literal "}" in a color/string value can't close the expression early.
// Returns -1 if unbalanced (caller falls back to treating the rest as text).
function findBalancedBraceEnd(input: string, openIdx: number): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let i = openIdx; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === "\\") i++; // skip escaped char inside the string
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// A JSX attribute value can be a plain scalar (`{600}`, `{true}`) OR a small
// inline object literal (`border={{ style: "solid", width: 1, radius: 12 }}`)
// — the natural way to author a nested prop like `border`/`margin`/`padding`.
// This isn't a full JS expression evaluator: it only understands flat
// `key: value` pairs with string/number/boolean values, which is all our
// component props ever nest. Anything else degrades to the raw string (same
// as before) so lossless Tier-2 fallback still applies.
function parseObjectLiteral(expr: string): Record<string, unknown> | null {
  if (!expr.startsWith("{") || !expr.endsWith("}")) return null;
  const body = expr.slice(1, -1);
  const out: Record<string, unknown> = {};
  const pairRe = /([\w-]+)\s*:\s*(?:"([^"]*)"|'([^']*)'|(-?\d+(?:\.\d+)?)|(\w+))\s*,?/g;
  let m: RegExpExecArray | null;
  let matched = false;
  while ((m = pairRe.exec(body))) {
    matched = true;
    const key = kebabToCamel(m[1]);
    if (m[2] !== undefined) out[key] = m[2];
    else if (m[3] !== undefined) out[key] = m[3];
    else if (m[4] !== undefined) out[key] = Number(m[4]);
    else if (m[5] === "true") out[key] = true;
    else if (m[5] === "false") out[key] = false;
    else out[key] = m[5];
  }
  return matched ? out : null;
}

function parseAttrs(raw: string): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  // Matches: name="..."  |  name={  (the `{...}` payload is captured
  // separately below via findBalancedBraceEnd so a nested object literal's
  // inner braces don't truncate the match).
  const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|\{)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    // Tailwind classes: accept both the HTML `class` and the JSX `className`
    // attribute (and a short `tw` alias) and normalize to the
    // canonical `className` block prop. Don't kebab-case the name.
    const rawName = m[1];
    const key =
      rawName === "class" || rawName === "className" || rawName === "tw"
        ? "className"
        : kebabToCamel(rawName);
    if (m[2] !== undefined) {
      attrs[key] = m[2]; // string literal
      continue;
    }
    // `{` case: m.index + full match length - 1 is the position of the `{`.
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = findBalancedBraceEnd(raw, openIdx);
    if (closeIdx === -1) {
      // Unbalanced — bail out on this attribute rather than scanning forever;
      // leave it unset (Tier 2 lossless fallback still keeps the block).
      break;
    }
    const expr = raw.slice(openIdx + 1, closeIdx).trim();
    re.lastIndex = closeIdx + 1;
    if (expr === "true") attrs[key] = true;
    else if (expr === "false") attrs[key] = false;
    else if (/^-?\d+(\.\d+)?$/.test(expr)) attrs[key] = Number(expr);
    else {
      const obj = parseObjectLiteral(expr);
      attrs[key] = obj ?? expr.replace(/^["']|["']$/g, ""); // tolerate {'x'}
    }
  }
  return attrs;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const lt = input.indexOf("<", i);
    if (lt === -1) {
      pushText(tokens, input.slice(i));
      break;
    }
    if (lt > i) pushText(tokens, input.slice(i, lt));

    // HTML comments (<!-- ... -->) are kept verbatim as raw text so they can be
    // preserved inside html blocks rather than mistaken for tags.
    if (input.startsWith("<!--", lt)) {
      const end = input.indexOf("-->", lt + 4);
      const close = end === -1 ? input.length : end + 3;
      pushText(tokens, input.slice(lt, close));
      i = close;
      continue;
    }

    const gt = input.indexOf(">", lt);
    if (gt === -1) {
      // No closing '>': treat the rest as raw text (don't throw — Tier 2).
      pushText(tokens, input.slice(lt));
      break;
    }
    const rawTag = input.slice(lt, gt + 1);
    const inner = input.slice(lt + 1, gt).trim();

    if (inner.startsWith("/")) {
      tokens.push({ kind: "close", tag: inner.slice(1).trim(), raw: rawTag });
    } else {
      const selfClose = inner.endsWith("/");
      const body = selfClose ? inner.slice(0, -1).trim() : inner;
      const sp = body.search(/\s/);
      const tag = sp === -1 ? body : body.slice(0, sp);
      const attrsRaw = sp === -1 ? "" : body.slice(sp);
      tokens.push({
        kind: "open",
        tag,
        attrs: parseAttrs(attrsRaw),
        selfClose,
        raw: rawTag,
      });
    }
    i = gt + 1;
  }
  return tokens;
}

function pushText(tokens: Token[], raw: string) {
  // Keep meaningful text. We now ALSO keep whitespace-only chunks (as a single
  // collapsed space) so inline HTML inside <Text>/<Heading> preserves the space
  // between adjacent inline tags (e.g. `</span> <a>`). Container parsers skip
  // whitespace-only text tokens explicitly (see isBlankText).
  if (!raw) return;
  if (!raw.trim()) {
    tokens.push({ kind: "text", value: " ", raw: " " });
    return;
  }
  const value = raw.replace(/\s+/g, " ").trim();
  tokens.push({ kind: "text", value, raw });
}

// True for a text token that is only whitespace (used by container parsers to
// ignore inter-tag gaps without turning them into html blocks).
function isBlankText(t: Token): boolean {
  return t.kind === "text" && !t.value.trim();
}

// ---------------------------------------------------------------------------
// Parser: tokens -> blocks
// ---------------------------------------------------------------------------

function attrsToBlock(
  tag: string,
  attrs: Record<string, unknown>,
  text: string | null,
): Block {
  const resolved = resolveKnownTag(tag);
  const type = resolved ? TAG_TO_TYPE[resolved] : undefined;
  if (!type) {
    // Unknown tag — should not reach here (callers pre-screen with
    // resolveKnownTag), but stay lossless: wrap as an html block.
    return {
      type: "html",
      id: typeof attrs.id === "string" ? attrs.id : newBlockId(),
      html: text ?? "",
      marginBottom: 0,
    } as unknown as Block;
  }
  const base: Record<string, unknown> = {
    type,
    id: typeof attrs.id === "string" ? attrs.id : newBlockId(),
    ...normalizeBorderAttrs(type, attrs),
  };
  // Text-bearing blocks take their inner text as the relevant content prop.
  if (text != null) {
    if (type === "text" || type === "heading") {
      // Inner content may include inline HTML (<strong>/<a>/<span ...>). If so,
      // parse it into runs and derive the plain `text` from them; otherwise keep
      // it as plain text.
      if (/<[a-zA-Z]/.test(text)) {
        const runs = parseInlineRuns(text);
        base.text = runs.map((r) => r.text).join("");
        if (runs.some((r) => r.marks)) base.content = runs;
      } else {
        base.text = decodeInline(text).replace(/\s+/g, " ").trim();
      }
    } else if (type === "button" || type === "link") {
      base.text = text;
    } else if (type === "markdown") {
      base.markdown = text;
    } else if (type === "code") {
      base.code = text;
    }
  }
  return base as unknown as Block;
}

export function parseTsx(code: string, base?: EmailDocument): EmailDocument {
  const tokens = tokenize(code);
  const blocks: Block[] = [];

  let idx = 0;
  while (idx < tokens.length) {
    const tok = tokens[idx];
    // Tier 2: anything we don't recognize as a known component is preserved
    // verbatim as an `html` block rather than throwing. Stray text and unknown
    // tags both fall through to the raw collector.
    if (tok.kind === "text") {
      if (isBlankText(tok)) {
        idx++;
        continue;
      }
      pushHtmlBlock(blocks, tok.raw);
      idx++;
      continue;
    }
    if (tok.kind === "close") {
      // A dangling close tag — keep it verbatim.
      pushHtmlBlock(blocks, tok.raw);
      idx++;
      continue;
    }
    if (!resolveKnownTag(tok.tag)) {
      const raw = consumeRawElement(tokens, idx);
      pushHtmlBlock(blocks, raw.html);
      idx = raw.next;
      continue;
    }
    const result = consumeElement(tokens, idx);
    // Top-level leaf blocks come straight from attrsToBlock and are only
    // validated at the final EmailDocumentSchema.parse below — which is
    // all-or-nothing. Sanitize each here (dropping only unparseable style props)
    // so one bad attribute on a top-level Text can't fail the whole document.
    // Containers (section/row) were already lenient-parsed by consumeNode.
    blocks.push(
      result.block.type === "section" || result.block.type === "row"
        ? result.block
        : lenientParse<Block>(
            BlockSchema,
            result.block as unknown as Record<string, unknown>,
          ),
    );
    idx = result.next;
  }

  // The TSX surface only encodes the block TREE — theme, category, previewText,
  // `from`, and declared variables live OUTSIDE the code (edited via the
  // inspector / category toggle) and are NOT printed by printTsx. So when a
  // `base` document is supplied (the round-trip case: Code editor re-parsing
  // after each keystroke), preserve all of that non-block metadata and only
  // swap in the freshly parsed blocks. Without this, every parse would reset
  // the theme (bodyColor → white), the category (→ transactional), etc. back to
  // schema defaults — silently wiping the user's body background / category on
  // reopen and on the next autosave. When no base is given (e.g. importing bare
  // snippet code) we fall back to a schema-default document.
  return base
    ? EmailDocumentSchema.parse({ ...base, blocks })
    : EmailDocumentSchema.parse({ blocks });
}

// Append raw markup as an `html` block, COALESCING with a preceding html block
// so a run of unknown markup stays one block instead of fragmenting.
function pushHtmlBlock(blocks: Block[], raw: string) {
  const html = raw.trim();
  if (!html) return;
  const last = blocks[blocks.length - 1];
  if (last && last.type === "html") {
    last.html = `${last.html}\n${html}`;
    return;
  }
  blocks.push({ type: "html", id: newBlockId(), html, marginBottom: 0 });
}

// Same coalescing logic for Section children and Column leaves.
function pushHtmlChild(children: SectionChild[], raw: string) {
  const html = raw.trim();
  if (!html) return;
  const last = children[children.length - 1];
  if (last && last.type === "html") {
    last.html = `${last.html}\n${html}`;
    return;
  }
  children.push(
    LeafBlockSchema.parse({
      type: "html",
      id: newBlockId(),
      html,
      marginBottom: 0,
    }),
  );
}
function pushHtmlLeaf(children: LeafBlock[], raw: string) {
  const html = raw.trim();
  if (!html) return;
  const last = children[children.length - 1];
  if (last && last.type === "html") {
    last.html = `${last.html}\n${html}`;
    return;
  }
  children.push(
    LeafBlockSchema.parse({
      type: "html",
      id: newBlockId(),
      html,
      marginBottom: 0,
    }),
  );
}

// Consume an unknown element (or self-closing tag) starting at `start`,
// returning its full raw source. Balances nesting of the SAME unknown tag so we
// don't stop at an inner close. If unbalanced, consumes to end of input.
function consumeRawElement(
  tokens: Token[],
  start: number,
): { html: string; next: number } {
  const open = tokens[start];
  if (open.kind !== "open") return { html: open.raw, next: start + 1 };
  if (open.selfClose) return { html: open.raw, next: start + 1 };

  const tag = open.tag.toLowerCase();
  let depth = 1;
  let html = open.raw;
  let i = start + 1;
  while (i < tokens.length && depth > 0) {
    const t = tokens[i];
    html += t.kind === "text" ? t.raw : t.raw;
    if (t.kind === "open" && !t.selfClose && t.tag.toLowerCase() === tag) {
      depth++;
    } else if (t.kind === "close" && t.tag.toLowerCase() === tag) {
      depth--;
    }
    i++;
  }
  return { html, next: i };
}

function consumeElement(
  tokens: Token[],
  start: number,
): { block: Block; next: number } {
  const r = consumeNode(tokens, start);
  if (r.block.type === "column") {
    throw new TsxParseError(
      "<Column> is only valid inside a <Row>. Wrap your columns in a <Row>…</Row>.",
    );
  }
  return r as { block: Block; next: number };
}

// Like consumeElement but also permits returning a Column node (used internally
// when parsing the children of a <Row>).
function consumeNode(
  tokens: Token[],
  start: number,
): { block: Block | ColumnBlock; next: number } {
  const open = tokens[start];
  if (open.kind !== "open") {
    throw new TsxParseError("Expected an opening tag.");
  }

  if (open.selfClose) {
    return {
      block: attrsToBlock(open.tag, open.attrs, null) as Block | ColumnBlock,
      next: start + 1,
    };
  }

  // <Section> — container of leaf blocks and (since v3) nested <Section>s.
  if (open.tag === "Section") {
    const children: SectionChild[] = [];
    let i = start + 1;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.kind === "close" && t.tag === "Section") {
        const block = lenientParse<SectionBlock>(SectionBlockSchema, {
          type: "section",
          id: typeof open.attrs.id === "string" ? open.attrs.id : newBlockId(),
          ...normalizeBorderAttrs("section", open.attrs),
          children,
        });
        return { block, next: i + 1 };
      }
      // Tier 2: stray text or unknown tags inside a Section are preserved as an
      // html leaf rather than throwing. Whitespace-only gaps are ignored.
      if (t.kind === "text") {
        if (!isBlankText(t)) pushHtmlChild(children, t.raw);
        i++;
        continue;
      }
      if (t.kind === "close" || !resolveKnownTag(t.tag)) {
        const raw = consumeRawElement(tokens, i);
        pushHtmlChild(children, raw.html);
        i = raw.next;
        continue;
      }
      const child = consumeNode(tokens, i);
      if (child.block.type === "column" || child.block.type === "row") {
        throw new TsxParseError(
          "<Section> may only contain leaf blocks or nested <Section>s — a <Row> cannot go inside a <Section>. Move the <Row> to the top level (rows are their own horizontal band), or use a nested <Section> instead.",
        );
      }
      // A Section child is either a nested Section or a leaf block.
      if (child.block.type === "section") {
        children.push(child.block);
      } else {
        children.push(lenientParse<LeafBlock>(LeafBlockSchema, child.block as unknown as Record<string, unknown>));
      }
      i = child.next;
    }
    throw new TsxParseError("Unclosed <Section>.");
  }

  // <Row> — container of <Column> only.
  if (open.tag === "Row") {
    const columns: ColumnBlock[] = [];
    let i = start + 1;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.kind === "close" && t.tag === "Row") {
        const block = lenientParse<Block>(BlockSchema, {
          type: "row",
          id: typeof open.attrs.id === "string" ? open.attrs.id : newBlockId(),
          ...normalizeBorderAttrs("row", open.attrs),
          columns,
        });
        return { block, next: i + 1 };
      }
      // Ignore whitespace-only gaps between <Column> tags.
      if (isBlankText(t)) {
        i++;
        continue;
      }
      if (t.kind !== "open" || t.tag !== "Column") {
        throw new TsxParseError(
          "<Row> may only contain <Column> components. Put content inside a <Column>…</Column> within the <Row>.",
        );
      }
      const child = consumeNode(tokens, i);
      columns.push(lenientParse<ColumnBlock>(ColumnBlockSchema, child.block as unknown as Record<string, unknown>));
      i = child.next;
    }
    throw new TsxParseError("Unclosed <Row>.");
  }

  // <Column> — container of leaf blocks (only reached via <Row>).
  if (open.tag === "Column") {
    const children: LeafBlock[] = [];
    let i = start + 1;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.kind === "close" && t.tag === "Column") {
        const block = lenientParse<ColumnBlock>(ColumnBlockSchema, {
          type: "column",
          id: typeof open.attrs.id === "string" ? open.attrs.id : newBlockId(),
          ...normalizeBorderAttrs("column", open.attrs),
          children,
        });
        return { block, next: i + 1 };
      }
      // Tier 2: stray text / unknown tags inside a Column become html leaves.
      // Whitespace-only gaps are ignored.
      if (t.kind === "text") {
        if (!isBlankText(t)) pushHtmlLeaf(children, t.raw);
        i++;
        continue;
      }
      if (t.kind === "close" || !resolveKnownTag(t.tag)) {
        const raw = consumeRawElement(tokens, i);
        pushHtmlLeaf(children, raw.html);
        i = raw.next;
        continue;
      }
      const child = consumeNode(tokens, i);
      // Columns hold LEAF blocks only — a nested Section/Row/Column is a
      // structural mistake. Give the same actionable message as the Section
      // guard instead of an opaque Zod union error.
      if (
        child.block.type === "section" ||
        child.block.type === "row" ||
        child.block.type === "column"
      ) {
        throw new TsxParseError(
          `<Column> may only contain leaf blocks (Text, Heading, Button, Image, …) — a <${TYPE_TO_TAG[child.block.type]}> can't go inside a <Column>. Put the leaf content directly in the <Column>, and keep <Section>/<Row> at the top level.`,
        );
      }
      children.push(lenientParse<LeafBlock>(LeafBlockSchema, child.block as unknown as Record<string, unknown>));
      i = child.next;
    }
    throw new TsxParseError("Unclosed <Column>.");
  }

  // Leaf with text content: gather text until the matching close tag. Unknown
  // child tags are absorbed into the text verbatim (Tier 2-tolerant). We use the
  // RAW source for text chunks here (not the whitespace-collapsed value) so
  // inline HTML inside <Text>/<Heading> keeps the spacing between words and
  // tags; attrsToBlock collapses/parses as appropriate per block type.
  let text = "";
  let i = start + 1;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.kind === "close" && t.tag === open.tag) {
      // Markdown/Code content is whitespace-SIGNIFICANT (blank lines separate
      // markdown paragraphs; code renders pre-wrap), so `trim()` alone is wrong:
      // it strips the ends but keeps the per-line indentation the printer added,
      // and each print→parse cycle would then ACCUMULATE indentation inside the
      // stored content (and blank lines would grow trailing spaces). Dedent
      // instead — strip outer blank lines plus the common leading indent — which
      // makes the print→parse round-trip an exact identity.
      const resolved = resolveKnownTag(open.tag);
      const type = resolved ? TAG_TO_TYPE[resolved] : undefined;
      const content =
        type === "markdown" || type === "code" ? dedentText(text) : text.trim();
      const block = attrsToBlock(open.tag, open.attrs, content || null);
      return { block, next: i + 1 };
    }
    text += t.raw;
    i++;
  }
  throw new TsxParseError(`Unclosed <${open.tag}>.`);
}

// Reverse the printer's pretty-indentation for whitespace-significant content
// (markdown/code): drop leading/trailing blank lines, blank out whitespace-only
// interior lines, and remove the largest indent common to every non-empty line.
// Mirrors how tagged-template `dedent` helpers behave, and is idempotent — so
// repeated print→parse cycles (the Code editor re-parses on every keystroke)
// can never drift the stored content.
function dedentText(raw: string): string {
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

// ---------------------------------------------------------------------------
// Printer: blocks -> pretty TSX
// ---------------------------------------------------------------------------

// Props that should NOT be emitted as attributes (handled specially or noise).
const SKIP_ATTRS = new Set([
  "type",
  "id",
  "text",
  "content",
  "children",
  "columns",
  "markdown",
  "code",
  "html",
  // `border` is a nested object ({width,style,color,radius}); it's flattened
  // into scalar border-width/style/color/radius attributes by printAttrs (and
  // reassembled by normalizeBorderAttrs on parse) so bordered cards round-trip
  // through code mode.
  "border",
]);

function printAttrs(block: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(block)) {
    if (SKIP_ATTRS.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (value === "") continue;
    // Non-scalar objects (margin/padding boxes, componentRef, …) have no TSX
    // attribute form — they're visual-editor-only and are skipped rather than
    // stringified into `{[object Object]}`.
    if (typeof value === "object") continue;
    // `className` (Tailwind utilities) prints verbatim as `className="..."`
    // rather than kebab-cased, matching JSX conventions.
    const attr = key === "className" ? "className" : camelToKebab(key);
    if (typeof value === "string") {
      // customCss may be authored multi-line; collapse to a single line and
      // strip any quote chars so it survives a double-quoted attribute.
      const safe =
        key === "customCss"
          ? value.replace(/\s+/g, " ").replace(/["<>]/g, "").trim()
          : value;
      parts.push(`${attr}="${safe}"`);
    } else parts.push(`${attr}={${String(value)}}`);
  }
  // Flatten the nested border object into scalar border-* attributes (see
  // normalizeBorderAttrs). For blocks with a SCALAR borderRadius prop (button/
  // image) that radius already printed above, so only the nested one is added.
  const border = block.border as
    | { width?: number; style?: string; color?: string; radius?: number }
    | undefined;
  if (border && typeof border === "object") {
    if (typeof border.width === "number")
      parts.push(`border-width={${border.width}}`);
    if (typeof border.style === "string")
      parts.push(`border-style="${border.style}"`);
    if (typeof border.color === "string")
      parts.push(`border-color="${border.color}"`);
    // Don't double-print radius when the block also carries the scalar
    // borderRadius prop (image can hold both; the scalar wins there).
    if (typeof border.radius === "number" && block.borderRadius === undefined)
      parts.push(`border-radius={${border.radius}}`);
  }
  return parts.length ? " " + parts.join(" ") : "";
}

function printBlock(block: Block | ColumnBlock, indent: string): string {
  const tag = TYPE_TO_TAG[block.type];
  const rec = block as unknown as Record<string, unknown>;

  if (block.type === "section" || block.type === "column") {
    const inner = block.children
      .map((c) => printBlock(c, indent + "  "))
      .join("\n");
    return `${indent}<${tag}${printAttrs(rec)}>\n${inner}\n${indent}</${tag}>`;
  }

  if (block.type === "row") {
    const inner = block.columns
      .map((c) => printBlock(c, indent + "  "))
      .join("\n");
    return `${indent}<${tag}${printAttrs(rec)}>\n${inner}\n${indent}</${tag}>`;
  }

  // Text-bearing leaves (Text/Heading/Button/Link) and the markdown/code blocks
  // are PAIRED tags. Pretty-print them with the inner content on its own
  // indented line and the closing tag on a new line so the hierarchy is clear:
  //   <Text ...>
  //     content
  //   </Text>
  // Empty content collapses to `<Text ...></Text>` on one line (nothing to nest).
  // This is round-trip safe: the parser trims/collapses inner whitespace, so the
  // added indentation/newlines don't change the parsed content.
  const paired =
    (TEXT_BEARING.has(tag) && "text" in rec) ||
    block.type === "markdown" ||
    block.type === "code";
  if (paired) {
    let content =
      block.type === "markdown"
        ? block.markdown
        : block.type === "code"
          ? block.code
          : ((rec.text as string) ?? "");
    // Text/Heading with inline formatting print their runs as inline HTML so
    // marks (bold/link/color/highlight) round-trip through code mode.
    if (
      (block.type === "text" || block.type === "heading") &&
      runsHaveMarks(block.content)
    ) {
      content = printInlineRuns(block.content as InlineRun[]);
    }
    const open = `${indent}<${tag}${printAttrs(rec)}>`;
    if (!content) return `${open}\n${indent}</${tag}>`;
    const inner = content
      .split("\n")
      .map((line) => `${indent}  ${line}`)
      .join("\n");
    return `${open}\n${inner}\n${indent}</${tag}>`;
  }

  if (block.type === "html") {
    // Raw HTML is emitted verbatim (no component wrapper). Re-parsing it will
    // re-collect it into an html block, so this round-trips.
    return block.html
      .split("\n")
      .map((line) => `${indent}${line}`)
      .join("\n");
  }

  // Self-closing leaves (image, divider, spacer).
  return `${indent}<${tag}${printAttrs(rec)} />`;
}

export function printTsx(doc: EmailDocument): string {
  return doc.blocks.map((b) => printBlock(b, "")).join("\n");
}

// Print a ComponentFragment (e.g. a pre-built section layout) as constrained
// TSX. Same printer as printTsx — fragments are just a bare block list — so a
// layout's TSX round-trips through parseTsx and can be handed to the AI as the
// exact markup to reuse/adapt when composing an email.
export function printFragmentTsx(fragment: ComponentFragment): string {
  return fragment.blocks.map((b) => printBlock(b, "")).join("\n");
}
