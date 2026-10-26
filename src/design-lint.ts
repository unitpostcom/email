// ---------------------------------------------------------------------------
// Design lint — deterministic quality checks for a Designed email.
//
// `collectDocumentWarnings` (diagnostics.ts) flags what will MISRENDER. This
// pass flags what renders fine but reads badly: a button whose label fails
// contrast, an image with no alt text, a link still pointing at example.com,
// three competing primary buttons, 11px body copy, a gradient band with no
// solid fallback for Outlook. The rules are the measurable half of
// EMAIL_DESIGN.md (design-guide.ts), so an agent that wrote the email can fix
// them in the same turn and the evals can grade them without a model.
//
// Pure: no I/O, no rendering. Every hint names the block it concerns.
// ---------------------------------------------------------------------------

import type {
  Block,
  ButtonBlock,
  EmailDocument,
  ImageBlock,
  InlineRun,
  LeafBlock,
  SectionChild,
} from "./schema";
import { STYLE_TOKENS } from "./schema";
import { contrastRatio, readableTextOn, shadeToContrast } from "./color";
import { CONDITIONAL_BG_RE, darkContrast, darkModeEnabled, darkPalette } from "./dark-mode";
import { EMAIL_ASSETS_BASE, emailIconUrl, parseEmailIconUrl, type EmailIconName } from "./email-assets";

export type DesignHintRule =
  | "no-heading"
  | "multiple-h1"
  | "no-action"
  | "too-many-buttons"
  | "button-style"
  | "button-contrast"
  | "icon-contrast"
  | "text-contrast"
  | "image-alt"
  | "placeholder-link"
  | "placeholder-image"
  | "placeholder-copy"
  | "small-text"
  | "centered-long-copy"
  | "gradient-fallback"
  | "markdown-syntax"
  | "footer-in-body"
  | "no-preview-text"
  | "variable-heavy"
  | "tight-spacing"
  | "loose-spacing"
  | "spacing-doubled"
  | "edge-gutter"
  | "unsafe-css"
  | "dark-contrast";

export type DesignHint = {
  rule: DesignHintRule;
  /** "fix" = the email reads worse than it should; "check" = worth a look. */
  severity: "fix" | "check";
  /** One actionable line, written for the author (human or agent). */
  message: string;
  blockId: string | null;
};

// The stroke colour of our `ink` icons (render-email-assets.mts).
const ICON_INK = "#18181b";

const SELF_FILLING = new Set(["first_name", "last_name", "email", "company_name", "company_address", "unsubscribe_url"]);

/** Ids of blocks (any depth) whose className carries a conditional background. */
function conditionalBgBlocks(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) for (const n of node) conditionalBgBlocks(n, out);
  else if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.id === "string" && typeof o.className === "string" && CONDITIONAL_BG_RE.test(o.className)) out.push(o.id);
    for (const v of Object.values(o)) if (v && typeof v === "object") conditionalBgBlocks(v, out);
  }
  return out;
}

/** Below 3:1 nobody reads it comfortably ("fix"); up to `need` it misses WCAG AA ("check"). */
function contrastSeverity(ratio: number | null, need: number): DesignHint["severity"] | null {
  if (ratio === null || ratio >= need) return null;
  return ratio < 3 ? "fix" : "check";
}

// ------------------------------------------------------------ walking --

// `bgUnknown`: a container on the way down paints its background from
// customCss or a bg- class, which this walk doesn't resolve, so `bg` may not
// be what the reader sees (the icon check stays quiet then).
type Ctx = { bg: string; doc: EmailDocument; bgUnknown?: boolean };
type Visit = (block: LeafBlock, ctx: Ctx) => void;
/** Section / Row / Column: what the lint reads off a container. */
type Container = { id: string; customCss?: string; className?: string; backgroundColor?: string };

