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
// No stock-photo URLs here: a band takes its imagery as an argument (the
// sender's own image, a Brand Kit graphic, our hosted icons and neutral
// placeholders from email-assets.ts). The gallery samples pass stock photos.
//
// The openers and the newer sections below (heroBanner … brandSignature)
// come from the 2026-11-06 research (.audit/email-design-2026-11-06): every
// strong email carries ONE visual anchor in its first screen, built from a
// recipe the sender can repeat each send, and no two sections in a row share
// a shape. design-guide.ts names which opener and sections each email type
// uses.

import { newBlockId } from "./blocks";
import { contrastRatio, isDark, mix, normalizeHex, parseColor, readableTextOn, rotateHue, shadeToContrast } from "./color";
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
        // No meta: a spacer the overline's height keeps the values level with their labels
        // (a lone " " text came back from the TSX round trip as an empty block).
        column([c.meta ? textBlock(c.meta, { align: "right", fontSize: 12, color: p.muted, marginBottom: 12 }) : spacer(30), ...all.map((l) => cell(l.value, l.strong, true))], 38, { paddingX: 0 }),
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

// ============================================================== openers ==
//
// The first screen. Each opener is one repeatable recipe for the email's
// visual anchor (design-guide.ts EMAIL_OPENERS says which type uses which):
//   heroBanner    rounded campaign art, then a centred headline
//   heroPanel     a rounded colour or gradient panel: label pill, big title, art inside
//   heroPoster    a framed typographic poster, no image needed
//   heroMasthead  a newsletter's fixed nameplate with the issue line
//   heroSpot      one centred spot image (or icon), title, subtitle, hairline
//   heroSplit     a colour band with the headline beside a picture
//   heroPhoto     a photo bleeding to the card's edges over a colour-matched band
// Images are cropped to their frame at the source (fixed width and ratio in the
// URL): object-fit and CSS backgrounds don't survive classic Outlook.

/** An image a band places: the source, what it shows, and an optional link. */
export type BandImage = { src: string; alt: string; href?: string };

/** The serif stack (EMAIL_DESIGN.md): mastheads, essays, editorial titles. */
export const SERIF_STACK = "Georgia, 'Times New Roman', Times, serif";

/** Inner width of a panel (a card inside the band gutter with its own 32px padding). */
const PANEL_INNER = INNER - 64;

const linked = (img: BandImage): B => (img.href ? { href: img.href } : {});

/** A small rounded label (date, issue, state) on any background. Centre it with text-align on the parent. */
const chip = (label: string, bg: string, fg: string, extra: B = {}): B =>
  textBlock(label, {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.24,
    color: fg,
    marginBottom: 16,
    customCss: `display: inline-block; padding: 5px 12px; border-radius: 999px; background-color: ${bg}`,
    ...extra,
  });

/** A hairline inside the gutter. */
const rule = (color: string): B[] => [band([divider(color)], { paddingY: 0 })];

/** `color` darkened until white text passes 4.5:1 on it. */
const underWhite = (color: string): string => ((contrastRatio(color, "#ffffff") ?? 0) >= 4.5 ? normalizeHex(color) : shadeToContrast(color, "#ffffff", 4.5));
/** `fg` when it reads on `bg`, else `fallback`. */
const readsOn = (fg: string, bg: string, fallback: string): string => ((contrastRatio(fg, bg) ?? 0) >= 4.5 ? fg : fallback);
const gradientCss = (from: string, to: string) => `background: ${from} linear-gradient(135deg, ${from} 0%, ${to} 100%)`;

export type PanelTone = "vivid" | "wash" | "ink";

/**
 * The colours of a panel. `vivid`: the brand band fading into a neighbouring
 * hue, light text. `wash`: a pale two-tone wash of the brand, ink text. `ink`:
 * near-black whatever the brand (events, launches at night), light text.
 * Every gradient starts on its solid colour, which is all Outlook and Yahoo
 * show, and the text passes contrast on both stops.
 */
export function panelColors(p: BrandPalette, tone: PanelTone) {
  const neutral = p.accent === NEUTRAL_INK;
  if (tone === "ink") {
    const bg = NEUTRAL_INK;
    return {
      bg,
      css: gradientCss(bg, "#27272a"),
      ink: "#ffffff",
      body: "#d4d4d8",
      chipBg: neutral ? "#ffffff" : p.accent,
      chipFg: neutral ? NEUTRAL_INK : p.onAccent,
      // The brand's button stands out on near-black; with no brand, white.
      button: neutral ? "#ffffff" : p.accent,
      buttonText: neutral ? NEUTRAL_INK : p.onAccent,
    };
  }
  if (tone === "wash") {
    const bg = neutral ? "#f4f4f5" : mix(p.accent, "#ffffff", 0.86);
    const to = neutral ? "#e4e4e7" : mix(rotateHue(p.accent, 40), "#ffffff", 0.78);
    return { bg, css: gradientCss(bg, to), ink: p.ink, body: p.body, chipBg: "#ffffff", chipFg: p.accentText, button: p.accent, buttonText: p.onAccent };
  }
  const bg = p.band;
  const to = neutral ? p.bandTo : underWhite(rotateHue(p.band, 40));
  return {
    bg,
    css: gradientCss(bg, to),
    ink: p.onBand,
    body: readsOn(readsOn(p.onBandMuted, to, p.onBand), bg, p.onBand),
    chipBg: "#ffffff",
    chipFg: underWhite(p.band),
    button: p.bandButton,
    buttonText: p.bandButtonText,
  };
}

