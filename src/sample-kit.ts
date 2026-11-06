// Shared kit for the sample templates (samples.ts and the v2 sample files).
//
// Two generations of samples share this module:
//   • the ORIGINAL samples (samples.ts) — 560px paper with a 40px inner pad,
//     centred copy, BRAND / BRAND_THEME below;
//   • the V2 samples (samples-transactional-v2.ts, samples-marketing-v2.ts) —
//     the EMAIL_DESIGN.md house style: 600px card, body-padding 0, every band
//     brings its own 32px gutter, a BrandPalette per template so each one has
//     its own accent, and the themed band builders from bands.ts.
//
// Everything here is dependency-free data + pure helpers: safe to import from
// the browser editor, the public gallery, the engine and the agent tools.
// samples.ts re-exports BRAND / BRAND_THEME / DEFAULT_LOGO_URL from here so
// existing imports keep working.

import * as bands from "./bands";
import { BAND_GUTTER, brandPalette, type BandBlock, type BrandPalette } from "./bands";
import { EMAIL_ICON_SIZE, emailIconUrl, type EmailIconName } from "./email-assets";
import { EmailDocumentSchema, type Block, type EmailDocument } from "./schema";

// ---------------------------------------------------------------------------
// Brand defaults shared by both sample generations
// ---------------------------------------------------------------------------

// Unitpost brand palette — keep every sample on-identity and in light mode by
// default. Mirrors the app tokens (near-black primary on white, zinc grays).
// Authors can recolor in the editor; these are just good-looking defaults.
export const BRAND = {
  ink: "#18181b", // primary text + buttons (zinc-900, ≈ --primary)
  onInk: "#ffffff", // text on the ink button
  body: "#3f3f46", // body copy (zinc-700)
  muted: "#71717a", // secondary / fine print (zinc-500)
  faint: "#a1a1aa", // footer fine print (zinc-400)
  surface: "#ffffff", // the email "paper"
  page: "#f4f4f5", // page backdrop behind the paper (zinc-100)
  tint: "#fafafa", // subtle section fill (zinc-50)
  border: "#e4e4e7", // hairline dividers (zinc-200)
  success: "#16a34a", // positive accents (receipts, confirmations)
  successTint: "#f0fdf4", // success section fill
} as const;

// The default brand logo used in sample templates — a CDN/prod-hosted PNG (the
// Unitpost app mark). PNG (not SVG) so it resolves in Gmail/Outlook, at an
// absolute origin so it loads in every inbox AND in the logged-out gallery
// preview. Authors swap it for their own logo in the editor.
export const DEFAULT_LOGO_URL =
  "https://www.unitpost.com/web-app-manifest-192x192.png";

// Shared light-mode theme of the ORIGINAL samples: white paper centered on a
// soft zinc backdrop, our system font stack, ink text, ink links.
export const BRAND_THEME = {
  textColor: BRAND.ink,
  linkColor: BRAND.ink,
  backgroundColor: BRAND.page,
  bodyColor: BRAND.surface,
  contentWidth: 560,
  bodyPadding: 40,
  bodyRadius: 14,
} as const;

// ---------------------------------------------------------------------------
// Stock imagery
// ---------------------------------------------------------------------------

// Free-to-use stock photography (Unsplash) for the samples that benefit from a
// photo. Every id below was checked to resolve; they are PLACEHOLDERS the
// author replaces with their own art, so the gallery preview looks finished
// instead of showing an empty grey frame. Sized + cropped via URL params so
// they load fast at a consistent aspect ratio. Keep the subjects neutral:
// products, places, people at work — nothing that reads as one real brand.
const UNSPLASH = "https://images.unsplash.com";

export function stockUrl(id: string, width: number, height?: number): string {
  const h = height ? `&h=${height}` : "";
  return `${UNSPLASH}/${id}?auto=format&fit=crop&w=${width}${h}&q=80`;
}

