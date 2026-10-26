// Pre-built section layouts — ready-made arrangements of the EXISTING block
// primitives (section / row / column / heading / text / button / image /
// divider / spacer / link). A layout is just a ComponentFragment factory: no
// new block types, no extra HTML/CSS — everything renders through the same
// table-based pipeline as hand-built blocks, so client support is identical to
// the primitives themselves.
//
// Layouts are reusable section bands: common
// email bands (header, hero, split columns, feature list, CTA band, footer)
// that authors drop in and then edit inline like any other blocks. They are
// consumed by:
//   1. the editor's Layouts rail (mini preview → insert at caret/end),
//   2. the public /components library ("Layouts" alongside the primitives),
//   3. Unit's authoring prompt (so 1-shot generations can reuse them).
//
// Every factory returns FRESH ids on each call (via createBlock-style newBlockId)
// so a layout can be inserted repeatedly without id collisions.

import { newBlockId } from "./blocks";
import * as bands from "./bands";
import { NEUTRAL_PALETTE, type BandBrand, type BrandPalette } from "./bands";
import { emailPlaceholderUrl } from "./email-assets";
import { BRAND, DEFAULT_LOGO_URL } from "./samples";
import {
  ComponentFragmentSchema,
  type Block,
  type ComponentFragment,
} from "./schema";

// The groups shown in the rail + docs, in display order.
export const LAYOUT_GROUPS = [
  "Header",
  "Hero",
  "Content",
  "Columns",
  "Call to action",
  "Footer",
] as const;
export type LayoutGroup = (typeof LAYOUT_GROUPS)[number];

export type SectionLayout = {
  // Stable key, e.g. "header-logo" (used for testids + deep links).
  key: string;
  // Human label for the rail/docs, e.g. "Logo header".
  name: string;
  group: LayoutGroup;
  // One-line TLDR for hover/docs.
  description: string;
  // Build a fresh fragment (new block ids on every call).
  build: () => ComponentFragment;
};

// ---------------------------------------------------------------------------
// Tiny builders — thin sugar over the block shapes so layout definitions read
// like the samples. All parse through the Zod schemas via the final
// ComponentFragmentSchema.parse, which fills defaults.
// ---------------------------------------------------------------------------

type B = Record<string, unknown>;

function id(): string {
  return newBlockId();
}

function frag(blocks: B[]): ComponentFragment {
  return ComponentFragmentSchema.parse({ blocks: blocks as unknown as Block[] });
}

const heading = (text: string, extra: B = {}): B => ({
  type: "heading",
  id: id(),
  text,
  ...extra,
});
const text = (t: string, extra: B = {}): B => ({
  type: "text",
  id: id(),
  text: t,
  ...extra,
});
const button = (label: string, extra: B = {}): B => ({
  type: "button",
  id: id(),
  text: label,
  href: "https://example.com",
  align: "center",
  backgroundColor: BRAND.ink,
  textColor: BRAND.onInk,
  borderRadius: 9999,
  innerPaddingX: 32,
  innerPaddingY: 13,
  ...extra,
});
const image = (extra: B = {}): B => ({
  type: "image",
  id: id(),
  src: DEFAULT_LOGO_URL,
  alt: "Acme",
  align: "center",
  width: 48,
  ...extra,
});
const spacer = (height: number): B => ({ type: "spacer", id: id(), height });
const divider = (extra: B = {}): B => ({
  type: "divider",
  id: id(),
  color: BRAND.border,
  ...extra,
});
const link = (t: string, extra: B = {}): B => ({
  type: "link",
  id: id(),
  text: t,
  href: "https://example.com",
  ...extra,
});
// A single text line whose items are REAL inline links ("Blog · Pricing ·
// Support"): each label is a run carrying a link mark, separated by plain
// " · " runs. One <p> with <a> children in the output — the email-safe way to
// do a nav/footer link strip (columns would be heavy and stack on mobile).
// The link runs carry the line's color so they don't flip to the theme link
// blue. Underline stays default: the editor codec only round-trips
// underline:true, so suppressing it here would desync canvas vs. output.
const linksLine = (
  items: { label: string; href?: string }[],
  extra: B & { color?: string } = {},
): B => {
  const runs: { text: string; marks?: Record<string, unknown> }[] = [];
  items.forEach((item, i) => {
    if (i > 0) runs.push({ text: " · " });
    runs.push({
      text: item.label,
      marks: {
        link: item.href ?? "https://example.com",
        color: extra.color ?? BRAND.muted,
      },
    });
  });
  return {
    type: "text",
    id: id(),
    text: runs.map((r) => r.text).join(""),
    content: runs,
    ...extra,
  };
};
const section = (children: B[], extra: B = {}): B => ({
  type: "section",
  id: id(),
  children,
  ...extra,
});
const column = (children: B[], width: number, extra: B = {}): B => ({
  type: "column",
  id: id(),
  width,
  children,
  ...extra,
});
const row = (columns: B[], extra: B = {}): B => ({
  type: "row",
  id: id(),
  columns,
  paddingX: 0,
  paddingY: 0,
  ...extra,
});