/** Rounded campaign art inside the gutter, then a centred (or left) headline, line and button. */
export function heroBanner(p: BrandPalette, c: HeroCopy & { image: BandImage; align?: "left" | "center" }): B[] {
  const align = c.align ?? "center";
  return [
    ...tight([imageBlock(c.image.src, c.image.alt, { width: INNER, borderRadius: 16, ...linked(c.image) })], 8, 0),
    band(
      [
        ...(c.overline ? [overline(c.overline, p.accentText, { align })] : []),
        h1(c.title, p.ink, { align, fontSize: 32, lineHeight: "1.15", letterSpacing: -0.64 }),
        lead(c.lead, p.body, { align, ...(c.cta ? {} : { marginBottom: 0 }) }),
        ...(c.cta ? [pill(c.cta, p.accent, p.onAccent, { align })] : []),
      ],
      { paddingY: 28 },
    ),
  ];
}

/**
 * A rounded colour panel inside the gutter: a label pill (date, issue, state),
 * a big title, a line, an optional button, and optional art inside the panel
 * (below the words, or above them with `imageFirst` for a date-first event
 * poster). The cover of a monthly update, a digest or a launch.
 */
export function heroPanel(
  p: BrandPalette,
  c: {
    label?: string;
    title: string;
    lead?: string;
    cta?: Cta;
    image?: BandImage;
    imageFirst?: boolean;
    tone?: PanelTone;
    align?: "left" | "center";
    /** A photo behind the words (Section backgroundImage, 0.6.0). Pick a dark or quiet one: the text is the tone's light text, and the tone's colour is the fallback. */
    photo?: BandImage;
  },
): B[] {
  const t = panelColors(p, c.tone ?? "vivid");
  const align = c.align ?? "left";
  const words: B[] = [
    ...(c.label ? [chip(c.label, t.chipBg, t.chipFg)] : []),
    h1(c.title, t.ink, { align, fontSize: 34, lineHeight: "1.15", letterSpacing: -0.68, marginBottom: c.lead || c.cta ? 12 : 0 }),
    ...(c.lead ? [lead(c.lead, t.body, { align, marginBottom: c.cta ? 24 : 0 })] : []),
    ...(c.cta ? [pill(c.cta, t.button, t.buttonText, { align })] : []),
  ];
  const art = c.image ? imageBlock(c.image.src, c.image.alt, { width: PANEL_INNER, borderRadius: 12, align, ...linked(c.image) }) : null;
  const children = !art ? words : c.imageFirst ? [{ ...art, marginBottom: 24 }, ...words] : [...words, spacer(28), art];
  const center = align === "center" ? "; text-align: center" : "";
  // Over a photo the gradient is dropped: a `background:` shorthand would clear the picture.
  const surface = c.photo
    ? { backgroundImage: { src: c.photo.src, size: "cover", position: "center", repeat: "no-repeat" }, ...(center ? { customCss: "text-align: center" } : {}) }
    : { customCss: `${t.css}${center}` };
  return [
    band([section(children, { backgroundColor: t.bg, ...surface, paddingX: 32, paddingY: c.photo ? 56 : 36, border: { radius: 20 } })], {
      paddingY: 8,
    }),
  ];
}

/**
 * A rounded panel inset in the gutter with the words on one side and a picture
 * on the other (Row insetX, 0.6.0): a pill, a big title, a line and a button
 * beside a product shot or render. Stacks on phones, words first. The cover of
 * a monthly roundup or a launch.
 */
export function heroSplitPanel(
  p: BrandPalette,
  c: { label?: string; title: string; lead?: string; cta?: Cta; image: BandImage; tone?: PanelTone },
): B[] {
  const t = panelColors(p, c.tone ?? "vivid");
  return [
    spacer(8),
    row(
      [
        column(
          [
            ...(c.label ? [chip(c.label, t.chipBg, t.chipFg)] : []),
            h1(c.title, t.ink, { fontSize: 30, lineHeight: "1.15", letterSpacing: -0.6, marginBottom: c.lead || c.cta ? 12 : 0 }),
            ...(c.lead ? [lead(c.lead, t.body, { fontSize: 15, marginBottom: c.cta ? 20 : 0 })] : []),
            ...(c.cta ? [pill(c.cta, t.button, t.buttonText)] : []),
          ],
          56,
          { paddingX: 0, customCss: "vertical-align: middle" },
        ),
        column([imageBlock(c.image.src, c.image.alt, { width: 196, borderRadius: 12, ...linked(c.image) })], 44, { paddingX: 0, customCss: "vertical-align: middle" }),
      ],
      { insetX: BAND_GUTTER, paddingX: 28, paddingY: 32, columnGap: 20, backgroundColor: t.bg, customCss: t.css, border: { radius: 20 } },
    ),
    spacer(8),
  ];
}

/**
 * A typographic poster: a big upper-case title centred on the brand band,
 * inside a pale frame with a fine inset rule. Carries the first screen with no
 * image at all: announcements, loyalty, a sale, a statement.
 */