// Named by subject, so a template reads as "the sneaker tile", not an id.
export const STOCK_IDS = {
  // products
  watch: "photo-1523275335684-37898b6baf30",
  sneakerRed: "photo-1542291026-7eec264c27ff",
  sneakerTan: "photo-1549298916-b41d501d3772",
  derbyTeal: "photo-1560343090-f0409e92791a",
  headphones: "photo-1505740420928-5e560c06d30e",
  camera: "photo-1516035069371-29a1b244cc32",
  chair: "photo-1556228453-efd6c1ff04f6",
  sofa: "photo-1555041469-a586c61ea9bc",
  livingRoom: "photo-1586023492125-27b2c045efd7",
  tee: "photo-1521572163474-6864f9cf17ab",
  jacket: "photo-1591047139829-d91aecb6caea",
  knitPoncho: "photo-1434389677669-e08b4cac3105",
  storeInterior: "photo-1441986300917-64674bd600d8",
  fashionStreet: "photo-1515886657613-9f3515b0c78f",
  fashionEditorial: "photo-1529139574466-a303027c1d8b",
  shoppingBags: "photo-1483985988355-763728e1935b",
  // people
  portraitMan: "photo-1507003211169-0a1dd7228f2d",
  portraitWoman: "photo-1544005313-94ddf0286df2",
  portraitWoman2: "photo-1494790108377-be9c29b29330",
  // work and tech
  teamLaptops: "photo-1519389950473-47ba0277781c",
  teamMeeting: "photo-1522071820081-009f0129c71c",
  teamDesk: "photo-1551434678-e076c223a692",
  teamTalk: "photo-1521737604893-d14cc237f11d",
  presentation: "photo-1542744173-8e7e53415bb0",
  deskFlatlay: "photo-1455390582262-044cdead277a",
  workspace: "photo-1524758631624-e2822e304c36",
  office: "photo-1497366216548-37526070297c",
  laptopCode: "photo-1498050108023-c5249f4df085",
  laptopDark: "photo-1531297484001-80022131f5a1",
  codeScreen: "photo-1555066931-4365d14bab8c",
  // places and travel
  mountainLake: "photo-1500530855697-b586d89ba3ee",
  valley: "photo-1506744038136-46273834b3fb",
  hiker: "photo-1464822759023-fed622ff2c3b",
  beach: "photo-1476514525535-07fb3b4ae5f1",
  airplane: "photo-1502920917128-1aa500764cbd",
  cityStreet: "photo-1513635269975-59663e0ac1ad",
  houseModern: "photo-1600585154340-be6161a56a0c",
  apartment: "photo-1560448204-e02f11c3d0e2",
  housePool: "photo-1512917774080-9991f1c4c750",
  // events
  conference: "photo-1540575467063-178a50c2df87",
  eventTable: "photo-1511578314322-379afb476865",
  concert: "photo-1492684223066-81342ee5ff30",
  party: "photo-1530103862676-de8c9debad1d",
  crowd: "photo-1501281668745-f7f57925c3b4",
  // food
  coffee: "photo-1511988617509-a57c8a288659",
  pizza: "photo-1565299624946-b28f40a0ae38",
  salad: "photo-1546069901-ba9599a7e63c",
  plate: "photo-1504674900247-0877df9cc836",
  // abstract
  gradient3d: "photo-1560472354-b33ff0c44a43",
  launch: "photo-1620121692029-d088224ddc74",
  texture: "photo-1557683316-973673baf926",
  event: "photo-1505373877841-8d25f7d46678",
  desk: "photo-1497032628192-86f99bcd76bc",
} as const;

export type StockName = keyof typeof STOCK_IDS;

/** A hero / feature image (2:1) at the band's inner width. */
export const stockWide = (name: StockName) => stockUrl(STOCK_IDS[name], 1200, 600);
/** An article / listing shot (4:3). */
export const stockLandscape = (name: StockName) => stockUrl(STOCK_IDS[name], 960, 720);
/** A product tile (1:1). */
export const stockSquare = (name: StockName) => stockUrl(STOCK_IDS[name], 800, 800);
/** A person (1:1, shown round). */
export const stockAvatar = (name: StockName) => stockUrl(STOCK_IDS[name], 240, 240);

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