// Registry assembled below in registerLayouts() calls, grouped by band type.
const LAYOUTS: SectionLayout[] = [];

function register(
  key: string,
  name: string,
  group: LayoutGroup,
  description: string,
  build: () => B[],
): void {
  LAYOUTS.push({ key, name, group, description, build: () => frag(build()) });
}

// ---------------------------------------------------------------------------
// Header bands
// ---------------------------------------------------------------------------

register("header-logo", "Logo header", "Header", "Centered logo mark — the classic email opener.", () => [
  spacer(8),
  image(),
  spacer(16),
]);

register(
  "header-logo-nav",
  "Logo + links",
  "Header",
  "Logo on the left, quick links on the right.",
  () => [
    row(
      [
        column([image({ align: "left", width: 40 })], 40),
        column(
          [
            linksLine(
              [
                { label: "Blog" },
                { label: "Pricing" },
                { label: "Support" },
              ],
              {
                align: "right",
                fontSize: 13,
                color: BRAND.muted,
                marginBottom: 0,
              },
            ),
          ],
          60,
          { paddingY: 10 },
        ),
      ],
      { paddingY: 4 },
    ),
    spacer(12),
  ],
);

// ---------------------------------------------------------------------------
// Hero bands (first screen)
// ---------------------------------------------------------------------------

register(
  "hero-simple",
  "Simple hero",
  "Hero",
  "Big headline, supporting line, and a pill CTA — the transactional first screen.",
  () => [
    spacer(8),
    heading("A clear, confident headline", {
      level: 1,
      align: "center",
      color: BRAND.ink,
    }),
    text(
      "One or two supporting sentences that expand on the headline and set up the action below.",
      { align: "center", color: BRAND.body },
    ),
    spacer(20),
    button("Get started"),
    spacer(16),
  ],
);

register(
  "hero-image",
  "Image hero",
  "Hero",
  "Full-width image above a headline, copy, and CTA — the announcement opener.",
  () => [
    image({
      src: emailPlaceholderUrl("wide"),
      alt: "Describe the image",
      width: 480,
      borderRadius: 12,
    }),
    spacer(24),
    heading("Introducing something new", {
      level: 1,
      align: "center",
      color: BRAND.ink,
    }),
    text("Tell the story in a sentence or two — what it is and why it matters.", {
      align: "center",
      color: BRAND.body,
    }),
    spacer(20),
    button("See what's new"),
    spacer(16),
  ],
);

register(
  "hero-badge",
  "Status hero",
  "Hero",
  "Eyebrow label + headline + copy — confirmations and status updates.",
  () => [
    spacer(8),
    text("ORDER CONFIRMED", {
      align: "center",
      fontSize: 13,
      color: BRAND.success,
      letterSpacing: 1,
      fontWeight: "600",
      marginBottom: 8,
    }),
    heading("Thanks for your order", {
      level: 1,
      align: "center",
      color: BRAND.ink,
    }),
    text("We've received your payment — a summary is below for your records.", {
      align: "center",
      color: BRAND.muted,
    }),
    spacer(12),
  ],
);

// ---------------------------------------------------------------------------
// Content bands
// ---------------------------------------------------------------------------

register(
  "content-card",
  "Card",
  "Content",
  "A soft tinted card for grouped details — receipts, key facts, summaries.",
  () => [
    section(
      [
        heading("What's inside", {
          level: 3,
          align: "center",
          color: BRAND.ink,
        }),
        text(
          "Use this card to band related details together — order lines, account facts, next steps.",
          { align: "center", fontSize: 15, color: BRAND.body, marginBottom: 0 },
        ),
      ],
      { backgroundColor: BRAND.tint, paddingX: 28, paddingY: 26, border: { radius: 12 } },
    ),
    spacer(8),
  ],
);