export function heroPoster(
  p: BrandPalette,
  c: { overline?: string; title: string; line?: string; cta?: Cta; frame?: string; /** A dark, quiet photo or texture behind the poster (Section backgroundImage, 0.6.0); the band colour is the fallback. */ photo?: BandImage },
): B[] {
  const frame = c.frame ?? p.accentTint;
  const inset = section(
    [
      ...(c.overline ? [overline(c.overline, p.onBandMuted, { align: "center", letterSpacing: 2.4, marginBottom: 16 })] : []),
      headingBlock(c.title, {
        level: 1,
        align: "center",
        fontSize: 44,
        lineHeight: "1.05",
        letterSpacing: -0.88,
        fontWeight: "800",
        color: p.onBand,
        marginBottom: c.line || c.cta ? 16 : 0,
        customCss: "text-transform: uppercase",
      }),
      ...(c.line ? [textBlock(c.line, { align: "center", fontSize: 16, lineHeight: "1.55", color: p.onBandMuted, marginBottom: c.cta ? 28 : 0 })] : []),
      ...(c.cta ? [pill(c.cta, p.bandButton, p.bandButtonText, { align: "center" })] : []),
    ],
    { paddingX: 24, paddingY: 44, border: { width: 1, style: "solid", color: mix(p.band, p.onBand, 0.35), radius: 10 } },
  );
  return [
    band([section([section([inset], { backgroundColor: p.band, ...(c.photo ? { backgroundImage: { src: c.photo.src, size: "cover", position: "center", repeat: "no-repeat" } } : {}), paddingX: 12, paddingY: 12, border: { radius: 14 } })], { backgroundColor: frame, paddingX: 12, paddingY: 12, border: { radius: 22 } })], {
      paddingY: 8,
    }),
  ];
}

/**
 * A newsletter's nameplate: optional masthead art, the publication's name set
 * large (serif for an editorial letter), a tagline, then the issue line
 * between two rules. The fixed frame a recurring email is recognised by; the
 * issue's own headline follows as the H1.
 */
export function heroMasthead(
  p: BrandPalette,
  c: { name: string; tagline?: string; issue: string; date?: string; image?: BandImage; serif?: boolean },
): B[] {
  const type = c.serif ? { fontFamily: SERIF_STACK, fontWeight: "400", letterSpacing: -1.2 } : { fontWeight: "800", letterSpacing: -1.6 };
  const cell = (t: string, align: "left" | "right") =>
    textBlock(upperLabel(t), { align, fontSize: 12, fontWeight: "600", letterSpacing: 0.96, color: align === "left" ? p.ink : p.muted, marginBottom: 0 });
  return [
    // The masthead usually opens the email, so its art keeps the card's top padding.
    ...(c.image ? tight([imageBlock(c.image.src, c.image.alt, { width: INNER, borderRadius: 16, ...linked(c.image) })], 32, 0) : []),
    band(
      [
        textBlock(c.name, { align: "center", fontSize: 46, lineHeight: "1.05", color: p.ink, marginBottom: c.tagline ? 10 : 0, ...type }),
        ...(c.tagline
          ? [textBlock(c.tagline, { align: "center", fontSize: 15, color: p.muted, marginBottom: 0, ...(c.serif ? { fontFamily: SERIF_STACK, customCss: "font-style: italic" } : {}) })]
          : []),
      ],
      { paddingY: c.image ? 24 : 32 },
    ),
    ...rule(p.ink),
    row(
      [column([cell(c.issue, "left")], 50, { paddingX: 0 }), column([cell(c.date ?? " ", "right")], 50, { paddingX: 0 })],
      { paddingX: BAND_GUTTER, paddingY: 12, columnGap: 0, stackOnMobile: false },
    ),
    ...rule(p.border),
  ];
}

/**
 * One centred spot (a round or rounded picture, or an icon when there's no
 * art), a big title, a subtitle in the accent (the month, the occasion) and a
 * hairline. A calm cover for monthly letters, welcomes and gentle news.
 */
export function heroSpot(
  p: BrandPalette,
  c: { image?: BandImage & { size?: number; round?: boolean }; icon?: EmailIconName; title: string; subtitle?: string; lead?: string; cta?: Cta; rule?: boolean },
): B[] {
  const size = c.image?.size ?? 168;
  const visual = c.image
    ? [imageBlock(c.image.src, c.image.alt, { width: size, align: "center", borderRadius: c.image.round === false ? 24 : size / 2, marginBottom: 24, ...linked(c.image) })]
    : c.icon
      ? [icon(c.icon, "solid", { align: "center", width: 56, marginBottom: 20 })]
      : [];
  return [
    band(
      [
        ...visual,
        h1(c.title, p.ink, { align: "center", fontSize: 34, lineHeight: "1.15", letterSpacing: -0.68, marginBottom: c.subtitle ? 8 : c.lead || c.cta ? 12 : 0 }),
        ...(c.subtitle ? [textBlock(c.subtitle, { align: "center", fontSize: 15, fontWeight: "600", color: p.accentText, marginBottom: c.lead || c.cta ? 20 : 0 })] : []),
        ...(c.lead ? [lead(c.lead, p.body, { align: "center", marginBottom: c.cta ? 24 : 0 })] : []),
        ...(c.cta ? [pill(c.cta, p.accent, p.onAccent, { align: "center" })] : []),
      ],
      { paddingY: 36 },
    ),
    ...(c.rule === false ? [] : rule(p.border)),
  ];
}