// Accents the v2 samples are themed with. Each produces a full BrandPalette via
// brandPalette(), so buttons, overlines, washes and contrast bands all derive
// from one colour and every text colour passes contrast where it sits.
export const ACCENTS = {
  ink: null,
  indigo: "#4f46e5",
  violet: "#7c3aed",
  blue: "#2563eb",
  sky: "#0369a1",
  teal: "#0f766e",
  emerald: "#047857",
  forest: "#166534",
  amber: "#b45309",
  terracotta: "#c2410c",
  red: "#dc2626",
  rose: "#be123c",
  pink: "#db2777",
  burgundy: "#9f1239",
  navy: "#1e3a5f",
  slate: "#334155",
} as const;

export const palette = (accent: keyof typeof ACCENTS): BrandPalette =>
  brandPalette({ accent: ACCENTS[accent] });

// A hand-set dark palette for the dark-mode samples. bands.ts builders only
// read these fields, so the same bands render on a near-black card.
export const DARK_PALETTE: BrandPalette = {
  ink: "#fafafa",
  body: "#d4d4d8",
  muted: "#a1a1aa",
  surface: "#121216",
  page: "#09090b",
  border: "#27272a",
  tint: "#1b1b21",
  accent: "#8b5cf6",
  onAccent: "#ffffff",
  accentText: "#c4b5fd",
  accentTint: "#1e1b2e",
  accentBorder: "#3b3366",
  band: "#5b21b6",
  bandTo: "#1d4ed8",
  onBand: "#ffffff",
  onBandMuted: "#e9d5ff",
  bandButton: "#ffffff",
  bandButtonText: "#4c1d95",
  success: "#4ade80",
};

// ---------------------------------------------------------------------------
// Document assembly
// ---------------------------------------------------------------------------

/** The EMAIL_DESIGN.md theme for a palette: 600px card, no inner padding, 16px corners. */
export function paletteTheme(p: BrandPalette, extra: Record<string, unknown> = {}) {
  return {
    textColor: p.ink,
    backgroundColor: p.page,
    bodyColor: p.surface,
    linkColor: p.accentText,
    contentWidth: 600,
    bodyPadding: 0,
    bodyRadius: 16,
    ...extra,
  };
}

// Deterministic ids: the band builders mint random ids (they're meant to be
// inserted repeatedly in the editor), but a SAMPLE must be byte-identical
// across processes — the gallery prints its TSX on the server and the codec
// round-trip test compares structure. Renumber every block `${prefix}-${n}`.
export function withStableIds(prefix: string, blocks: BandBlock[]): Block[] {
  let n = 0;
  const walk = (list: BandBlock[]): BandBlock[] =>
    list.map((b) => {
      const out: BandBlock = { ...b, id: `${prefix}-${++n}` };
      if (Array.isArray(b.children)) out.children = walk(b.children as BandBlock[]);
      if (Array.isArray(b.columns)) out.columns = walk(b.columns as BandBlock[]);
      return out;
    });
  return walk(blocks) as unknown as Block[];
}

export type SampleVariable = {
  name: string;
  type?: "string" | "number" | "boolean" | "date";
  source?: "input" | "contact";
  contactField?: string;
};

/** `{{first_name}}` from the contact row — every personalised sample declares it. */
export const FIRST_NAME: SampleVariable = { name: "first_name", source: "contact", contactField: "first_name" };
/** Caller-supplied string variables, in one line. */
export const inputs = (...names: string[]): SampleVariable[] => names.map((name) => ({ name, source: "input" }));
// Marketing samples declare the footer tokens so the managed compliance footer
// resolves them; {{unsubscribe_url}} is a reserved system token and must NOT be
// declared (VariableSchema rejects it).
export const FOOTER_VARS: SampleVariable[] = inputs("company_name", "company_address");