register(
  "content-key-value",
  "Detail rows",
  "Content",
  "Label/value lines in a tinted card — order summaries and invoices.",
  // NOTE: rows can't nest inside sections (schema: sections hold leaves +
  // sections only), so this is ONE row that carries the card styling itself:
  // labels column + values column with matching type metrics per line.
  () => [
    row(
      [
        column(
          [
            text("Order", { fontSize: 14, fontWeight: "600", color: BRAND.ink, marginBottom: 12 }),
            text("Item", { fontSize: 14, color: BRAND.muted, marginBottom: 12 }),
            text("Shipping", { fontSize: 14, color: BRAND.muted, marginBottom: 12 }),
            text("Total", { fontSize: 15, fontWeight: "700", color: BRAND.ink, marginBottom: 0 }),
          ],
          60,
        ),
        column(
          [
            text("#2345678", { align: "right", fontSize: 14, fontWeight: "600", color: BRAND.ink, marginBottom: 12 }),
            text("$100.00", { align: "right", fontSize: 14, color: BRAND.muted, marginBottom: 12 }),
            text("$10.00", { align: "right", fontSize: 14, color: BRAND.muted, marginBottom: 12 }),
            text("$110.00", { align: "right", fontSize: 15, fontWeight: "700", color: BRAND.ink, marginBottom: 0 }),
          ],
          40,
        ),
      ],
      {
        backgroundColor: BRAND.tint,
        border: { radius: 12 },
        paddingX: 24,
        paddingY: 20,
        columnGap: 8,
        // Label/value summaries MUST stay side-by-side: stacking on mobile
        // (the row default) would push every label into one block and every
        // value into another, breaking the per-line pairing. A 60/40 split of
        // short label + right-aligned value stays perfectly legible on narrow
        // screens, so lock the two columns together.
        stackOnMobile: false,
      },
    ),
    spacer(8),
  ],
);

register(
  "content-code",
  "Verification code",
  "Content",
  "A big spaced code inside a tinted card — OTP and verification emails.",
  () => [
    section(
      [
        text("Or enter this code manually:", {
          align: "center",
          fontSize: 13,
          color: BRAND.muted,
          marginBottom: 8,
        }),
        heading("123456", {
          level: 2,
          align: "center",
          color: BRAND.ink,
          letterSpacing: 6,
          marginBottom: 0,
        }),
      ],
      { backgroundColor: BRAND.tint, paddingX: 24, paddingY: 20, border: { radius: 12 } },
    ),
    spacer(8),
  ],
);

register(
  "content-quote",
  "Quote / callout",
  "Content",
  "An indented callout for a quote or an important note.",
  () => [
    section(
      [
        text(
          "“A short quote or an important note that deserves its own visual weight.”",
          { fontSize: 16, color: BRAND.ink, marginBottom: 6 },
        ),
        text("— Attribution", { fontSize: 13, color: BRAND.muted, marginBottom: 0 }),
      ],
      { backgroundColor: BRAND.tint, paddingX: 24, paddingY: 20, border: { radius: 12 } },
    ),
    spacer(8),
  ],
);

register(
  "content-action",
  "Action feature",
  "Content",
  "An emoji icon, a headline, and a button — perfect for calling out a specific setting or next step.",
  () => [
    divider(),
    spacer(24),
    text("👩‍💻", { fontSize: 24, marginBottom: 16 }),
    heading("Advanced setup for code scanning", { level: 3, color: BRAND.ink, marginBottom: 8 }),
    text("Need more control? Use advanced setup to customize your code scanning configuration to suit your team's needs.", { fontSize: 15, color: BRAND.body, marginBottom: 20 }),
    button("Learn about advanced settings", { align: "left", marginBottom: 0 }),
    spacer(24),
    divider(),
    spacer(8),
  ],
);