/**
 * A colour band, edge to edge: the headline, line and button on one side, a
 * rounded picture on the other. Stacks on phones, words first. Webinars,
 * reports, B2B news.
 */
export function heroSplit(p: BrandPalette, c: HeroCopy & { image: BandImage; tone?: "band" | "tint" }): B[] {
  const dark = c.tone !== "tint";
  const bg = dark ? p.band : p.accentTint;
  const ink = dark ? p.onBand : p.ink;
  const body = dark ? p.onBandMuted : p.body;
  return [
    row(
      [
        column(
          [
            ...(c.overline ? [overline(c.overline, dark ? p.onBandMuted : p.accentText)] : []),
            h1(c.title, ink, { fontSize: 30, lineHeight: "1.15", letterSpacing: -0.6 }),
            lead(c.lead, body, c.cta ? { fontSize: 15 } : { fontSize: 15, marginBottom: 0 }),
            ...(c.cta ? [pill(c.cta, dark ? p.bandButton : p.accent, dark ? p.bandButtonText : p.onAccent)] : []),
          ],
          56,
          { paddingX: 0, customCss: "vertical-align: middle" },
        ),
        column([imageBlock(c.image.src, c.image.alt, { width: 216, borderRadius: 14, ...linked(c.image) })], 44, {
          paddingX: 0,
          customCss: "vertical-align: middle",
        }),
      ],
      { paddingX: BAND_GUTTER, paddingY: 40, columnGap: 24, backgroundColor: bg },
    ),
  ];
}

/**
 * A photo bleeding to the card's edges, then the headline on a band of the
 * brand colour (or on the card). Put it under the header: the card's top
 * corners are rounded and the photo's are square. Promos, launches, recaps.
 */
export function heroPhoto(p: BrandPalette, c: HeroCopy & { image: BandImage; tone?: "band" | "surface" }): B[] {
  const onBand = c.tone !== "surface";
  return [
    section([imageBlock(c.image.src, c.image.alt, { width: BAND_CONTENT_WIDTH, ...linked(c.image) })], { paddingX: 0, paddingY: 0 }),
    band(
      [
        ...(c.overline ? [overline(c.overline, onBand ? p.onBandMuted : p.accentText)] : []),
        h1(c.title, onBand ? p.onBand : p.ink, { fontSize: 32, lineHeight: "1.15", letterSpacing: -0.64 }),
        lead(c.lead, onBand ? p.onBandMuted : p.body, c.cta ? {} : { marginBottom: 0 }),
        ...(c.cta ? [pill(c.cta, onBand ? p.bandButton : p.accent, onBand ? p.bandButtonText : p.onAccent)] : []),
      ],
      { paddingY: 36, ...(onBand ? { backgroundColor: p.band } : {}) },
    ),
  ];
}

/** The logo (or wordmark) centred, with an optional small line under it (issue, date, "Your monthly letter"). */
export function headerCentered(p: BrandPalette, brand: BandBrand, opts: { line?: string | null } = {}): B[] {
  const line = opts.line?.trim();
  return [
    band(
      [
        brand.logo
          ? imageBlock(brand.logo, brand.name, { width: 36, borderRadius: 10, align: "center", marginBottom: line ? 8 : 0 })
          : textBlock(brand.name, { align: "center", fontSize: 20, fontWeight: "800", letterSpacing: -0.4, color: p.ink, marginBottom: line ? 6 : 0 }),
        ...(line ? [textBlock(line, { align: "center", fontSize: 12, fontWeight: "600", letterSpacing: 0.48, color: p.muted, marginBottom: 0 })] : []),
      ],
      { paddingY: 24 },
    ),
  ];
}

// ============================================================= sections ==

/** Who wrote it: a round photo, the name and a meta line (date, read time), and an optional link on the right. */
export function byline(p: BrandPalette, c: { image?: string; name: string; meta: string; link?: Cta }): B[] {
  return [
    row(
      [
        ...(c.image
          ? [column([imageBlock(c.image, c.name, { width: 40, borderRadius: 20 })], 10, { paddingX: 0, customCss: "width: 52px; vertical-align: middle" })]
          : []),
        column(
          [
            textBlock(c.name, { fontSize: 14, fontWeight: "600", color: p.ink, marginBottom: 2 }),
            textBlock(c.meta, { fontSize: 13, color: p.muted, marginBottom: 0 }),
          ],
          c.link ? 55 : 90,
          { paddingX: 0, customCss: "vertical-align: middle" },
        ),
        ...(c.link ? [column([arrowLink(c.link, p.accentText, { align: "right", fontSize: 14 })], 35, { paddingX: 0, customCss: "vertical-align: middle" })] : []),
      ],
      { paddingX: BAND_GUTTER, paddingY: 20, columnGap: 0, stackOnMobile: false },
    ),
  ];
}

/** "In this issue": a numbered list of what's inside, each with an optional meta (read time, section). */
export function contents(p: BrandPalette, c: { title?: string; items: { title: string; meta?: string }[] }): B[] {
  return [
    band([
      overline(c.title ?? "In this issue", p.accentText, { marginBottom: 12 }),
      {
        type: "list",
        id: id(),
        ordered: true,
        items: c.items.map((it) =>
          it.meta
            ? { text: `${it.title} · ${it.meta}`, content: [{ text: it.title, marks: { bold: true } }, { text: ` · ${it.meta}`, marks: { color: p.muted } }] }
            : { text: it.title, content: [{ text: it.title, marks: { bold: true } }] },
        ),
        fontSize: 15,
        lineHeight: "1.8",
        color: p.ink,
        marginBottom: 0,
      },
    ]),
  ];
}