export function sampleDocument(opts: {
  key: string;
  category: "transactional" | "marketing";
  previewText: string;
  palette: BrandPalette;
  variables: SampleVariable[];
  blocks: BandBlock[];
  theme?: Record<string, unknown>;
}): EmailDocument {
  return EmailDocumentSchema.parse({
    compositionMode: "designed",
    category: opts.category,
    previewText: opts.previewText,
    theme: paletteTheme(opts.palette, opts.theme),
    variables: opts.variables.map((v) => ({ type: "string", source: "input", ...v })),
    blocks: withStableIds(opts.key, opts.blocks),
  });
}

// ---------------------------------------------------------------------------
// Extra bands the v2 samples need beyond bands.ts
// ---------------------------------------------------------------------------

type B = BandBlock;
let seq = 0;
const id = () => `k-${++seq}`; // renumbered by withStableIds
const INNER = 600 - 2 * BAND_GUTTER;

export const text = (t: string, extra: B = {}): B => ({ type: "text", id: id(), text: t, ...extra });
export const heading = (t: string, extra: B = {}): B => ({ type: "heading", id: id(), text: t, ...extra });
export const image = (src: string, alt: string, extra: B = {}): B => ({ type: "image", id: id(), src, alt, align: "left", marginBottom: 0, ...extra });
export const spacer = (height: number): B => ({ type: "spacer", id: id(), height });
export const divider = (color: string): B => ({ type: "divider", id: id(), color, marginBottom: 0 });
export const section = (children: B[], extra: B = {}): B => ({ type: "section", id: id(), children, ...extra });
export const row = (columns: B[], extra: B = {}): B => ({ type: "row", id: id(), columns, ...extra });
export const column = (children: B[], width: number, extra: B = {}): B => ({ type: "column", id: id(), width, children, ...extra });
export const band = (children: B[], extra: B = {}): B => section(children, { paddingX: BAND_GUTTER, paddingY: 28, ...extra });
export const button = (label: string, href: string, bg: string, fg: string, extra: B = {}): B => ({
  type: "button",
  id: id(),
  text: label,
  href,
  align: "left",
  backgroundColor: bg,
  textColor: fg,
  borderRadius: 9999,
  innerPaddingX: 24,
  innerPaddingY: 12,
  marginBottom: 0,
  ...extra,
});
export const link = (label: string, href: string, color: string, extra: B = {}): B => ({
  type: "link",
  id: id(),
  text: label,
  href,
  align: "left",
  fontSize: 15,
  color,
  underline: false,
  marginBottom: 0,
  customCss: "font-weight: 600",
  ...extra,
});
export const list = (items: string[], color: string, extra: B = {}): B => ({
  type: "list",
  id: id(),
  items: items.map((t) => ({ text: t })),
  fontSize: 15,
  lineHeight: "1.6",
  color,
  marginBottom: 16,
  ...extra,
});
export const overline = (label: string, color: string, extra: B = {}): B =>
  text(bands.upperLabel(label), { fontSize: 12, fontWeight: "600", letterSpacing: 0.72, color, marginBottom: 8, ...extra });
export const h1 = (t: string, color: string, extra: B = {}): B =>
  heading(t, { level: 1, fontSize: 28, lineHeight: "1.2", letterSpacing: -0.56, color, marginBottom: 12, ...extra });
export const h2 = (t: string, color: string, extra: B = {}): B =>
  heading(t, { level: 2, fontSize: 22, lineHeight: "1.3", letterSpacing: -0.44, color, marginBottom: 12, ...extra });
export const h3 = (t: string, color: string, extra: B = {}): B =>
  heading(t, { level: 3, fontSize: 17, lineHeight: "1.35", color, marginBottom: 6, ...extra });
export const copy = (t: string, color: string, extra: B = {}): B => text(t, { fontSize: 15, lineHeight: "1.6", color, marginBottom: 16, ...extra });
export const small = (t: string, color: string, extra: B = {}): B => text(t, { fontSize: 13, lineHeight: "1.55", color, marginBottom: 0, ...extra });
export const icon = (name: EmailIconName, variant: "ink" | "white" | "soft" | "solid", extra: B = {}): B =>
  image(emailIconUrl(name, variant), "", { width: EMAIL_ICON_SIZE[variant], ...extra });

