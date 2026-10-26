// Themed bands — the building blocks of the EMAIL_DESIGN.md system
// (design-guide.ts).
//
// Each builder returns one full-bleed band (a <Section> or top-level <Row>)
// that carries its own 32px side gutter, so an email built from them uses
// `body-padding={0}` and tinted / contrast / gradient bands reach the card's
// edges. Every builder takes a BrandPalette, so the same band renders in the
// neutral ink system or in a workspace's brand colours, and its copy, so a
// recipe can fill it with words that fit the email type. layouts.ts registers
// each band (with neutral palette and sample copy) for the editor's Layouts
// rail and design_library; design-guide.ts composes them into whole emails.
//
// No stock-photo URLs: imagery is our hosted icons and neutral placeholders
// (email-assets.ts), a Brand Kit logo, or nothing.

import { newBlockId } from "./blocks";
import { contrastRatio, isDark, mix, normalizeHex, parseColor, readableTextOn, shadeToContrast } from "./color";
import {
  EMAIL_ICON_SIZE,
  emailIconUrl,
  emailPlaceholderUrl,
  type EmailIconName,
  type EmailIconVariant,
} from "./email-assets";

/** Side gutter (px) of every themed band. */
export const BAND_GUTTER = 32;
/** Vertical padding (px) of a content band; adjacent bands sit twice this apart. */
export const BAND_Y = 28;
/** Vertical padding around a card band (callout, offer, closing CTA): cards sit 32px apart, 44px from text bands. */
export const CARD_BAND_Y = 16;
/** Content width (px) the bands are drawn for; images inside a band are this minus both gutters. */
export const BAND_CONTENT_WIDTH = 600;
const INNER = BAND_CONTENT_WIDTH - 2 * BAND_GUTTER;

export type BrandPalette = {
  /** Headings and the strongest text. */
  ink: string;
  /** Body copy. */
  body: string;
  /** Secondary copy, labels. */
  muted: string;
  /** The email card. */
  surface: string;
  /** The backdrop around the card. */
  page: string;
  /** Hairlines and dividers. */
  border: string;
  /** Neutral tinted band (summaries, code cards, stats). */
  tint: string;
  /** The brand colour: primary button fill. */
  accent: string;
  /** Button label on `accent`. */
  onAccent: string;
  /** `accent` shaded to read as small text on `surface` (overlines, links). */
  accentText: string;
  /** Very light accent wash (callouts, label pills). */
  accentTint: string;
  accentBorder: string;
  /** Contrast band fill (hero, offer, CTA card); also the gradient's solid fallback. */
  band: string;
  /** Second stop of the gradient hero. */
  bandTo: string;
  onBand: string;
  onBandMuted: string;
  /** Button on a contrast band. */
  bandButton: string;
  bandButtonText: string;
  /** Confirmation green, dark enough for small text on `surface`. */
  success: string;
};

export const NEUTRAL_INK = "#18181b";

/**
 * The palette every themed band draws from. With no accent it is the neutral
 * ink system (the safe default for a workspace with no Brand Kit); with a
 * brand accent, the button, overlines, links, washes and contrast bands all
 * derive from it, and every text colour is chosen to pass contrast on the
 * background it sits on.
 */
export function brandPalette(opts: { accent?: string | null } = {}): BrandPalette {
  const accent = opts.accent && parseColor(opts.accent) ? normalizeHex(opts.accent) : NEUTRAL_INK;
  const neutral = accent === NEUTRAL_INK;
  const surface = "#ffffff";
  // A light brand colour can't carry white text on a contrast band; deepen it.
  const band = neutral ? NEUTRAL_INK : isDark(accent) || (contrastRatio(accent, "#ffffff") ?? 0) >= 4.5 ? accent : shadeToContrast(accent, "#ffffff", 4.5);
  const onBand = readableTextOn(band);
  // Secondary text on the band: a softened onBand, unless that drops under AA.
  const softened = onBand === "#ffffff" ? mix(band, "#ffffff", 0.82) : mix(band, NEUTRAL_INK, 0.75);
  const onBandMuted = (contrastRatio(softened, band) ?? 0) >= 4.5 ? softened : onBand;
  return {
    ink: NEUTRAL_INK,
    body: "#3f3f46",
    muted: "#71717a",
    surface,
    page: "#f4f4f5",
    border: "#e4e4e7",
    tint: "#fafafa",
    accent,
    onAccent: readableTextOn(accent),
    accentText: neutral ? NEUTRAL_INK : shadeToContrast(accent, surface, 4.5),
    accentTint: neutral ? "#f4f4f5" : mix(accent, "#ffffff", 0.92),
    accentBorder: neutral ? "#e4e4e7" : mix(accent, "#ffffff", 0.78),
    band,
    bandTo: neutral ? "#3f3f46" : mix(band, "#000000", 0.35),
    onBand,
    onBandMuted,
    bandButton: onBand === "#ffffff" ? "#ffffff" : NEUTRAL_INK,
    bandButtonText: onBand === "#ffffff" ? (neutral ? NEUTRAL_INK : shadeToContrast(band, "#ffffff", 4.5)) : "#ffffff",
    success: "#15803d",
  };
}