export type Story = { image: string; alt?: string; overline?: string; title: string; line: string; href: string };

/** Secondary stories: a rounded thumbnail beside an overline, linked title and line, hairlines between. */
export function storyRows(p: BrandPalette, c: { title?: string; items: Story[] }): B[] {
  const one = (s: Story): B =>
    row(
      [
        column([imageBlock(s.image, s.alt ?? s.title, { width: 152, borderRadius: 10, href: s.href })], 32, { paddingX: 0, customCss: "vertical-align: top" }),
        column(
          [
            ...(s.overline ? [overline(s.overline, p.accentText, { marginBottom: 6 })] : []),
            { type: "link", id: id(), text: s.title, href: s.href, fontSize: 17, color: p.ink, underline: false, marginBottom: 6, customCss: "font-weight: 700; line-height: 1.35" },
            textBlock(s.line, { fontSize: 14, lineHeight: "1.55", color: p.body, marginBottom: 0 }),
          ],
          68,
          { paddingX: 0, customCss: "vertical-align: top" },
        ),
      ],
      { paddingX: BAND_GUTTER, paddingY: 16, columnGap: 20 },
    );
  return [
    ...(c.title ? tight([h2(c.title, p.ink, { marginBottom: 4 })], 28, 0) : [spacer(12)]),
    ...c.items.flatMap((s, i) => [...(i > 0 ? rule(p.border) : []), one(s)]),
    spacer(12),
  ];
}

/** A picture on one side, overline + title + paragraph + link on the other; `flip` puts the picture right. Alternate rows for rhythm. */
export function mediaRow(p: BrandPalette, c: { image: BandImage; overline?: string; title: string; body: string; link?: Cta; flip?: boolean; tone?: "tint" }): B[] {
  const pic = column([imageBlock(c.image.src, c.image.alt, { width: 248, borderRadius: 12, ...linked(c.image) })], 48, { paddingX: 0, customCss: "vertical-align: middle" });
  const words = column(
    [
      ...(c.overline ? [overline(c.overline, p.accentText)] : []),
      headingBlock(c.title, { level: 3, fontSize: 20, lineHeight: "1.3", letterSpacing: -0.3, color: p.ink, marginBottom: 8 }),
      copy(c.body, p.body, c.link ? { marginBottom: 12 } : { marginBottom: 0 }),
      ...(c.link ? [arrowLink(c.link, p.accentText)] : []),
    ],
    52,
    { paddingX: 0, customCss: "vertical-align: middle" },
  );
  return [
    row(c.flip ? [words, pic] : [pic, words], {
      paddingX: BAND_GUTTER,
      paddingY: c.tone ? 32 : 20,
      columnGap: 24,
      ...(c.tone ? { backgroundColor: p.tint } : {}),
    }),
  ];
}

export type Card = { image?: BandImage; icon?: EmailIconName; overline?: string; title: string; line: string; link?: Cta };

/** Vertical space that keeps a band's tint (a plain <Spacer> would be card-coloured). */
const gap = (height: number, bg?: string): B => (bg ? section([spacer(height)], { paddingX: 0, paddingY: 0, backgroundColor: bg }) : spacer(height));

/** Two cards side by side: picture (or icon), overline, title, two lines, a link. Stacks on phones. Optionally on a tinted band. */
export function cards(p: BrandPalette, c: { title?: string; items: [Card, Card]; tone?: "tint" }): B[] {
  const w = (INNER - 20) / 2;
  const bg = c.tone ? p.tint : undefined;
  const card = (k: Card) =>
    column(
      [
        ...(k.image ? [imageBlock(k.image.src, k.image.alt, { width: w, borderRadius: 12, marginBottom: 14, ...linked(k.image) })] : []),
        ...(!k.image && k.icon ? [icon(k.icon, "soft", { marginBottom: 14 })] : []),
        ...(k.overline ? [overline(k.overline, p.accentText, { marginBottom: 6 })] : []),
        headingBlock(k.title, { level: 3, fontSize: 17, lineHeight: "1.35", color: p.ink, marginBottom: 6 }),
        textBlock(k.line, { fontSize: 14, lineHeight: "1.55", color: p.body, marginBottom: k.link ? 10 : 0 }),
        ...(k.link ? [arrowLink(k.link, p.accentText, { fontSize: 14 })] : []),
      ],
      50,
      { paddingX: 0, customCss: "vertical-align: top" },
    );
  return [
    gap(bg ? 32 : 28, bg),
    ...(c.title ? [band([h2(c.title, p.ink, { marginBottom: 20 })], { paddingY: 0, ...(bg ? { backgroundColor: bg } : {}) })] : []),
    row(c.items.map(card), { paddingX: BAND_GUTTER, paddingY: 0, columnGap: 20, ...(bg ? { backgroundColor: bg } : {}) }),
    gap(bg ? 32 : 28, bg),
  ];
}