/** A full-width photo with the band's gutter, rounded, with space above. */
export function photoBand(src: string, alt: string, opts: { top?: number; bottom?: number; href?: string } = {}): B[] {
  const top = opts.top ?? 24;
  return [
    ...(top > 0 ? [spacer(top)] : []),
    band([image(src, alt, { width: INNER, borderRadius: 12, ...(opts.href ? { href: opts.href } : {}) })], { paddingY: 0 }),
    ...(opts.bottom ? [spacer(opts.bottom)] : []),
  ];
}

/** A photo that bleeds to the card's edges (no gutter, square corners). */
export function photoBleed(src: string, alt: string): B[] {
  return [section([image(src, alt, { width: 600 })], { paddingX: 0, paddingY: 0 })];
}

/** A thin progress bar: `pct` of the width in the accent, the rest in the tint. Reads in every client (two coloured cells). */
export function progressBar(p: BrandPalette, pct: number, opts: { label?: string; value?: string } = {}): B[] {
  const used = Math.min(100, Math.max(1, Math.round(pct)));
  const bar = row(
    [
      column([spacer(10)], used, { paddingX: 0, backgroundColor: p.accent, border: { radius: 999 } }),
      column([spacer(10)], 100 - used, { paddingX: 0, backgroundColor: p.border, border: { radius: 999 } }),
    ],
    { paddingX: BAND_GUTTER, paddingY: 0, columnGap: 0, stackOnMobile: false },
  );
  if (!opts.label) return [bar];
  return [
    row(
      [
        column([text(opts.label, { fontSize: 14, fontWeight: "600", color: p.ink, marginBottom: 0 })], 60, { paddingX: 0 }),
        column([text(opts.value ?? "", { align: "right", fontSize: 14, color: p.muted, marginBottom: 0 })], 40, { paddingX: 0 }),
      ],
      { paddingX: BAND_GUTTER, paddingY: 0, columnGap: 0, stackOnMobile: false },
    ),
    spacer(12),
    bar,
  ];
}

export type TimelineStep = { title: string; line: string; state: "done" | "current" | "todo" };

/** A vertical status timeline: done steps ticked, the current one highlighted, the rest muted. */
export function timeline(p: BrandPalette, steps: TimelineStep[]): B[] {
  return steps.map((s) =>
    row(
      [
        column([icon(s.state === "done" ? "circle-check" : s.state === "current" ? "truck" : "package", s.state === "current" ? "solid" : "soft")], 12, {
          paddingX: 0,
          customCss: "width: 56px; vertical-align: top",
        }),
        column(
          [
            text(s.title, { fontSize: 16, fontWeight: "600", color: s.state === "todo" ? p.muted : p.ink, marginBottom: 4 }),
            text(s.line, { fontSize: 14, lineHeight: "1.5", color: s.state === "current" ? p.accentText : p.muted, marginBottom: 0, ...(s.state === "current" ? { fontWeight: "600" } : {}) }),
          ],
          88,
          { paddingX: 0 },
        ),
      ],
      { paddingX: BAND_GUTTER, paddingY: 10, columnGap: 0, stackOnMobile: false },
    ),
  );
}

/** A person: round photo, name, one meta line. */
export function personRow(p: BrandPalette, c: { image: string; name: string; meta: string }): B {
  return row(
    [
      column([image(c.image, c.name, { width: 44, height: 44, borderRadius: 22, objectFit: "cover" })], 12, { paddingX: 0, customCss: "width: 56px; vertical-align: middle" }),
      column(
        [
          text(c.name, { fontSize: 15, fontWeight: "600", color: p.ink, marginBottom: 2 }),
          text(c.meta, { fontSize: 13, color: p.muted, marginBottom: 0 }),
        ],
        88,
        { paddingX: 0, customCss: "vertical-align: middle" },
      ),
    ],
    { paddingX: BAND_GUTTER, paddingY: 0, columnGap: 0, stackOnMobile: false },
  );
}

export type ArticleCard = { image: string; title: string; excerpt: string; href: string; meta?: string };