register(
  "content-announcement",
  "Announcement banner",
  "Content",
  "A tinted callout card with an icon, headline, and link — great for product updates.",
  () => [
    row(
      [
        column(
          [
            image({ src: DEFAULT_LOGO_URL, width: 40, height: 40, borderRadius: 8, align: "left" })
          ],
          15
        ),
        column(
          [
            heading("Catch the update?", { level: 3, color: BRAND.ink, marginBottom: 6 }),
            text("Acme Notes is now Acme Docs. Still the docs you know, with a new name and a few new features.", { fontSize: 14, color: BRAND.body, marginBottom: 12 }),
            link("Read the full announcement →", { fontSize: 14, color: BRAND.ink, underline: false, marginBottom: 0 }),
          ],
          85
        )
      ],
      { backgroundColor: BRAND.tint, paddingX: 24, paddingY: 20, columnGap: 16, stackOnMobile: false, border: { radius: 12 } }
    ),
    spacer(8),
  ],
);

register(
  "content-article",
  "Article feature",
  "Content",
  "An eyebrow label, headline, full-width image, and a link — for deep dives and sponsored content.",
  () => [
    text("SPONSOR", { fontSize: 12, color: BRAND.muted, letterSpacing: 1, fontWeight: "600", marginBottom: 8 }),
    heading("An article headline", { level: 2, color: BRAND.ink, marginBottom: 20 }),
    image({ src: emailPlaceholderUrl("landscape"), alt: "Describe the image", width: 480, height: 270, borderRadius: 12 }),
    spacer(20),
    text("Two or three sentences that tell the reader what the piece is about and why it is worth their time. Link out for the rest.", { fontSize: 15, color: BRAND.body, marginBottom: 16 }),
    link("Join the waitlist →", { fontSize: 15, color: BRAND.ink, underline: false, marginBottom: 0 }),
    spacer(8),
  ],
);

// ---------------------------------------------------------------------------
// Column bands
// ---------------------------------------------------------------------------

register(
  "columns-split",
  "Split 50/50",
  "Columns",
  "Image beside copy — the classic feature split (stacks on mobile).",
  () => [
    row(
      [
        column(
          [
            image({
              src: emailPlaceholderUrl("landscape"),
              alt: "Describe the image",
              width: 240,
              borderRadius: 10,
              align: "left",
            }),
          ],
          50,
        ),
        column(
          [
            heading("Feature headline", { level: 3, color: BRAND.ink }),
            text("Two or three lines about the feature and the value it delivers.", {
              fontSize: 14,
              color: BRAND.body,
              marginBottom: 8,
            }),
            link("Learn more →", { fontSize: 14, color: BRAND.ink, underline: false, marginBottom: 0 }),
          ],
          50,
        ),
      ],
      { columnGap: 16 },
    ),
    spacer(8),
  ],
);

register(
  "columns-cards",
  "Two cards",
  "Columns",
  "Side-by-side bordered cards — check-in/checkout, before/after, plan A/B.",
  () => [
    row(
      [
        column(
          [
            text("LEFT", {
              fontSize: 12,
              color: BRAND.muted,
              letterSpacing: 1,
              fontWeight: "600",
              marginBottom: 8,
            }),
            heading("First thing", { level: 3, color: BRAND.ink, marginBottom: 4 }),
            text("A supporting detail line.", { fontSize: 14, color: BRAND.body, marginBottom: 0 }),
          ],
          50,
          { border: { width: 1, style: "solid", color: BRAND.border, radius: 12 }, paddingX: 18, paddingY: 16 },
        ),
        column(
          [
            text("RIGHT", {
              fontSize: 12,
              color: BRAND.muted,
              letterSpacing: 1,
              fontWeight: "600",
              marginBottom: 8,
            }),
            heading("Second thing", { level: 3, color: BRAND.ink, marginBottom: 4 }),
            text("A supporting detail line.", { fontSize: 14, color: BRAND.body, marginBottom: 0 }),
          ],
          50,
          { border: { width: 1, style: "solid", color: BRAND.border, radius: 12 }, paddingX: 18, paddingY: 16 },
        ),
      ],
      { columnGap: 12 },
    ),
    spacer(8),
  ],
);

register(
  "columns-features",
  "Three features",
  "Columns",
  "Three equal columns for a compact feature or stats strip.",
  () => [
    row(
      [
        column(
          [
            heading("Fast", { level: 4, align: "center", color: BRAND.ink, marginBottom: 4 }),
            text("A one-liner.", { align: "center", fontSize: 13, color: BRAND.muted, marginBottom: 0 }),
          ],
          33,
        ),
        column(
          [
            heading("Simple", { level: 4, align: "center", color: BRAND.ink, marginBottom: 4 }),
            text("A one-liner.", { align: "center", fontSize: 13, color: BRAND.muted, marginBottom: 0 }),
          ],
          33,
        ),
        column(
          [
            heading("Reliable", { level: 4, align: "center", color: BRAND.ink, marginBottom: 4 }),
            text("A one-liner.", { align: "center", fontSize: 13, color: BRAND.muted, marginBottom: 0 }),
          ],
          34,
        ),
      ],
      { columnGap: 12 },
    ),
    spacer(8),
  ],
);