/** A background set from customCss or a (possibly variant) bg- class. */
function paintsCssBackground(b: { customCss?: string; className?: string }): boolean {
  return /(^|;)\s*background(-color|-image)?\s*:/i.test(b.customCss ?? "") || /(^|\s)(?:[\w-]+:)*bg-/.test(b.className ?? "");
}

/** The context inside a container: its own colour, and whether CSS may override it. */
function inside(ctx: Ctx, b: { backgroundColor?: string; customCss?: string; className?: string }): Ctx {
  return {
    ...ctx,
    bg: b.backgroundColor || ctx.bg,
    bgUnknown: paintsCssBackground(b) || (!b.backgroundColor && Boolean(ctx.bgUnknown)),
  };
}
type ContainerVisit = (block: Container) => void;

function walkChildren(children: SectionChild[], ctx: Ctx, visit: Visit, containers: ContainerVisit): void {
  for (const child of children) {
    if (child.type === "section") {
      containers(child);
      walkChildren(child.children, inside(ctx, child), visit, containers);
    } else visit(child, ctx);
  }
}

function walkBlocks(doc: EmailDocument, visit: Visit, containers: ContainerVisit): void {
  const root: Ctx = { bg: doc.theme.bodyColor, doc };
  for (const block of doc.blocks as Block[]) {
    if (block.type === "section") {
      containers(block);
      walkChildren(block.children, inside(root, block), visit, containers);
    } else if (block.type === "row") {
      containers(block);
      const rowCtx = inside(root, block);
      for (const col of block.columns) {
        containers(col);
        const colCtx = inside(rowCtx, col);
        for (const leaf of col.children) visit(leaf, colCtx);
      }
    } else visit(block as LeafBlock, root);
  }
}

const plain = (text: string | undefined, content?: InlineRun[]) =>
  (content && content.length ? content.map((r) => r.text).join("") : text ?? "").trim();

const PLACEHOLDER_HREF = /^(#|https?:\/\/(www\.)?example\.(com|org|net)\b.*|https?:\/\/)?$/i;
const GENERIC_ALT = /^(image|img|photo|picture|hero|banner|graphic|placeholder|icon|logo|untitled|screenshot)\s*\d*$/i;
const PLACEHOLDER_COPY = /\blorem ipsum\b|\bTODO\b|\[(your|insert|add|company|product|name)[^\]]*\]|\bXXX\b/i;
/**
 * Sample lines from our own layout bands and recipe starters (bands.ts,
 * layouts.ts, design-guide.ts). They're there to be rewritten; one left in a
 * finished email reads as a template, so it's a "fix". Short titles count only
 * as the whole line ("The biggest update"), sample sentences by how they open
 * ("One line on…"), so real copy that happens to share words doesn't trip it.
 */
export const STARTER_FILLER_LINES: readonly string[] = [
  "The first benefit",
  "The second benefit",
  "The third benefit",
  "The headline goes here",
  "A section headline",
  "The first detail",
  "The second detail",
  "The biggest update",
  "The second update",
  "The third update",
  "Do the first thing",
  "A short headline",
  "The first takeaway",
  "The second takeaway",
];
export const STARTER_FILLER_OPENINGS: readonly string[] = [
  "A clear headline that states the point",
  "One or two sentences on",
  "One sentence on what",
  "One line on",
  "A short line that sells the click",
  "Two or three sentences that explain",
  "A sentence or two that names",
  "One or two lines about it",
  "Say who gets it and when",
  "One line that removes the last bit of friction",
  "A line about what's on the way",
];
export const STARTER_FILLER: readonly string[] = [...STARTER_FILLER_LINES, ...STARTER_FILLER_OPENINGS];
const norm = (t: string) => t.trim().replace(/[.!?…]+$/, "").toLowerCase();
const FILLER_LINES = new Set(STARTER_FILLER_LINES.map(norm));
const isStarterFiller = (t: string) =>
  FILLER_LINES.has(norm(t)) || STARTER_FILLER_OPENINGS.some((o) => t.trim().toLowerCase().startsWith(o.toLowerCase()));