export const NEUTRAL_PALETTE: BrandPalette = brandPalette();

/** Who the email is from: the wordmark / logo in the header and the sign-off. */
export type BandBrand = { name: string; logo?: string | null };

// ------------------------------------------------------------ primitives --

/** A block literal before schema parsing (defaults fill in on parse). */
export type BandBlock = Record<string, unknown>;
type B = BandBlock;
export type Cta = { label: string; href: string };

const id = () => newBlockId();
const textBlock = (t: string, extra: B = {}): B => ({ type: "text", id: id(), text: t, ...extra });
const headingBlock = (t: string, extra: B = {}): B => ({ type: "heading", id: id(), text: t, ...extra });
/**
 * A section's padding is the space around its content: the last block keeps no
 * bottom margin, or the two would stack (uneven space, doubled gaps).
 */
const settle = (children: B[]): B[] =>
  children.map((c, i) => (i === children.length - 1 && c.type !== "section" && c.type !== "spacer" ? { ...c, marginBottom: 0 } : c));
// A band with no vertical padding (tight) spaces with its last block's margin, so that one stays.
const section = (children: B[], extra: B = {}): B => ({ type: "section", id: id(), children: extra.paddingY === 0 ? children : settle(children), ...extra });
const row = (columns: B[], extra: B = {}): B => ({ type: "row", id: id(), columns, ...extra });
const column = (children: B[], width: number, extra: B = {}): B => ({ type: "column", id: id(), width, children, ...extra });
const imageBlock = (src: string, alt: string, extra: B = {}): B => ({ type: "image", id: id(), src, alt, align: "left", marginBottom: 0, ...extra });