register(
  "columns-steps",
  "Numbered steps",
  "Columns",
  "A stacked 1-2-3 list — onboarding and how-it-works flows.",
  () => [
    section(
      [
        heading("Three quick steps", { level: 3, align: "center", color: BRAND.ink }),
        {
          type: "markdown",
          id: id(),
          fontSize: 15,
          color: BRAND.body,
          marginBottom: 0,
          markdown:
            "**1. First step** — a short line about what to do.\n\n**2. Second step** — a short line about what happens next.\n\n**3. Third step** — a short line about the payoff.",
        },
      ],
      { backgroundColor: BRAND.tint, paddingX: 28, paddingY: 26, border: { radius: 12 } },
    ),
    spacer(8),
  ],
);

// ---------------------------------------------------------------------------
// Call-to-action bands
// ---------------------------------------------------------------------------

register(
  "cta-band",
  "CTA band",
  "Call to action",
  "A filled band with a headline and a contrasting pill button.",
  () => [
    section(
      [
        heading("Ready when you are", {
          level: 2,
          align: "center",
          color: BRAND.onInk,
        }),
        text("One line that removes the last bit of friction.", {
          align: "center",
          fontSize: 14,
          color: "#d4d4d8",
        }),
        button("Get started", {
          backgroundColor: BRAND.onInk,
          textColor: BRAND.ink,
          marginBottom: 0,
        }),
      ],
      { backgroundColor: BRAND.ink, paddingX: 28, paddingY: 32, border: { radius: 14 } },
    ),
    spacer(8),
  ],
);

register(
  "cta-centered",
  "Centered CTA",
  "Call to action",
  "Just a headline and a pill button — minimal and direct.",
  () => [
    spacer(8),
    heading("One clear next step", { level: 2, align: "center", color: BRAND.ink }),
    spacer(8),
    button("Take the step"),
    spacer(8),
  ],
);

// ---------------------------------------------------------------------------
// Footer bands
// ---------------------------------------------------------------------------

register(
  "footer-simple",
  "Simple footer",
  "Footer",
  "Hairline and a friendly help line — the transactional closer. No postal " +
    "address or unsubscribe (marketing emails get those from the managed " +
    "compliance footer automatically).",
  () => [
    divider(),
    spacer(4),
    text("Need a hand? Just reply to this email — a real human will get back to you.", {
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      marginBottom: 0,
    }),
  ],
);

register(
  "footer-rich",
  "Rich footer",
  "Footer",
  "Logo and a links row (blog, help, contact). No unsubscribe or postal " +
    "address — those are added automatically by the managed compliance footer.",
  () => [
    divider(),
    spacer(12),
    image({ width: 36 }),
    spacer(12),
    linksLine(
      [
        { label: "Blog" },
        { label: "Help center" },
        { label: "Contact us" },
      ],
      {
        align: "center",
        fontSize: 13,
        color: BRAND.muted,
        marginBottom: 0,
      },
    ),
  ],
);

register(
  "footer-social",
  "Footer + apps",
  "Footer",
  "Two-column footer: a short tagline on the left, app/store links on the " +
    "right. No unsubscribe or postal address — the managed compliance footer " +
    "adds those automatically.",
  () => [
    divider(),
    spacer(12),
    row(
      [
        column(
          [
            text("Made with care by the Acme team.", {
              fontSize: 12,
              color: BRAND.muted,
              marginBottom: 0,
            }),
          ],
          60,
        ),
        column(
          [
            text("Get the app", {
              align: "right",
              fontSize: 12,
              fontWeight: "600",
              color: BRAND.muted,
              marginBottom: 6,
            }),
            linksLine(
              [{ label: "App Store" }, { label: "Google Play" }],
              {
                align: "right",
                fontSize: 12,
                color: BRAND.muted,
                marginBottom: 0,
              },
            ),
          ],
          40,
        ),
      ],
      { columnGap: 16 },
    ),
  ],
);