/** Thumbnail left, title + excerpt + link right. For digests and reading lists. */
export function articleRow(p: BrandPalette, a: ArticleCard): B {
  return row(
    [
      column([image(a.image, a.title, { width: 168, height: 112, borderRadius: 10, objectFit: "cover", href: a.href })], 34, { paddingX: 0, customCss: "vertical-align: top" }),
      column(
        [
          ...(a.meta ? [overline(a.meta, p.accentText, { marginBottom: 4 })] : []),
          text(a.title, { fontSize: 17, fontWeight: "600", lineHeight: "1.3", color: p.ink, marginBottom: 6 }),
          text(a.excerpt, { fontSize: 14, lineHeight: "1.55", color: p.body, marginBottom: 8 }),
          link("Read →", a.href, p.accentText, { fontSize: 14 }),
        ],
        66,
        { paddingX: 0, customCss: "vertical-align: top" },
      ),
    ],
    { paddingX: BAND_GUTTER, paddingY: 12, columnGap: 16 },
  );
}

export type ProductLine = { image: string; name: string; meta: string; price: string };

/** An order line: thumbnail, name + variant, price. Stays side by side on phones. */
export function productLine(p: BrandPalette, l: ProductLine): B {
  return row(
    [
      column([image(l.image, l.name, { width: 64, height: 64, borderRadius: 10, objectFit: "cover" })], 15, { paddingX: 0, customCss: "width: 76px; vertical-align: middle" }),
      column(
        [
          text(l.name, { fontSize: 15, fontWeight: "600", color: p.ink, marginBottom: 2 }),
          text(l.meta, { fontSize: 13, color: p.muted, marginBottom: 0 }),
        ],
        60,
        { paddingX: 0, customCss: "vertical-align: middle" },
      ),
      column([text(l.price, { align: "right", fontSize: 15, fontWeight: "600", color: p.ink, marginBottom: 0 })], 25, { paddingX: 0, customCss: "vertical-align: middle" }),
    ],
    { paddingX: BAND_GUTTER, paddingY: 10, columnGap: 0, stackOnMobile: false },
  );
}

export type ListingTile = { image: string; title: string; price: string; meta: string; href: string };

/** Two listing / product tiles side by side: photo, price, title, one meta line. */
export function tilePair(p: BrandPalette, items: [ListingTile, ListingTile]): B {
  const tile = (t: ListingTile) =>
    column(
      [
        image(t.image, t.title, { width: (INNER - 16) / 2, height: 180, borderRadius: 10, objectFit: "cover", marginBottom: 12, href: t.href }),
        text(t.price, { fontSize: 16, fontWeight: "700", color: p.ink, marginBottom: 2 }),
        text(t.title, { fontSize: 14, color: p.body, marginBottom: 2 }),
        text(t.meta, { fontSize: 13, color: p.muted, marginBottom: 0 }),
      ],
      50,
      { paddingX: 0, customCss: "vertical-align: top" },
    );
  return row(items.map(tile), { paddingX: BAND_GUTTER, paddingY: 8, columnGap: 16 });
}

export type Plan = { name: string; price: string; period: string; bullets: string[]; href: string; featured?: boolean };

/** Three plan cards in a row; the featured one is filled with the accent wash. */
export function planColumns(p: BrandPalette, plans: Plan[]): B {
  const w = Math.floor(100 / plans.length);
  return row(
    plans.map((pl, i) =>
      column(
        [
          text(pl.name, { fontSize: 13, fontWeight: "600", letterSpacing: 0.4, color: pl.featured ? p.accentText : p.muted, marginBottom: 6 }),
          heading(pl.price, { level: 3, fontSize: 26, lineHeight: "1.1", letterSpacing: -0.5, color: p.ink, marginBottom: 2 }),
          text(pl.period, { fontSize: 12, color: p.muted, marginBottom: 12 }),
          ...pl.bullets.map((b, j) => text(b, { fontSize: 13, lineHeight: "1.5", color: p.body, marginBottom: j === pl.bullets.length - 1 ? 14 : 4 })),
          button("Choose", pl.href, pl.featured ? p.accent : p.border, pl.featured ? p.onAccent : p.ink, { innerPaddingX: 18, innerPaddingY: 9 }),
        ],
        i === plans.length - 1 ? 100 - w * (plans.length - 1) : w,
        {
          paddingX: 16,
          paddingY: 18,
          backgroundColor: pl.featured ? p.accentTint : p.surface,
          border: { width: 1, style: "solid", color: pl.featured ? p.accentBorder : p.border, radius: 12 },
          customCss: "vertical-align: top",
        },
      ),
    ),
    { paddingX: BAND_GUTTER, paddingY: 8, columnGap: 10 },
  );
}