const MARKDOWN = /\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:[^)\s]+\)|^#{1,4}\s|^\s*[-*]\s+\S/m;
// The managed footer's own lines, not copy that merely mentions unsubscribing.
const FOOTER_COPY = /\{\{\s*unsubscribe_url\s*\}\}|\byou(?:'| a)re receiving this (email|message)\b|^\s*(unsubscribe|manage (your )?(email )?preferences)\s*\.?$/i;

/**
 * Design-quality hints for a Designed email, most severe first. Returns []
 * for a Simple email (it has no layout to lint) and for an empty body.
 */
export function lintEmailDesign(doc: EmailDocument, opts: { max?: number } = {}): DesignHint[] {
  if (doc.compositionMode === "simple" || doc.blocks.length === 0) return [];
  const out: DesignHint[] = [];
  const add = (rule: DesignHintRule, severity: DesignHint["severity"], message: string, blockId: string | null = null) =>
    out.push({ rule, severity, message, blockId });

  const headings: { level: number; id: string }[] = [];
  const buttons: ButtonBlock[] = [];
  let links = 0;
  const textColor = doc.theme.textColor;

  const visit: Visit = (b, ctx) => {
    switch (b.type) {
      case "heading": {
        headings.push({ level: b.level, id: b.id });
        const size = b.fontSize ?? STYLE_TOKENS.headingSize[b.level];
        const ratio = contrastRatio(b.color ?? textColor, ctx.bg);
        const sev = contrastSeverity(ratio, size >= 24 ? 3 : 4.5);
        if (sev) {
          add("text-contrast", sev, `Heading "${plain(b.text, b.content).slice(0, 40)}" is hard to read (${ratio!.toFixed(1)}:1 on ${ctx.bg}); use ${shadeToContrast(b.color ?? textColor, ctx.bg, size >= 24 ? 3 : 4.5)}.`, b.id);
        }
        checkCopy(b.id, plain(b.text, b.content));
        break;
      }
      case "text": {
        const t = plain(b.text, b.content);
        if (b.content?.some((r) => r.marks?.link)) links += b.content.filter((r) => r.marks?.link).length;
        for (const r of b.content ?? []) {
          if (r.marks?.link && PLACEHOLDER_HREF.test(r.marks.link.trim())) {
            add("placeholder-link", "fix", `The link "${r.text.slice(0, 30)}" points at ${r.marks.link || "nothing"}; use the real URL (or a {{variable}}).`, b.id);
          }
        }
        const ratio = contrastRatio(b.color ?? textColor, ctx.bg);
        const sev = contrastSeverity(ratio, b.fontSize >= 24 ? 3 : 4.5);
        if (t && sev) {
          add("text-contrast", sev, `Text "${t.slice(0, 40)}" is hard to read (${ratio!.toFixed(1)}:1 on ${ctx.bg}); use ${shadeToContrast(b.color ?? textColor, ctx.bg)}.`, b.id);
        }
        if (t.length > 0 && b.fontSize < 12) {
          add("small-text", "fix", `Text "${t.slice(0, 30)}" is ${b.fontSize}px; keep body copy at 14–16px and fine print at 12px or more.`, b.id);
        } else if (t.length > 160 && b.fontSize < 14) {
          add("small-text", "check", `A ${t.length}-character paragraph is set at ${b.fontSize}px; body copy reads best at 15–16px.`, b.id);
        }
        if (b.align === "center" && t.length > 320) {
          add("centered-long-copy", "check", "A long paragraph is centred; left-align anything longer than two or three lines.", b.id);
        }
        checkCopy(b.id, t);
        break;
      }
      case "list":
        for (const item of b.items) checkCopy(b.id, plain(item.text, item.content));
        break;
      case "button": {
        buttons.push(b);
        const href = b.href.trim();
        if (PLACEHOLDER_HREF.test(href)) {
          add("placeholder-link", "fix", `Button "${b.text}" links to ${href || "nothing"}; give it the real destination (or a {{variable}} like {{cta_url}}).`, b.id);
        }
        const ratio = contrastRatio(b.textColor, b.backgroundColor);
        if (ratio !== null && ratio < 4.5) {
          add("button-contrast", "fix", `Button "${b.text}" label is ${ratio.toFixed(1)}:1 on ${b.backgroundColor}; set text-color="${readableTextOn(b.backgroundColor)}" (keep the brand colour as the background).`, b.id);
        }
        break;
      }
      case "link": {
        links += 1;
        checkCopy(b.id, b.text);
        if (PLACEHOLDER_HREF.test(b.href.trim())) {
          add("placeholder-link", "fix", `Link "${b.text}" points at ${b.href || "nothing"}; use the real URL.`, b.id);
        }
        break;
      }
      case "image":
        checkImage(b);
        if (!ctx.bgUnknown && !paintsCssBackground(b)) checkIconOn(b, b.backgroundColor ?? ctx.bg);
        break;
      case "markdown":
        // A Markdown block renders its own syntax; only the copy rules apply.
        checkCopy(b.id, b.markdown, { markdown: true });
        break;
      default:
        break;
    }
  };

  // `background: linear-gradient(…)` with no colour of its own resets the
  // band's background-color to transparent.
  const gradientShorthandWithoutColor = (css: string) => {
    const value = /(?:^|;)\s*background\s*:([^;]*)/i.exec(css)?.[1] ?? "";
    if (!value.includes("gradient(")) return false;
    const rest = value.replace(/[a-z-]*gradient\((?:[^()]|\([^()]*\))*\)/gi, "");
    return !/#[0-9a-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i.test(rest);
  };

  const containers: ContainerVisit = (b) => {
    if (/gradient\(/i.test(b.customCss ?? "") && !b.backgroundColor) {
      add("gradient-fallback", "fix", "A gradient band has no background-color; set one (the gradient's main colour) so Outlook and images-off clients still show the band and its text stays readable.", b.id);
    } else if (gradientShorthandWithoutColor(b.customCss ?? "")) {
      add("gradient-fallback", "fix", "The `background:` shorthand clears background-color, so put the solid colour inside it too: `background: #4f46e5 linear-gradient(…)`. Without it some mail apps see white text on no background and darken it.", b.id);
    }
  };

  function checkImage(b: ImageBlock) {
    const alt = b.alt.trim();
    // Our hosted icons sit beside a text label: alt="" is right for them.
    const decorativeIcon = b.src.startsWith(`${EMAIL_ASSETS_BASE}/icons/`);
    if ((!alt && !decorativeIcon) || (alt && GENERIC_ALT.test(alt))) {
      add("image-alt", "fix", `An image has ${alt ? `generic alt text ("${alt}")` : "no alt text"}; describe what it shows (or the brand name for a logo) — many inboxes block images by default.`, b.id);
    }
    if (b.src.startsWith(`${EMAIL_ASSETS_BASE}/placeholders/`)) {
      add("placeholder-image", "check", "A placeholder image is still in the email; swap it for a real image before sending.", b.id);
    }
  }

  // Our transparent icons are one colour: `ink` for light backgrounds, `white`
  // for dark or brand ones. On the wrong one it barely shows. (The soft and
  // solid looks carry their own chip and read anywhere.)
  function checkIconOn(b: ImageBlock, bg: string) {
    const icon = parseEmailIconUrl(b.src);
    if (!icon || (icon.variant !== "ink" && icon.variant !== "white")) return;
    const ratio = contrastRatio(icon.variant === "ink" ? ICON_INK : "#ffffff", bg);
    if (ratio === null || ratio >= 3) return;
    const other = icon.variant === "ink" ? "white" : "ink";
    add("icon-contrast", "fix", `The ${icon.name} icon is ${icon.variant === "ink" ? "near-black" : "white"} on ${bg} and barely shows; use the ${other} look (${emailIconUrl(icon.name as EmailIconName, other)}), or the soft / solid chip.`, b.id);
  }

  function checkCopy(id: string, t: string, opts: { markdown?: boolean } = {}) {
    if (!t) return;
    if (PLACEHOLDER_COPY.test(t)) add("placeholder-copy", "fix", `Placeholder copy left in: "${t.slice(0, 50)}"; write the real text.`, id);
    else if (isStarterFiller(t)) add("placeholder-copy", "fix", `Starter sample copy left in: "${t.slice(0, 50)}"; write it for this email (or delete the band).`, id);
    if (!opts.markdown && MARKDOWN.test(t)) add("markdown-syntax", "fix", `Markdown syntax in "${t.slice(0, 40)}" shows literally in email; use <strong>, <a href> or a <List>.`, id);
    if (doc.category === "marketing" && FOOTER_COPY.test(t)) {
      add("footer-in-body", "fix", "The body has unsubscribe / preferences copy; marketing emails get the managed footer at send, so remove it here.", id);
    }
  }

  walkBlocks(doc, visit, containers);
  for (const h of layoutHints(doc)) add(h.rule, h.severity, h.message, h.blockId);

  if (headings.length === 0) {
    add("no-heading", "fix", "No heading: open with one <Heading level={1}> that states the point of the email.");
  }
  const h1 = headings.filter((h) => h.level === 1);
  if (h1.length > 1) add("multiple-h1", "check", `${h1.length} level-1 headings; keep one H1 and use level 2 for section titles.`, h1[1]!.id);
  if (doc.category === "marketing" && buttons.length === 0 && links === 0) {
    add("no-action", "fix", "A marketing email with no button or link: give it one clear primary action.");
  }
  const primaryish = buttons.filter((b) => b.backgroundColor.toLowerCase() !== "transparent");
  if (primaryish.length > 3) {
    add("too-many-buttons", "check", `${primaryish.length} buttons compete; one primary action (repeated once at the end at most), and text links for the rest.`, primaryish[3]!.id);
  }
  for (const h of buttonStyleHints(primaryish)) add(h.rule, h.severity, h.message, h.blockId);
  // Variables that fill themselves (contact fields, workspace branding,
  // the managed footer) don't count against the email.
  const custom = new Set(
    [...JSON.stringify(doc.blocks).matchAll(/\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g)].map((m) => m[1]!).filter((v) => !SELF_FILLING.has(v.toLowerCase())),
  );
  if (custom.size > 6) {
    add("variable-heavy", "check", `${custom.size} custom {{variables}} (${[...custom].slice(0, 8).join(", ")}); write in what you already know and keep variables for per-recipient or per-send data.`);
  }
  if (!doc.previewText.trim()) {
    add("no-preview-text", "check", "No preview text: add a short line that complements the subject (inboxes show it right after it).");
  }
  // Dark mode (dark-mode.ts): the dark palette's text and links must read on
  // its card, or readers on a dark device get copy they can't see.
  if (darkModeEnabled(doc.theme)) {
    const dark = darkContrast(doc.theme);
    const palette = darkPalette(doc.theme);
    const textSev = dark.text === null ? "fix" : contrastSeverity(dark.text, 4.5);
    if (textSev) {
      add("dark-contrast", textSev, `In dark mode the text (${palette.textColor}) is hard to read on the card (${palette.bodyColor}${dark.text === null ? "" : `, ${dark.text.toFixed(1)}:1`}); set theme.darkColors.textColor to ${shadeToContrast(palette.textColor, palette.bodyColor, 4.5)}, or darkMode "off".`);
    }
    const linkSev = dark.link === null ? "fix" : contrastSeverity(dark.link, 4.5);
    if (linkSev) {
      add("dark-contrast", linkSev, `In dark mode the links (${palette.linkColor}) are hard to read on the card (${palette.bodyColor}); set theme.darkColors.linkColor to ${shadeToContrast(palette.linkColor, palette.bodyColor, 4.5)}.`);
    }
    // Verifier on #1056: where a conditional background doesn't apply, that
    // block's dark copy sits on the dark card.
    for (const id of conditionalBgBlocks(doc.blocks)) {
      add("dark-contrast", "check", `In dark mode a background that applies only at some widths or states (sm:, hover:, …) keeps this block's text in its light-mode colour everywhere, so where the background doesn't apply the text is hard to read on the dark card; use an unconditional bg- class, or darkMode "off".`, id);
    }
  }
  const order = { fix: 0, check: 1 } as const;
  const seen = new Set<string>();
  return out
    .sort((a, b) => order[a.severity] - order[b.severity])
    .filter((h) => {
      const k = `${h.rule}:${h.blockId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, opts.max ?? 8);
}

// ---------------------------------------------------------------------------
// Buttons in one email share one look. A button added to an existing email
// came out square-cornered next to the email's fully rounded one (owner
// report 2026-10-26): the author wrote a new <Button> without the existing
// one's border-radius, so it took the default. The shape the most buttons
// already have wins (the first one's on a tie); a different shape is a "fix",
// a different fill only a "check" (a light button on a dark band can be right).
// ---------------------------------------------------------------------------

function mostCommon<T extends string | number>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0] as T;
  for (const v of values) if (counts.get(v)! > counts.get(best)!) best = v;
  return best;
}

export function buttonStyleHints(buttons: ButtonBlock[]): DesignHint[] {
  if (buttons.length < 2) return [];
  const out: DesignHint[] = [];
  const radius = mostCommon(buttons.map((b) => b.borderRadius));
  const model = buttons.find((b) => b.borderRadius === radius)!;
  for (const b of buttons) {
    if (b.borderRadius !== radius) {
      out.push({
        rule: "button-style",
        severity: "fix",
        message: `Button "${b.text}" has border-radius={${b.borderRadius}} but "${model.text}" has border-radius={${radius}}; buttons in one email share one shape, so give it border-radius={${radius}}${b.innerPaddingY !== model.innerPaddingY || b.innerPaddingX !== model.innerPaddingX ? ` and the same inner padding (inner-padding-x={${model.innerPaddingX}} inner-padding-y={${model.innerPaddingY}})` : ""}.`,
        blockId: b.id,
      });
    }
  }
  const fill = mostCommon(buttons.map((b) => b.backgroundColor.toLowerCase()));
  const filled = buttons.find((b) => b.backgroundColor.toLowerCase() === fill)!;
  for (const b of buttons) {
    if (b.backgroundColor.toLowerCase() !== fill) {
      out.push({
        rule: "button-style",
        severity: "check",
        message: `Button "${b.text}" is ${b.backgroundColor} while "${filled.text}" is ${filled.backgroundColor}; use the same colours for every button unless this one sits on a band where that colour wouldn't show.`,
        blockId: b.id,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Layout: spacing rhythm and email-safe CSS.
//
// One source per gap: a band's padding is the space around its content, the
// last block in a band has no bottom margin, and nothing else (a spacer, a
// margin) is stacked on top. Adjacent bands' paddings add up (table cells
// don't collapse), so two 28px bands sit 56px apart — that's the rhythm.
// CSS sticks to what tables + inline styles carry in Gmail and Outlook.
// ---------------------------------------------------------------------------

type Spaced = { padding?: { top?: number; right?: number; bottom?: number; left?: number }; paddingX?: number; paddingY?: number };
const padOf = (b: Spaced) => ({
  top: b.padding?.top ?? b.paddingY ?? 0,
  bottom: b.padding?.bottom ?? b.paddingY ?? 0,
  left: b.padding?.left ?? b.paddingX ?? 0,
});
const marginBottomOf = (b: unknown) => {
  const m = b as { margin?: { bottom?: number }; marginBottom?: number };
  return m.margin?.bottom ?? m.marginBottom ?? 0;
};
const TAG: Record<string, string> = { text: "Text", heading: "Heading", list: "List", button: "Button", link: "Link", code: "Code", markdown: "Markdown" };

// Gmail / Outlook (Word) drop or mangle these; layout comes from tables.
const UNSAFE_CSS = /display\s*:\s*(inline-)?(flex|grid)|position\s*:\s*(absolute|fixed|relative|sticky)|\bfloat\s*:|(^|;)\s*(row-|column-)?gap\s*:|\btransform\s*:|calc\(|var\(--|\d(vh|vw|dvh)\b|\b(animation|transition|clip-path|z-index)\s*:|margin[a-z-]*\s*:\s*-\d/i;
const UNSAFE_CLASS = /(^|\s)(sm:|md:|lg:)?(flex|inline-flex|grid|absolute|fixed|relative|sticky|float-\w+|gap-\S+|-?translate-\S+|z-\S+|-m[trblxy]?-\S+)(\s|$)/;

/** Spacing and CSS hints for the top-level band structure. */
export function layoutHints(doc: EmailDocument): DesignHint[] {
  const out: DesignHint[] = [];
  const add = (rule: DesignHintRule, severity: DesignHint["severity"], message: string, blockId: string | null = null) => out.push({ rule, severity, message, blockId });
  const bodyPad = doc.theme.bodyPaddingSides?.left ?? doc.theme.bodyPadding;

  // CSS anywhere in the tree.
  const cssOf = (b: { id: string; customCss?: string; className?: string }) => {
    const css = b.customCss ?? "";
    const m = UNSAFE_CSS.exec(css);
    if (m) add("unsafe-css", "fix", `custom-css "${m[0].trim()}" isn't supported by Gmail or Outlook; get the layout from Section/Row/Column padding and alignment instead.`, b.id);
    else if (/background-image\s*:\s*url\(/i.test(css)) add("unsafe-css", "check", "A CSS background image doesn't show in Outlook desktop; use a solid background-color, or an <Image> block.", b.id);
    else if (/background-image\s*:\s*linear-gradient/i.test(css)) add("unsafe-css", "check", "Write a gradient as `background: #4f46e5 linear-gradient(…)` (the shorthand, solid colour first) with a background-color: Gmail on Android corrupts background-image gradients.", b.id);
    const c = UNSAFE_CLASS.exec(b.className ?? "");
    if (c) add("unsafe-css", "fix", `className "${c[2]}" compiles to CSS Gmail or Outlook don't support; use the components' own props.`, b.id);
  };
  const walk = (blocks: unknown[]) => {
    for (const raw of blocks) {
      const b = raw as { id: string; type: string; children?: unknown[]; columns?: unknown[]; customCss?: string; className?: string };
      cssOf(b);
      if (b.children) walk(b.children);
      if (b.columns) walk(b.columns);
    }
  };
  walk(doc.blocks as unknown[]);

  // Last block in a padded container: its margin stacks on the padding.
  let doubled = 0;
  let doubledId: string | null = null;
  const lastMargins = (blocks: unknown[]) => {
    for (const raw of blocks) {
      const b = raw as { id: string; type: string; children?: unknown[]; columns?: unknown[] } & Spaced;
      const kids = b.type === "section" ? b.children : b.type === "column" ? b.children : undefined;
      if (kids?.length) {
        const last = kids[kids.length - 1] as { type: string };
        const pad = padOf(b).bottom;
        if (last.type !== "section" && last.type !== "spacer" && pad >= 12 && marginBottomOf(last) >= 12) {
          doubled++;
          doubledId ??= b.id;
        }
        lastMargins(kids);
      }
      if (b.columns) lastMargins(b.columns);
    }
  };
  lastMargins(doc.blocks as unknown[]);
  if (doubled) {
    add("spacing-doubled", "check", `${doubled} section${doubled === 1 ? "" : "s"} end with a block whose margin-bottom stacks on the section's padding (uneven space top vs bottom); set margin-bottom={0} on the last block.`, doubledId);
  }

  // Top-level rhythm: the space between consecutive bands.
  type Band = { id: string; type: string; top: number; bottom: number; bg: string; content: boolean };
  let prev: Band | null = null;
  let spacer = 0;
  for (const raw of doc.blocks as unknown[]) {
    const b = raw as { id: string; type: string; height?: number; backgroundColor?: string; children?: unknown[]; columns?: unknown[]; width?: number } & Spaced;
    if (b.type === "spacer") {
      spacer += b.height ?? 0;
      continue;
    }
    if (b.type === "divider") {
      // A hairline separates; each side needs its own breathing room.
      if (prev && prev.content && (prev.type === "section" || prev.type === "row") && prev.bottom + spacer < 12) add("tight-spacing", "check", `Content sits ${prev.bottom + spacer}px above a divider; give the section above padding-y of 24 or more.`, prev.id);
      prev = { id: b.id, type: "divider", top: 0, bottom: marginBottomOf(b), bg: "", content: false };
      spacer = 0;
      continue;
    }
    const container = b.type === "section" || b.type === "row";
    const kids = (b.type === "section" ? b.children : undefined) ?? [];
    const lastKid = kids[kids.length - 1];
    const pad = container ? padOf(b) : { top: 0, bottom: 0, left: 0 };
    const cur: Band = {
      id: b.id,
      type: b.type,
      top: pad.top,
      bottom: pad.bottom + (lastKid ? marginBottomOf(lastKid) : container ? 0 : marginBottomOf(b)),
      bg: (b.backgroundColor ?? doc.theme.bodyColor).toLowerCase(),
      content: container ? kids.length > 0 || (b.columns?.length ?? 0) > 0 : b.type !== "html",
    };
    // A leaf (or a band with no side padding) straight in an edge-to-edge card touches the card's edges.
    if (bodyPad < 12 && cur.content && b.type !== "image") {
      if (!container && TAG[b.type]) add("edge-gutter", "fix", `A <${TAG[b.type]}> sits directly in the card with no side padding (body-padding is ${bodyPad}); put it inside a <Section padding-x={32}>.`, b.id);
      else if (container && pad.left < 12 && !b.backgroundColor) add("edge-gutter", "check", `A ${b.type === "row" ? "<Row>" : "<Section>"} has ${pad.left}px side padding in an edge-to-edge card, so its content touches the edges; use padding-x={32}.`, b.id);
    }
    // Rhythm is between bands (Sections, Rows). Loose top-level blocks in a
    // padded card space like paragraphs, with their own margins.
    if (prev && cur.content && container && (prev.type === "divider" || prev.type === "section" || prev.type === "row")) {
      const sameBg = prev.bg === cur.bg;
      if (prev.type === "divider") {
        if (cur.top + spacer < 12) add("tight-spacing", "check", `Content starts ${cur.top + spacer}px below a divider; give the section padding-y of 24 or more.`, cur.id);
      } else if (prev.content && sameBg) {
        const gap = prev.bottom + spacer + cur.top;
        if (gap < 20) add("tight-spacing", gap < 12 ? "fix" : "check", `Two sections sit ${gap}px apart; give each padding-y of 24–32 — the padding is the gap, no extra spacers.`, cur.id);
        else if (gap > 96) add("loose-spacing", "check", `${gap}px of empty space between two sections (padding ${prev.bottom} + spacer ${spacer} + padding ${cur.top}); padding alone spaces sections, so drop the spacer or a margin.`, cur.id);
      } else if (prev.content && !sameBg) {
        // A colour change separates on its own; each band still needs room inside.
        if (container && b.backgroundColor && cur.top < 16) add("tight-spacing", "check", `Content starts ${cur.top}px from the top of a coloured band; give it padding-y of 24 or more.`, cur.id);
      }
    }
    prev = cur;
    spacer = 0;
  }
  return out;
}