/** Two or three pictures in a row, each with an optional caption: a collection, a recap, a gallery. Stays side by side on phones. */
export function gallery(p: BrandPalette, c: { images: (BandImage & { caption?: string })[] }): B[] {
  const n = c.images.length;
  const gapPx = 12;
  const w = Math.floor((INNER - gapPx * (n - 1)) / n);
  const pct = Math.floor(100 / n);
  return [
    row(
      c.images.map((img, i) =>
        column(
          [
            imageBlock(img.src, img.alt, { width: w, borderRadius: 10, marginBottom: img.caption ? 8 : 0, ...linked(img) }),
            ...(img.caption ? [textBlock(img.caption, { fontSize: 13, color: p.muted, marginBottom: 0 })] : []),
          ],
          i === n - 1 ? 100 - pct * (n - 1) : pct,
          { paddingX: 0, customCss: "vertical-align: top" },
        ),
      ),
      { paddingX: BAND_GUTTER, paddingY: 8, columnGap: gapPx, stackOnMobile: false },
    ),
  ];
}

/**
 * A quote that gets its own moment: large type (serif if you like), and who
 * said it with an optional round photo. `tint` sets it on a pale band, `band`
 * on the brand colour, `plain` beside an accent rule.
 */
export function quote(
  p: BrandPalette,
  c: { quote: string; name?: string; role?: string; image?: string; tone?: "plain" | "tint" | "band"; serif?: boolean },
): B[] {
  const tone = c.tone ?? "tint";
  const onBand = tone === "band";
  const ink = onBand ? p.onBand : p.ink;
  const muted = onBand ? p.onBandMuted : p.muted;
  const serif = c.serif ? { fontFamily: SERIF_STACK } : {};
  const who = c.name
    ? c.image
      ? [
          row(
            [
              column([imageBlock(c.image, c.name, { width: 40, borderRadius: 20 })], 10, { paddingX: 0, customCss: "width: 52px; vertical-align: middle" }),
              column(
                [
                  textBlock(c.name, { fontSize: 14, fontWeight: "600", color: ink, marginBottom: 2 }),
                  ...(c.role ? [textBlock(c.role, { fontSize: 13, color: muted, marginBottom: 0 })] : []),
                ],
                90,
                { paddingX: 0, customCss: "vertical-align: middle" },
              ),
            ],
            { paddingX: BAND_GUTTER, paddingY: 0, columnGap: 0, stackOnMobile: false, ...(tone !== "plain" ? { backgroundColor: onBand ? p.band : p.tint } : {}) },
          ),
        ]
      : null
    : null;
  const words = [
    textBlock(tone === "plain" ? c.quote : `“${c.quote}”`, { fontSize: tone === "plain" ? 20 : 24, lineHeight: "1.4", letterSpacing: -0.24, color: ink, marginBottom: c.name ? 20 : 0, ...serif }),
    ...(c.name && !who ? [textBlock(`${c.name}${c.role ? `, ${c.role}` : ""}`, { fontSize: 14, color: muted, marginBottom: 0 })] : []),
  ];
  if (tone === "plain") {
    const ruled = band([section(words, { paddingX: 20, paddingY: 4, customCss: `border-left: 3px solid ${p.accent}` })], { paddingY: who ? 0 : 28 });
    return who ? [spacer(28), ruled, spacer(16), ...who, spacer(28)] : [ruled];
  }
  const bg = onBand ? p.band : p.tint;
  return who
    ? [gap(40, bg), band(words, { paddingY: 0, backgroundColor: bg }), ...who, gap(40, bg)]
    : [band(words, { paddingY: 40, backgroundColor: bg })];
}

/** A paid placement, labelled as one: "Together with …", a title, two lines and a link in a dashed card, in the issue's own item format. */
export function sponsor(p: BrandPalette, c: { sponsor: string; title: string; body: string; link: Cta; label?: string }): B[] {
  return [
    band(
      [
        section(
          [
            overline(`${c.label ?? "Together with"} ${c.sponsor}`, p.muted),
            headingBlock(c.title, { level: 3, fontSize: 17, lineHeight: "1.35", color: p.ink, marginBottom: 6 }),
            copy(c.body, p.body, { marginBottom: 12 }),
            arrowLink(c.link, p.accentText),
          ],
          { paddingX: 24, paddingY: 20, border: { width: 1, style: "dashed", color: p.border, radius: 12 } },
        ),
      ],
      { paddingY: CARD_BAND_Y },
    ),
  ];
}

export type LinkItem = { title: string; href: string; summary: string; source: string };

/** Curated links: a large accent numeral, the linked title, one line on why, and the source with its read time. */
export function linkList(p: BrandPalette, c: { title?: string; items: LinkItem[] }): B[] {
  const one = (l: LinkItem, n: number): B =>
    row(
      [
        column([textBlock(String(n).padStart(2, "0"), { fontSize: 20, fontWeight: "700", lineHeight: "1.3", letterSpacing: -0.4, color: p.accentText, marginBottom: 0 })], 10, {
          paddingX: 0,
          customCss: "width: 52px; vertical-align: top",
        }),
        column(
          [
            { type: "link", id: id(), text: l.title, href: l.href, fontSize: 17, color: p.ink, underline: false, marginBottom: 4, customCss: "font-weight: 600; line-height: 1.35" },
            textBlock(l.summary, { fontSize: 15, lineHeight: "1.55", color: p.body, marginBottom: 4 }),
            textBlock(l.source, { fontSize: 13, color: p.muted, marginBottom: 0 }),
          ],
          90,
          { paddingX: 0, customCss: "vertical-align: top" },
        ),
      ],
      { paddingX: BAND_GUTTER, paddingY: 12, columnGap: 0, stackOnMobile: false },
    );
  return [...(c.title ? tight([h2(c.title, p.ink, { marginBottom: 8 })], 28, 0) : [spacer(16)]), ...c.items.map((l, i) => one(l, i + 1)), spacer(16)];
}