// ---------------------------------------------------------------------------
// Themed bands (bands.ts) — the EMAIL_DESIGN.md system. Full-bleed bands with
// their own 32px gutter (compose them with `body-padding={0}`), drawn from a
// BrandPalette. The rail and design_library insert them in the neutral palette
// with sample copy; buildThemedLayout rebuilds one in a workspace's brand
// colours, and design-guide.ts composes them into whole emails per type.
// ---------------------------------------------------------------------------

type Themed = (p: BrandPalette, brand: BandBrand) => B[];
const THEMED: Map<string, Themed> = new Map();
const SAMPLE_BRAND: BandBrand = { name: "Acme", logo: DEFAULT_LOGO_URL };
const sampleHref = "https://example.com";

function registerThemed(key: string, name: string, group: LayoutGroup, description: string, build: Themed): void {
  THEMED.set(key, build);
  register(key, name, group, description, () => build(NEUTRAL_PALETTE, SAMPLE_BRAND));
}

/** True when the layout is one of the palette-aware bands. */
export function isThemedLayout(key: string): boolean {
  return THEMED.has(key);
}

/** A themed band rebuilt in `palette` (fresh ids, sample copy); null for unknown or non-themed keys. */
export function buildThemedLayout(key: string, palette: BrandPalette, brand: BandBrand = SAMPLE_BRAND): ComponentFragment | null {
  const build = THEMED.get(key);
  return build ? frag(build(palette, brand)) : null;
}