/**
 * A row of five star links — a one-tap rating. Each star links to
 * `${hrefBase}/${n}`: the rating travels as the LAST PATH SEGMENT, so a base
 * URL that already carries a query string or token (`…/review?token=abc`)
 * is never corrupted by a second `?`. Give it a base without a trailing slash.
 */
export function starRow(hrefBase: string): B {
  return row(
    [1, 2, 3, 4, 5].map((n) =>
      column([image(emailIconUrl("star", "soft"), `${n} star${n > 1 ? "s" : ""}`, { width: 40, align: "center", href: `${hrefBase}/${n}` })], 20, { paddingX: 0 }),
    ),
    { paddingX: 120, paddingY: 0, columnGap: 8, stackOnMobile: false },
  );
}

/** A numbered step card: a round number, a title and a line. */
export function numberedStep(p: BrandPalette, n: number, title: string, line: string): B {
  return row(
    [
      column(
        [text(String(n), { align: "center", fontSize: 14, fontWeight: "700", color: p.accentText, marginBottom: 0, customCss: `display: inline-block; width: 28px; line-height: 28px; border-radius: 14px; background-color: ${p.accentTint}` })],
        10,
        { paddingX: 0, customCss: "width: 44px; vertical-align: top; text-align: center" },
      ),
      column(
        [
          text(title, { fontSize: 16, fontWeight: "600", color: p.ink, marginBottom: 4 }),
          text(line, { fontSize: 15, lineHeight: "1.55", color: p.body, marginBottom: 0 }),
        ],
        90,
        { paddingX: 0 },
      ),
    ],
    { paddingX: BAND_GUTTER, paddingY: 10, columnGap: 0, stackOnMobile: false },
  );
}

/** Speakers / people side by side: round photo, name, role. */
export function peopleColumns(p: BrandPalette, people: { image: string; name: string; role: string }[]): B {
  const w = Math.floor(100 / people.length);
  return row(
    people.map((s, i) =>
      column(
        [
          image(s.image, s.name, { width: 72, height: 72, borderRadius: 36, objectFit: "cover", align: "center", marginBottom: 10 }),
          text(s.name, { align: "center", fontSize: 15, fontWeight: "600", color: p.ink, marginBottom: 2 }),
          text(s.role, { align: "center", fontSize: 13, color: p.muted, marginBottom: 0 }),
        ],
        i === people.length - 1 ? 100 - w * (people.length - 1) : w,
        { paddingX: 4 },
      ),
    ),
    { paddingX: BAND_GUTTER, paddingY: 8, columnGap: 8 },
  );
}

/** The whole bands.ts builder set, re-exported so a sample file imports one module. */
export { bands, BAND_GUTTER, brandPalette };
export type { BandBlock, BrandPalette };

// ---------------------------------------------------------------------------
// The sample registry entry
// ---------------------------------------------------------------------------

export type SampleTemplate = {
  // Stable key for referencing/seeding (e.g. "welcome", "password-reset").
  key: string;
  // Human label for a gallery / picker.
  name: string;
  category: "transactional" | "marketing";
  // Default subject (templates may override at send time).
  subject: string;
  // The canonical document. Validated against EmailDocumentSchema on load.
  design: EmailDocument;
  // Realistic demo values for every {{variable}} the design references, so a
  // gallery preview, a README screenshot or an agent demo renders a finished
  // email instead of raw tokens. Never sent: the template itself declares only
  // the variable SHAPE, and a real send must supply the values.
  sampleValues: Record<string, string>;
};