/** A label that opens a newsletter section: a tinted bar with an optional icon and the section's name. */
export function sectionLabel(p: BrandPalette, c: { label: string; icon?: EmailIconName }): B[] {
  return [
    row(
      [
        ...(c.icon ? [column([icon(c.icon, "ink")], 8, { paddingX: 0, customCss: "width: 36px; vertical-align: middle" })] : []),
        column([textBlock(upperLabel(c.label), { fontSize: 13, fontWeight: "700", letterSpacing: 0.9, color: p.ink, marginBottom: 0 })], c.icon ? 92 : 100, {
          paddingX: 0,
          customCss: "vertical-align: middle",
        }),
      ],
      { paddingX: BAND_GUTTER, paddingY: 12, columnGap: 0, backgroundColor: p.tint, stackOnMobile: false },
    ),
  ];
}

/** Numbered steps or reasons: a big accent numeral, a title and a line each. Onboarding, how-tos, "three reasons". */
export function steps(p: BrandPalette, c: { title?: string; items: { title: string; line: string }[]; tone?: "tint" }): B[] {
  const bg = c.tone ? p.tint : undefined;
  const one = (s: { title: string; line: string }, n: number): B =>
    row(
      [
        column([textBlock(String(n), { fontSize: 30, fontWeight: "800", lineHeight: "1", letterSpacing: -0.6, color: p.accentText, marginBottom: 0 })], 10, {
          paddingX: 0,
          customCss: "width: 48px; vertical-align: top",
        }),
        column(
          [
            textBlock(s.title, { fontSize: 16, fontWeight: "700", color: p.ink, marginBottom: 4 }),
            textBlock(s.line, { fontSize: 15, lineHeight: "1.55", color: p.body, marginBottom: 0 }),
          ],
          90,
          { paddingX: 0, customCss: "vertical-align: top" },
        ),
      ],
      { paddingX: BAND_GUTTER, paddingY: 12, columnGap: 0, stackOnMobile: false, ...(bg ? { backgroundColor: bg } : {}) },
    );
  return [
    gap(c.title ? 28 : 16, bg),
    ...(c.title ? [band([h2(c.title, p.ink, { marginBottom: 8 })], { paddingY: 0, ...(bg ? { backgroundColor: bg } : {}) })] : []),
    ...c.items.map((s, i) => one(s, i + 1)),
    gap(16, bg),
  ];
}

/** The sign-off of a letter: a closing line, then a round photo with the name and role. */
export function signature(p: BrandPalette, c: { line?: string; name: string; role?: string; image?: string }): B[] {
  return [
    // The closing line is a band of its own (its padding spaces it from the copy above); the photo follows 28 below.
    ...(c.line ? [band([copy(c.line, p.body, { marginBottom: 0 })])] : []),
    row(
      [
        ...(c.image ? [column([imageBlock(c.image, c.name, { width: 48, borderRadius: 24 })], 12, { paddingX: 0, customCss: "width: 60px; vertical-align: middle" })] : []),
        column(
          [
            textBlock(c.name, { fontSize: 15, fontWeight: "600", color: p.ink, marginBottom: 2 }),
            ...(c.role ? [textBlock(c.role, { fontSize: 13, color: p.muted, marginBottom: 0 })] : []),
          ],
          c.image ? 88 : 100,
          { paddingX: 0, customCss: "vertical-align: middle" },
        ),
      ],
      { paddingX: BAND_GUTTER, paddingY: 0, columnGap: 0, stackOnMobile: false },
    ),
    spacer(28),
  ];
}

/** The reader loop at the end of an issue: a P.S., a one-click feedback question, a "forwarded this?" line. Links only, no forms. */
export function readerLoop(p: BrandPalette, c: { ps?: string; feedback?: { question: string; yes: string; no: string }; forward?: Cta }): B[] {
  const lines: B[] = [
    ...(c.ps ? [copy(`P.S. ${c.ps}`, p.body, { marginBottom: 16 })] : []),
    ...(c.feedback
      ? [
          {
            ...textBlock(`${c.feedback.question} Yes · No`, { fontSize: 14, color: p.body, marginBottom: 12 }),
            content: [
              { text: `${c.feedback.question} ` },
              { text: "Yes", marks: { link: c.feedback.yes, bold: true, color: p.accentText } },
              { text: " · " },
              { text: "No", marks: { link: c.feedback.no, bold: true, color: p.accentText } },
            ],
          },
        ]
      : []),
    ...(c.forward
      ? [
          {
            ...textBlock(`Forwarded this? ${c.forward.label}`, { fontSize: 14, color: p.muted, marginBottom: 0 }),
            content: [{ text: "Forwarded this? " }, { text: c.forward.label, marks: { link: c.forward.href, color: p.accentText } }],
          },
        ]
      : []),
  ];
  return [...rule(p.border), band(lines)];
}