registerThemed("header-brand", "Brand header", "Header", "Logo and brand name on the left, a small label pill on the right (issue, date, 'New').", (p, b) =>
  bands.headerBrand(p, b, { label: "October 2026" }),
);
registerThemed("header-wordmark", "Wordmark header", "Header", "The brand name set as a wordmark — the header for a brand with no logo image yet.", (p, b) =>
  bands.headerWordmark(p, { name: b.name }),
);
registerThemed(
  "hero-headline",
  "Headline hero",
  "Hero",
  "Overline, big headline, one or two lines and a pill button, left-aligned — the default opener for product and marketing email.",
  (p) => bands.heroHeadline(p, { overline: "New", title: "A clear headline that states the point", lead: "One or two sentences on what changed and why it matters to the reader.", cta: { label: "See what's new", href: sampleHref } }),
);
registerThemed(
  "hero-contrast",
  "Contrast hero",
  "Hero",
  "A full-width brand-coloured (or near-black) band with light text and a light button — launches, sales, big news.",
  (p) => bands.heroContrast(p, { overline: "Introducing", title: "The headline goes here", lead: "A short line that sells the click.", cta: { label: "Try it now", href: sampleHref } }),
);
registerThemed(
  "hero-gradient",
  "Gradient hero",
  "Hero",
  "The contrast hero on a brand gradient. Clients without gradient support (Outlook, Yahoo) show the solid band colour, so text stays readable.",
  (p) => bands.heroGradient(p, { overline: "Introducing", title: "The headline goes here", lead: "A short line that sells the click.", cta: { label: "Try it now", href: sampleHref } }),
);
registerThemed(
  "hero-status",
  "Status hero",
  "Hero",
  "A centred status chip, label, headline and line — order confirmed, payment received, booking set.",
  (p) => bands.heroStatus(p, { icon: "circle-check", overline: "Order confirmed", title: "Thanks for your order", line: "We've received your payment. Your receipt is below." }),
);
registerThemed(
  "hero-media",
  "Media hero",
  "Hero",
  "A wide image (a placeholder until you add yours), then headline, line and button — image-led launches.",
  (p) => bands.heroMedia(p, { alt: "Describe the image", title: "The headline goes here", lead: "One or two sentences on what it is and why it matters.", cta: { label: "Take a look", href: sampleHref } }),
);
registerThemed(
  "content-feature",
  "Feature section",
  "Content",
  "Overline, section headline, a paragraph, three bullets and a text link — one topic of a launch or newsletter.",
  (p) =>
    bands.feature(p, {
      overline: "Feature",
      title: "A section headline",
      body: "Two or three sentences that explain the feature in the reader's terms.",
      bullets: ["The first benefit, in one line.", "The second benefit.", "The third benefit."],
      link: { label: "Learn more →", href: sampleHref },
    }),
);
registerThemed("content-icon-rows", "Icon rows", "Content", "Three rows of icon + title + line — getting-started steps, what's included, why it matters.", (p) =>
  bands.iconRows(p, {
    title: "What you can do next",
    rows: [
      { icon: "rocket", title: "Set up your account", line: "Add your details so everything looks like you." },
      { icon: "users", title: "Invite your team", line: "Work together from one place." },
      { icon: "life-buoy", title: "Get help anytime", line: "Reply to this email and a person will answer." },
    ],
  }),
);
registerThemed("content-stats", "Stats row", "Content", "Three big numbers with labels on a tinted band — a digest, a year in review, results.", (p) =>
  bands.stats(p, { items: [{ value: "12k", label: "emails sent" }, { value: "98%", label: "delivered" }, { value: "4.2×", label: "more replies" }] }),
);
registerThemed(
  "content-summary",
  "Order summary",
  "Content",
  "A tinted band of label/value lines with a bold total — receipts, invoices, order and booking summaries.",
  (p) =>
    bands.summary(p, {
      heading: "Order #10421",
      meta: "Oct 24, 2026",
      lines: [{ label: "Pro plan (monthly)", value: "$29.00" }, { label: "Extra seats × 2", value: "$18.00" }, { label: "Tax", value: "$4.70" }],
      total: { label: "Total paid", value: "$51.70" },
    }),
);
registerThemed("content-code-card", "Code card", "Content", "A big spaced one-time code in a tinted card, with how long it lasts — sign-in and verification.", (p) =>
  bands.codeCard(p, { label: "Your sign-in code", code: "482 913", note: "Expires in 10 minutes." }),
);
registerThemed("content-callout", "Callout card", "Content", "A brand-tinted card with a label, headline, line and link — a 'coming soon', a tip, a side note.", (p) =>
  bands.callout(p, { overline: "Coming soon", title: "A short headline", body: "One or two lines about it.", link: { label: "Join the waitlist →", href: sampleHref } }),
);
registerThemed("content-offer", "Offer card", "Content", "A contrast card with the offer as the headline, the code in a pill and a light button — sales and promos.", (p) =>
  bands.offer(p, {
    overline: "This week only",
    title: "30% off everything",
    line: "Use this code at checkout.",
    code: "SAVE30",
    cta: { label: "Shop the sale", href: sampleHref },
    terms: "Ends Sunday at midnight. Can't be combined with other offers.",
  }),
);
registerThemed(
  "content-event",
  "Event details",
  "Content",
  "Date, time and place (or video link) as icon rows, then an add-to-calendar link — invites, bookings, reminders.",
  (p) =>
    bands.eventDetails(p, {
      title: "Event details",
      rows: [
        { icon: "calendar", label: "Date", value: "Thursday, November 13" },
        { icon: "clock", label: "Time", value: "10:00–11:00 AM PT" },
        { icon: "video", label: "Where", value: "Online — the link is in your calendar invite" },
      ],
      link: { label: "Add to calendar →", href: sampleHref },
    }),
);
registerThemed(
  "columns-products",
  "Product grid",
  "Columns",
  "Two product tiles (image, name, price, link) — promos, new arrivals, abandoned cart. Placeholders until you add photos.",
  (p) => bands.products(p, { items: [{ name: "Product name", price: "$48", href: sampleHref }, { name: "Product name", price: "$64", href: sampleHref }] }),
);
registerThemed("cta-contrast", "Contrast CTA", "Call to action", "A rounded brand (or near-black) card with a headline, a line and a light button — the closing ask.", (p) =>
  bands.ctaContrast(p, { title: "Ready when you are", line: "One line that removes the last bit of friction.", cta: { label: "Get started", href: sampleHref } }),
);
registerThemed(
  "footer-signoff",
  "Sign-off",
  "Footer",
  "A hairline, a 'just reply' help line and a team sign-off. No unsubscribe or address — the managed footer adds those to marketing email.",
  (p, b) => bands.signoff(p, { help: "Questions? Reply to this email — a real person reads every reply.", signature: `The ${b.name} team` }),
);

export const SECTION_LAYOUTS: readonly SectionLayout[] = LAYOUTS;

// Lookup by key (rail insert + docs deep links).
export function getSectionLayout(key: string): SectionLayout | undefined {
  return LAYOUTS.find((l) => l.key === key);
}