const band = (children: B[], extra: B = {}): B => section(children, { paddingX: BAND_GUTTER, paddingY: BAND_Y, ...extra });
/** Upper-case a label but leave {{variables}} as written (they're case-sensitive). */
export const upperLabel = (label: string): string => label.replace(/(\{\{[^}]*\}\})|([^{]+|\{)/g, (_m, v: string | undefined, t: string) => v ?? t.toUpperCase());
const overline = (label: string, color: string, extra: B = {}): B =>
  textBlock(upperLabel(label), { fontSize: 12, fontWeight: "600", letterSpacing: 0.72, color, marginBottom: 8, ...extra });
const h1 = (t: string, color: string, extra: B = {}): B =>
  headingBlock(t, { level: 1, fontSize: 28, lineHeight: "1.2", letterSpacing: -0.56, color, marginBottom: 12, ...extra });
const h2 = (t: string, color: string, extra: B = {}): B =>
  headingBlock(t, { level: 2, fontSize: 22, lineHeight: "1.3", letterSpacing: -0.44, color, marginBottom: 12, ...extra });
const lead = (t: string, color: string, extra: B = {}): B => textBlock(t, { fontSize: 16, lineHeight: "1.6", color, marginBottom: 24, ...extra });
const copy = (t: string, color: string, extra: B = {}): B => textBlock(t, { fontSize: 15, lineHeight: "1.6", color, marginBottom: 16, ...extra });
const pill = (cta: Cta, bg: string, fg: string, extra: B = {}): B => ({
  type: "button",
  id: id(),
  text: cta.label,
  href: cta.href,
  align: "left",
  backgroundColor: bg,
  textColor: fg,
  borderRadius: 9999,
  innerPaddingX: 24,
  innerPaddingY: 12,
  marginBottom: 0,
  ...extra,
});
const arrowLink = (cta: Cta, color: string, extra: B = {}): B => ({
  type: "link",
  id: id(),
  text: cta.label,
  href: cta.href,
  align: "left",
  fontSize: 15,
  color,
  underline: false,
  marginBottom: 0,
  customCss: "font-weight: 600",
  ...extra,
});
const icon = (name: EmailIconName, variant: EmailIconVariant, extra: B = {}): B =>
  imageBlock(emailIconUrl(name, variant), "", { width: EMAIL_ICON_SIZE[variant], ...extra });
const listBlock = (items: string[], color: string, extra: B = {}): B => ({
  type: "list",
  id: id(),
  items: items.map((t) => ({ text: t })),
  fontSize: 15,
  lineHeight: "1.6",
  color,
  marginBottom: 16,
  ...extra,
});
const divider = (color: string): B => ({ type: "divider", id: id(), color, marginBottom: 0 });
const spacer = (height: number): B => ({ type: "spacer", id: id(), height });
// Vertical rhythm uses only what TSX can carry (padding-x / padding-y,
// margin-bottom, <Spacer>): the codec drops per-side padding and margin
// boxes, and agents author these bands as TSX.
/** A band with no vertical padding, wrapped in spacers for uneven space above and below. */
const tight = (children: B[], top: number, bottom: number): B[] => [
  ...(top > 0 ? [spacer(top)] : []),
  band(children, { paddingY: 0 }),
  ...(bottom > 0 ? [spacer(bottom)] : []),
];

// ---------------------------------------------------------------- bands --

const labelPill = (label: string, p: BrandPalette): B =>
  textBlock(label, {
    align: "right",
    fontSize: 12,
    fontWeight: "600",
    color: p.accentText,
    marginBottom: 0,
    customCss: `display: inline-block; padding: 4px 10px; border-radius: 999px; background-color: ${p.accentTint}`,
  });

/** Logo + brand name on the left, an optional label pill on the right. Without a logo it is the wordmark header. */
export function headerBrand(p: BrandPalette, brand: BandBrand, opts: { label?: string | null } = {}): B[] {
  const label = opts.label?.trim();
  const name = (width: number) =>
    column([textBlock(brand.name, { fontSize: brand.logo ? 16 : 18, fontWeight: "700", letterSpacing: brand.logo ? -0.16 : -0.36, color: p.ink, marginBottom: 0 })], width, {
      paddingX: 0,
      customCss: "vertical-align: middle",
    });
  const columns = [
    ...(brand.logo
      ? [column([imageBlock(brand.logo, brand.name, { width: 28, borderRadius: 8 })], 10, { paddingX: 0, customCss: "vertical-align: middle; width: 40px" })]
      : []),
    name((brand.logo ? 90 : 100) - (label ? 40 : 0)),
    ...(label ? [column([labelPill(label, p)], 40, { paddingX: 0, customCss: "vertical-align: middle; text-align: right" })] : []),
  ];
  return [row(columns, { paddingX: BAND_GUTTER, paddingY: 22, columnGap: 0, stackOnMobile: false })];
}

/** The brand name as a wordmark (no logo image), with an optional label pill. */
export function headerWordmark(p: BrandPalette, brand: BandBrand, opts: { label?: string | null } = {}): B[] {
  return headerBrand(p, { name: brand.name, logo: null }, opts);
}

export type HeroCopy = { overline?: string; title: string; lead: string; cta?: Cta };

export function heroHeadline(p: BrandPalette, c: HeroCopy): B[] {
  return [
    band(
      [
        ...(c.overline ? [overline(c.overline, p.accentText)] : []),
        h1(c.title, p.ink),
        lead(c.lead, p.body, c.cta ? {} : { marginBottom: 0 }),
        ...(c.cta ? [pill(c.cta, p.accent, p.onAccent)] : []),
      ],
      { paddingY: 32 },
    ),
  ];
}

function heroOnBand(p: BrandPalette, c: HeroCopy, extra: B): B[] {
  return [
    band(
      [
        ...(c.overline ? [overline(c.overline, p.onBandMuted)] : []),
        h1(c.title, p.onBand, { fontSize: 32, letterSpacing: -0.64 }),
        lead(c.lead, p.onBandMuted, c.cta ? {} : { marginBottom: 0 }),
        ...(c.cta ? [pill(c.cta, p.bandButton, p.bandButtonText)] : []),
      ],
      { backgroundColor: p.band, paddingY: 44, ...extra },
    ),
  ];
}

export const heroContrast = (p: BrandPalette, c: HeroCopy): B[] => heroOnBand(p, c, {});

/**
 * Solid `band` colour first (Outlook, Yahoo and Outlook.com show only that), the gradient as the `background` shorthand (Gmail Android corrupts inline background-image).
 * The shorthand repeats the solid colour: on its own it resets background-color, and mail apps that "fix" invisible text then see white on nothing and darken the headline.
 */
export const heroGradient = (p: BrandPalette, c: HeroCopy): B[] =>
  heroOnBand(p, c, { customCss: `background: ${p.band} linear-gradient(135deg, ${p.band} 0%, ${p.bandTo} 100%)` });

export function heroStatus(p: BrandPalette, c: { icon?: EmailIconName; overline: string; title: string; line: string; tone?: "success" | "neutral" }): B[] {
  return [
    band(
      [
        ...(c.icon ? [icon(c.icon, "soft", { align: "center", marginBottom: 16 })] : []),
        overline(c.overline, c.tone === "neutral" ? p.muted : p.success, { align: "center" }),
        h1(c.title, p.ink, { align: "center" }),
        copy(c.line, p.body, { align: "center", marginBottom: 0 }),
      ],
      { paddingY: 36 },
    ),
  ];
}

export function heroMedia(p: BrandPalette, c: HeroCopy & { image?: string; alt: string }): B[] {
  return [
    ...tight([imageBlock(c.image ?? emailPlaceholderUrl("wide"), c.alt, { width: INNER, borderRadius: 12 })], 24, 0),
    ...heroHeadline(p, c).map((b) => ({ ...b, paddingY: 24 })),
  ];
}

export function textBand(p: BrandPalette, c: { paragraphs: string[]; cta?: Cta; align?: "left" | "center" }): B[] {
  const align = c.align ?? "left";
  return [
    band([
      ...c.paragraphs.map((t, i) => copy(t, p.body, { align, marginBottom: i === c.paragraphs.length - 1 && !c.cta ? 0 : 16 })),
      ...(c.cta ? [spacer(8), pill(c.cta, p.accent, p.onAccent, { align })] : []),
    ]),
  ];
}

export function feature(p: BrandPalette, c: { overline?: string; title: string; body: string; bullets?: string[]; link?: Cta; image?: { src: string; alt: string } }): B[] {
  return [
    band([
      ...(c.overline ? [overline(c.overline, p.accentText)] : []),
      h2(c.title, p.ink),
      ...(c.image ? [imageBlock(c.image.src, c.image.alt, { width: INNER, borderRadius: 12, marginBottom: 18 })] : []),
      copy(c.body, p.body, !c.bullets?.length && !c.link ? { marginBottom: 0 } : {}),
      ...(c.bullets?.length ? [listBlock(c.bullets, p.body, c.link ? {} : { marginBottom: 0 })] : []),
      ...(c.link ? [arrowLink(c.link, p.accentText)] : []),
    ]),
  ];
}

export type IconRow = { icon: EmailIconName; title: string; line: string };

export function iconRows(p: BrandPalette, c: { title?: string; rows: IconRow[] }): B[] {
  const rows = c.rows.map((r, i) =>
    row(
      [
        column([icon(r.icon, "soft")], 12, { paddingX: 0, customCss: "width: 56px" }),
        column(
          [
            textBlock(r.title, { fontSize: 16, fontWeight: "600", color: p.ink, marginBottom: 4 }),
            textBlock(r.line, { fontSize: 15, lineHeight: "1.55", color: p.body, marginBottom: 0 }),
          ],
          88,
          { paddingX: 0 },
        ),
      ],
      { paddingX: BAND_GUTTER, paddingY: 10, columnGap: 0, stackOnMobile: false },
    ),
  );
  // Title → first row: 10 (title margin) + 10 (row padding) = 20; rows 20 apart; last row + spacer = the band's 28.
  return [...(c.title ? tight([h2(c.title, p.ink, { marginBottom: 10 })], 28, 0) : [spacer(18)]), ...rows, spacer(18)];
}

export function stats(p: BrandPalette, c: { items: { value: string; label: string }[] }): B[] {
  const w = Math.floor(100 / c.items.length);
  return [
    row(
      c.items.map((s, i) =>
        column(
          [
            headingBlock(s.value, { level: 3, fontSize: 28, lineHeight: "1.1", letterSpacing: -0.56, align: "center", color: p.accentText, marginBottom: 4 }),
            textBlock(s.label, { fontSize: 13, align: "center", color: p.muted, marginBottom: 0 }),
          ],
          i === c.items.length - 1 ? 100 - w * (c.items.length - 1) : w,
          { paddingX: 4 },
        ),
      ),
      { paddingX: BAND_GUTTER, paddingY: 24, columnGap: 8, backgroundColor: p.tint, stackOnMobile: false },
    ),
  ];
}

export type SummaryLine = { label: string; value: string };

export function summary(p: BrandPalette, c: { heading: string; meta?: string; lines: SummaryLine[]; total?: SummaryLine }): B[] {
  const all = [...c.lines.map((l) => ({ ...l, strong: false })), ...(c.total ? [{ ...c.total, strong: true }] : [])];
  const cell = (t: string, strong: boolean, right: boolean) =>
    textBlock(t, {
      ...(right ? { align: "right" } : {}),
      fontSize: strong ? 15 : 14,
      ...(strong ? { fontWeight: "700" } : {}),
      color: strong ? p.ink : p.body,
      marginBottom: 10,
    });
  return [
    row(
      [
        column([overline(c.heading, p.muted, { marginBottom: 12 }), ...all.map((l) => cell(l.label, l.strong, false))], 62, { paddingX: 0 }),
        column([textBlock(c.meta ?? " ", { align: "right", fontSize: 12, color: p.muted, marginBottom: 12 }), ...all.map((l) => cell(l.value, l.strong, true))], 38, { paddingX: 0 }),
      ],
      { paddingX: BAND_GUTTER, paddingY: 24, columnGap: 8, backgroundColor: p.tint, stackOnMobile: false },
    ),
  ];
}

export function codeCard(p: BrandPalette, c: { label: string; code: string; note: string }): B[] {
  return [
    band(
      [
        section(
          [
            textBlock(c.label, { align: "center", fontSize: 13, color: p.muted, marginBottom: 8 }),
            headingBlock(c.code, { level: 2, align: "center", fontSize: 34, letterSpacing: 8, color: p.ink, marginBottom: 8 }),
            textBlock(c.note, { align: "center", fontSize: 13, color: p.muted, marginBottom: 0 }),
          ],
          { backgroundColor: p.tint, paddingX: 24, paddingY: 24, border: { width: 1, style: "solid", color: p.border, radius: 12 } },
        ),
      ],
      { paddingY: 0 },
    ),
    spacer(28),
  ];
}

export function callout(p: BrandPalette, c: { overline?: string; title: string; body: string; link?: Cta }): B[] {
  return [
    band(
      [
        section(
          [
            ...(c.overline ? [overline(c.overline, p.accentText)] : []),
            headingBlock(c.title, { level: 3, fontSize: 18, lineHeight: "1.35", color: p.ink, marginBottom: 8 }),
            copy(c.body, p.body, { marginBottom: c.link ? 12 : 0 }),
            ...(c.link ? [arrowLink(c.link, p.accentText)] : []),
          ],
          { backgroundColor: p.accentTint, paddingX: 24, paddingY: 22, border: { width: 1, style: "solid", color: p.accentBorder, radius: 14 } },
        ),
      ],
      { paddingY: CARD_BAND_Y },
    ),
  ];
}

export function offer(p: BrandPalette, c: { overline?: string; title: string; line?: string; code?: string; cta: Cta; terms?: string }): B[] {
  return [
    band(
      [
        section(
          [
            ...(c.overline ? [overline(c.overline, p.onBandMuted, { align: "center" })] : []),
            headingBlock(c.title, { level: 2, align: "center", fontSize: 36, lineHeight: "1.15", letterSpacing: -0.72, color: p.onBand, marginBottom: 12 }),
            ...(c.line ? [textBlock(c.line, { align: "center", fontSize: 15, lineHeight: "1.55", color: p.onBandMuted, marginBottom: c.code ? 16 : 20 })] : []),
            ...(c.code
              ? [
                  textBlock(c.code, {
                    align: "center",
                    fontSize: 18,
                    fontWeight: "700",
                    letterSpacing: 2,
                    color: p.onBand,
                    marginBottom: 20,
                    customCss: `display: inline-block; padding: 6px 16px; border: 1px dashed ${p.onBandMuted}; border-radius: 8px`,
                  }),
                ]
              : []),
            pill(c.cta, p.bandButton, p.bandButtonText, { align: "center" }),
          ],
          // The code pill is inline-block, so the cell centres it.
          { backgroundColor: p.band, paddingX: 24, paddingY: 32, border: { radius: 16 }, customCss: "text-align: center" },
        ),
        ...(c.terms ? [spacer(12), textBlock(c.terms, { align: "center", fontSize: 12, color: p.muted, marginBottom: 0 })] : []),
      ],
      { paddingY: CARD_BAND_Y },
    ),
  ];
}

export function eventDetails(p: BrandPalette, c: { title?: string; rows: { icon: EmailIconName; label: string; value: string }[]; link?: Cta }): B[] {
  const rows = c.rows.map((r) =>
    row(
      [
        column([icon(r.icon, "ink")], 8, { paddingX: 0, customCss: "width: 36px" }),
        column(
          [
            textBlock(upperLabel(r.label), { fontSize: 12, fontWeight: "600", letterSpacing: 0.48, color: p.muted, marginBottom: 2 }),
            textBlock(r.value, { fontSize: 15, color: p.ink, marginBottom: 0 }),
          ],
          92,
          { paddingX: 0 },
        ),
      ],
      { paddingX: BAND_GUTTER, paddingY: 10, columnGap: 0, stackOnMobile: false },
    ),
  );
  return [
    ...tight([h2(c.title ?? "Details", p.ink, { marginBottom: 10 })], 28, 0),
    ...rows,
    ...(c.link ? tight([arrowLink(c.link, p.accentText)], 10, 28) : [spacer(18)]),
  ];
}

export type ProductTile = { name: string; price: string; href: string; image?: string };

export function products(p: BrandPalette, c: { items: [ProductTile, ProductTile] }): B[] {
  const tile = (t: ProductTile) =>
    column(
      [
        imageBlock(t.image ?? emailPlaceholderUrl("square"), t.name, { width: (INNER - 16) / 2, borderRadius: 10, marginBottom: 12 }),
        textBlock(t.name, { fontSize: 15, fontWeight: "600", color: p.ink, marginBottom: 2 }),
        textBlock(t.price, { fontSize: 14, color: p.muted, marginBottom: 8 }),
        arrowLink({ label: "Shop →", href: t.href }, p.accentText, { fontSize: 14 }),
      ],
      50,
      { paddingX: 0 },
    );
  return [row(c.items.map(tile), { paddingX: BAND_GUTTER, paddingY: 8, columnGap: 16 })];
}

export function ctaContrast(p: BrandPalette, c: { title: string; line?: string; cta: Cta }): B[] {
  return [
    band(
      [
        section(
          [
            headingBlock(c.title, { level: 2, align: "center", fontSize: 22, lineHeight: "1.3", color: p.onBand, marginBottom: 8 }),
            ...(c.line ? [textBlock(c.line, { align: "center", fontSize: 15, color: p.onBandMuted, marginBottom: 20 })] : []),
            pill(c.cta, p.bandButton, p.bandButtonText, { align: "center" }),
          ],
          { backgroundColor: p.band, paddingX: 24, paddingY: 32, border: { radius: 16 } },
        ),
      ],
      { paddingY: CARD_BAND_Y },
    ),
  ];
}

export function buttonBand(p: BrandPalette, c: { cta: Cta; align?: "left" | "center"; note?: string }): B[] {
  return tight(
    [
      pill(c.cta, p.accent, p.onAccent, { align: c.align ?? "left", marginBottom: c.note ? 16 : 0 }),
      ...(c.note ? [textBlock(c.note, { align: c.align ?? "left", fontSize: 13, lineHeight: "1.55", color: p.muted, marginBottom: 0 })] : []),
    ],
    24,
    28,
  );
}

export function signoff(p: BrandPalette, c: { help: string; signature?: string; small?: string }): B[] {
  return [
    divider(p.border),
    band([
      copy(c.help, p.body, { marginBottom: c.signature || c.small ? 12 : 0 }),
      ...(c.signature ? [copy(c.signature, p.body, { marginBottom: c.small ? 12 : 0 })] : []),
      ...(c.small ? [textBlock(c.small, { fontSize: 13, lineHeight: "1.55", color: p.muted, marginBottom: 0 })] : []),
    ]),
  ];
}