/** The brand's name set large in a soft grey at the very end: a quiet signature before the footer (3:1, the large-text minimum). */
export function brandSignature(p: BrandPalette, brand: BandBrand, opts: { align?: "left" | "center" } = {}): B[] {
  return [
    band([textBlock(brand.name, { align: opts.align ?? "center", fontSize: 48, fontWeight: "800", lineHeight: "1", letterSpacing: -1.8, color: shadeToContrast(p.border, p.surface, 3), marginBottom: 0 })], {
      paddingY: 32,
    }),
  ];
}

// ============================================================ commerce ==
//
// The shop layer (research-milled-goodemailcopy.md S26–S32): utility facts,
// trust, prices and reviews, all as live text in tables (no text on images).

/**
 * A thin strip at the very top with one to three facts joined by middots:
 * free delivery over $45, the order-by date, the code. Its top corners follow
 * the card's radius, since it usually opens the email.
 */
export function headerStrip(p: BrandPalette, c: { items: string[]; tone?: "band" | "tint"; radius?: number }): B[] {
  const dark = c.tone !== "tint";
  const radius = c.radius ?? 16;
  return [
    section(
      [textBlock(c.items.join(" · "), { align: "center", fontSize: 12, fontWeight: "600", letterSpacing: 0.36, color: dark ? p.onBand : p.accentText, marginBottom: 0 })],
      { paddingX: BAND_GUTTER, paddingY: 10, backgroundColor: dark ? p.band : p.accentTint, ...(radius ? { customCss: `border-radius: ${radius}px ${radius}px 0 0` } : {}) },
    ),
  ];
}

/** Three or four facts that remove a doubt (delivery, returns, warranty, secure checkout): an icon over two or three words each, on a tint. */
export function trustStrip(p: BrandPalette, c: { items: { icon: EmailIconName; label: string }[] }): B[] {
  const n = c.items.length;
  const w = Math.floor(100 / n);
  return [
    row(
      c.items.map((it, i) =>
        column(
          [icon(it.icon, "ink", { align: "center", marginBottom: 8 }), textBlock(it.label, { align: "center", fontSize: 13, lineHeight: "1.4", color: p.body, marginBottom: 0 })],
          i === n - 1 ? 100 - w * (n - 1) : w,
          { paddingX: 4, customCss: "vertical-align: top" },
        ),
      ),
      { paddingX: BAND_GUTTER, paddingY: 22, columnGap: 8, backgroundColor: p.tint, stackOnMobile: false },
    ),
  ];
}

export type PriceItem = { name: string; line?: string; price: string; was?: string };

/**
 * Menu-style price rows: the name and a line on the left, the price on the
 * right (with the old price struck through when there's a real one), one item
 * per line, hairlines between. Menus, price lists, a sale's picks.
 */
export function priceList(p: BrandPalette, c: { title?: string; items: PriceItem[] }): B[] {
  const one = (it: PriceItem): B =>
    row(
      [
        column(
          [
            textBlock(it.name, { fontSize: 16, fontWeight: "600", color: p.ink, marginBottom: it.line ? 3 : 0 }),
            ...(it.line ? [textBlock(it.line, { fontSize: 14, lineHeight: "1.5", color: p.muted, marginBottom: 0 })] : []),
          ],
          70,
          { paddingX: 0, customCss: "vertical-align: top" },
        ),
        column(
          [
            ...(it.was
              ? [textBlock(`Was ${it.was}`, { align: "right", fontSize: 13, color: p.muted, marginBottom: 2, customCss: "text-decoration: line-through" })]
              : []),
            textBlock(it.price, { align: "right", fontSize: 17, fontWeight: "600", color: p.accentText, marginBottom: 0 }),
          ],
          30,
          { paddingX: 0, customCss: "vertical-align: top" },
        ),
      ],
      { paddingX: BAND_GUTTER, paddingY: 14, columnGap: 0, stackOnMobile: false },
    );
  return [
    ...(c.title ? tight([h2(c.title, p.ink, { marginBottom: 6 })], 28, 0) : [spacer(14)]),
    ...c.items.flatMap((it, i) => [...(i > 0 ? rule(p.border) : []), one(it)]),
    spacer(14),
  ];
}

export type Review = { quote: string; name: string; meta?: string; stars?: number };

/** Two short reviews side by side on tinted cards: the stars as text, the quote, the name. Stacks on phones. */
export function reviews(p: BrandPalette, c: { title?: string; items: [Review, Review] }): B[] {
  const card = (r: Review): B =>
    column(
      [
        textBlock("★".repeat(Math.max(1, Math.min(5, r.stars ?? 5))), { fontSize: 15, letterSpacing: 2, color: p.accentText, marginBottom: 8 }),
        textBlock(`“${r.quote}”`, { fontSize: 15, lineHeight: "1.5", color: p.ink, marginBottom: 10 }),
        textBlock(`${r.name}${r.meta ? ` · ${r.meta}` : ""}`, { fontSize: 13, color: p.muted, marginBottom: 0 }),
      ],
      50,
      { paddingX: 20, paddingY: 20, backgroundColor: p.tint, border: { radius: 12 }, customCss: "vertical-align: top" },
    );
  return [
    ...(c.title ? tight([h2(c.title, p.ink, { marginBottom: 18 })], 28, 0) : [spacer(12)]),
    row(c.items.map(card), { paddingX: BAND_GUTTER, paddingY: 0, columnGap: 16 }),
    spacer(28),
  ];
}
