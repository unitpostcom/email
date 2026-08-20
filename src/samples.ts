// Sample email templates — ready-to-use EmailDocument starting points covering
// the most common transactional and marketing sends. Each is a valid canonical
// document (same shape the visual/code editor and the send API consume), so it
// can be dropped straight into a Template `design` column or POSTed to
// /api/email/templates and opened in the editor with no further conversion.
//
// Variables follow the manifest model in schema.ts:
//   • source "input"   — caller-supplied per send (transactional 1:1).
//   • source "contact" — resolved from the recipient's Contact row (marketing).
// Marketing samples carry the unsubscribe + postal-address footer required by
// CAN-SPAM/GDPR (see EmailDocument.category docs).

import { EmailDocumentSchema, type EmailDocument } from "./schema";
import { z } from "zod";

// The PRE-parse (input) shape of a document's blocks: required fields that carry
// schema `.default()`s (e.g. `color`, `marginBottom`) are optional here, so the
// sample helpers can author terse block literals and let `EmailDocumentSchema
// .parse()` fill the defaults. Distinct from `EmailDocument["blocks"]`, which is
// the parsed/output type where those fields are always present.
type SampleBlocksInput = NonNullable<z.input<typeof EmailDocumentSchema>["blocks"]>;

// Loose block-literal type for the helper builders below — the terse authoring
// shape that `EmailDocumentSchema.parse()` validates + fills defaults on. Kept
// local (not exported) so it never leaks into the public sample types.
type B = Record<string, unknown>;

// Small id helper so block ids are stable + unique within a document without
// pulling a uuid dependency into this data module.
function makeId(prefix: string, n: number): string {
  return `${prefix}-${n}`;
}

// Unitpost brand palette — keep every sample on-identity and in light mode by
// default. Mirrors the app tokens (near-black primary on white, zinc grays).
// Authors can recolor in the editor; these are just good-looking defaults.
// EXPORTED so the pre-built section layouts (layouts.ts) share the exact same
// palette as the samples.
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
// preview. Authors swap it for their own logo in the editor; it's just a
// good-looking, always-resolving default (no broken-image placeholder).
export const DEFAULT_LOGO_URL =
  "https://www.unitpost.com/web-app-manifest-192x192.png";

// Curated, free-to-use minimalist stock imagery (Unsplash) for the samples that
// benefit from a hero. Sized + cropped via Unsplash's URL params so they load
// fast and keep a consistent aspect ratio. Neutral/on-brand subjects only.
// These are placeholders the author replaces with their own art; they exist so
// the gallery preview looks finished rather than empty.
const STOCK = {
  // Soft, neutral abstract — good for launches/announcements.
  launch:
    "https://images.unsplash.com/photo-1620121692029-d088224ddc74?auto=format&fit=crop&w=1120&q=80",
  // Minimal desk / workspace — onboarding, guides.
  workspace:
    "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=1120&q=80",
  // Calm gradient/texture — newsletters, digests.
  texture:
    "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1120&q=80",
  // Event / calendar vibe — webinars, invites.
  event:
    "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1120&q=80",
} as const;

// Shared light-mode theme: white paper centered on a soft zinc backdrop, our
// system font stack, ink text, ink links. Used by every sample so they share
// one visual identity out of the box. `contentWidth` 560 + the renderer's fluid
// `.ee-body` rule keeps every sample responsive (fills the viewport below the
// content width instead of forcing horizontal scroll). A subtle `bodyRadius`
// rounds the paper to match the app's card aesthetic.
//
// EXPORTED so freshly-created templates (dashboard + API) can seed the same
// on-brand look — the schema's own ThemeSchema defaults stay untouched as the
// backward-compat baseline for older stored documents.
export const BRAND_THEME = {
  textColor: BRAND.ink,
  linkColor: BRAND.ink,
  backgroundColor: BRAND.page,
  bodyColor: BRAND.surface,
  contentWidth: 560,
  bodyPadding: 40,
  bodyRadius: 14,
} as const;

// The standard brand logo block — centered, hosted PNG, capped to a tidy width.
// Shared by every sample so the header mark is identical (and never broken) out
// of the box.
function logo(id: string, alt = "Unitpost"): SampleBlocksInput[number] {
  return {
    type: "image",
    id,
    src: DEFAULT_LOGO_URL,
    alt,
    align: "center",
    width: 48,
  };
}

// An ink (near-black) FULLY-ROUNDED (pill) button on white — the brand's
// primary action style, matching the app's rounded button aesthetic.
function brandButton(
  id: string,
  text: string,
  href: string,
): SampleBlocksInput[number] {
  return {
    type: "button",
    id,
    text,
    href,
    align: "center",
    backgroundColor: BRAND.ink,
    textColor: BRAND.onInk,
    borderRadius: 9999,
    innerPaddingX: 34,
    innerPaddingY: 14,
  };
}

// A label/value detail table — the receipt/invoice/order-summary idiom. Rows
// can't nest inside sections (schema: sections hold leaves + sections only), so
// this is ONE row that carries the tinted-card styling itself: a left labels
// column + a right values column with matching type metrics per line. The last
// line is emphasized (the total). Mirrors the `content-key-value` layout so the
// samples and the pre-built layout render identically.
function keyValueRow(
  prefix: string,
  n: number,
  lines: { label: string; value: string }[],
): SampleBlocksInput[number] {
  const last = lines.length - 1;
  const labelCell = (line: { label: string }, i: number): B => ({
    type: "text",
    id: makeId(`${prefix}-kv${n}-l`, i),
    fontSize: i === last ? 15 : 14,
    fontWeight: i === last ? "700" : i === 0 ? "600" : "400",
    color: i === last || i === 0 ? BRAND.ink : BRAND.muted,
    text: line.label,
    marginBottom: i === last ? 0 : 12,
  });
  const valueCell = (line: { value: string }, i: number): B => ({
    type: "text",
    id: makeId(`${prefix}-kv${n}-v`, i),
    align: "right",
    fontSize: i === last ? 15 : 14,
    fontWeight: i === last ? "700" : i === 0 ? "600" : "400",
    color: i === last || i === 0 ? BRAND.ink : BRAND.muted,
    text: line.value,
    marginBottom: i === last ? 0 : 12,
  });
  return {
    type: "row",
    id: makeId(`${prefix}-kv`, n),
    backgroundColor: BRAND.tint,
    border: { radius: 12 },
    paddingX: 24,
    paddingY: 20,
    columnGap: 8,
    columns: [
      {
        type: "column",
        id: makeId(`${prefix}-kv${n}-col`, 1),
        width: 60,
        children: lines.map(labelCell),
      },
      {
        type: "column",
        id: makeId(`${prefix}-kv${n}-col`, 2),
        width: 40,
        children: lines.map(valueCell),
      },
    ],
  } as SampleBlocksInput[number];
}

// A three-up feature/stat strip — three equal centered columns (stat + caption).
// Stacks on mobile via the renderer. Mirrors the `columns-features` layout.
function featureColumns(
  prefix: string,
  n: number,
  cols: { title: string; caption: string }[],
): SampleBlocksInput[number] {
  const widths = cols.length === 3 ? [33, 33, 34] : cols.map(() => Math.floor(100 / cols.length));
  return {
    type: "row",
    id: makeId(`${prefix}-feat`, n),
    columnGap: 12,
    columns: cols.map((c, i) => ({
      type: "column",
      id: makeId(`${prefix}-feat${n}-col`, i),
      width: widths[i] ?? 33,
      children: [
        {
          type: "heading",
          id: makeId(`${prefix}-feat${n}-h`, i),
          level: 3,
          align: "center",
          color: BRAND.ink,
          text: c.title,
          marginBottom: 4,
        },
        {
          type: "text",
          id: makeId(`${prefix}-feat${n}-t`, i),
          align: "center",
          fontSize: 13,
          color: BRAND.muted,
          text: c.caption,
          marginBottom: 0,
        },
      ],
    })),
  } as SampleBlocksInput[number];
}

// A filled ink CTA band — headline + supporting line + a contrasting (white)
// pill button on the near-black surface. Mirrors the `cta-band` layout. Used to
// close a marketing send with a confident, high-contrast action.
function ctaBand(
  prefix: string,
  n: number,
  heading: string,
  body: string,
  buttonText: string,
  href: string,
): SampleBlocksInput[number] {
  return {
    type: "section",
    id: makeId(`${prefix}-band`, n),
    backgroundColor: BRAND.ink,
    paddingX: 28,
    paddingY: 32,
    border: { radius: 14 },
    children: [
      {
        type: "heading",
        id: makeId(`${prefix}-band${n}-h`, 1),
        level: 2,
        align: "center",
        color: BRAND.onInk,
        text: heading,
      },
      {
        type: "text",
        id: makeId(`${prefix}-band${n}-t`, 1),
        align: "center",
        fontSize: 14,
        color: "#d4d4d8",
        text: body,
      },
      {
        type: "button",
        id: makeId(`${prefix}-band${n}-b`, 1),
        text: buttonText,
        href,
        align: "center",
        backgroundColor: BRAND.onInk,
        textColor: BRAND.ink,
        borderRadius: 9999,
        innerPaddingX: 34,
        innerPaddingY: 14,
        marginBottom: 0,
      },
    ],
  } as SampleBlocksInput[number];
}

// A small caps eyebrow line — the muted, letter-spaced label above a headline.
// Codifies the eyebrow idiom repeated across the samples so it stays identical.
function eyebrow(
  prefix: string,
  n: number,
  label: string,
  color: string = BRAND.muted,
): SampleBlocksInput[number] {
  return {
    type: "text",
    id: makeId(`${prefix}-eyebrow`, n),
    align: "center",
    fontSize: 13,
    color,
    letterSpacing: 1,
    fontWeight: "600",
    text: label,
  } as SampleBlocksInput[number];
}

export type SampleTemplate = {
  // Stable key for referencing/seeding (e.g. "welcome", "password-reset").
  key: string;
  // Human label for a gallery / picker.
  name: string;
  category: "transactional" | "marketing";
  // Default subject (templates may override at send time).
  subject: string;
  // The canonical document. Validated against EmailDocumentSchema on load below.
  design: EmailDocument;
};

// ---------------------------------------------------------------------------
// Transactional
// ---------------------------------------------------------------------------

const welcome: EmailDocument = EmailDocumentSchema.parse({
  category: "transactional",
  previewText: "Welcome aboard — here's how to get started.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "product_name", type: "string", source: "input" },
    { name: "get_started_url", type: "string", source: "input" },
  ],
  blocks: [
    logo(makeId("welcome", 1), "{{product_name}}"),
    { type: "spacer", id: makeId("welcome", 2), height: 24 },
    {
      type: "heading",
      id: makeId("welcome", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "Welcome aboard, {{first_name}} 👋",
    },
    {
      type: "text",
      id: makeId("welcome", 4),
      align: "center",
      color: BRAND.body,
      text: "Thanks for joining {{product_name}}. Your account is ready — let's get you to your first win in just a couple of minutes.",
    },
    { type: "spacer", id: makeId("welcome", 5), height: 24 },
    brandButton(makeId("welcome", 6), "Get started", "{{get_started_url}}"),
    { type: "spacer", id: makeId("welcome", 7), height: 32 },
    {
      type: "section",
      id: makeId("welcome", 8),
      backgroundColor: BRAND.tint,
      paddingX: 28,
      paddingY: 28,
      border: { radius: 12 },
      children: [
        {
          type: "heading",
          id: makeId("welcome", 9),
          level: 3,
          align: "center",
          color: BRAND.ink,
          text: "Three quick steps to get value fast",
        },
        {
          type: "markdown",
          id: makeId("welcome", 10),
          fontSize: 15,
          color: BRAND.body,
          markdown:
            "**1. Set up your profile** — add the details that personalize your experience.\n\n**2. Connect your first integration** — bring your data in so things just work.\n\n**3. Invite your team** — {{product_name}} is better together.",
        },
      ],
    },
    { type: "spacer", id: makeId("welcome", 11), height: 28 },
    {
      type: "divider",
      id: makeId("welcome", 12),
      color: BRAND.border,
    },
    { type: "spacer", id: makeId("welcome", 13), height: 16 },
    {
      type: "text",
      id: makeId("welcome", 14),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "Need a hand? Just reply to this email — a real human will get back to you.",
    },
  ],
});

const passwordReset: EmailDocument = EmailDocumentSchema.parse({
  category: "transactional",
  previewText: "Reset your password — link expires in 60 minutes.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "reset_url", type: "string", source: "input" },
    { name: "expiry_minutes", type: "number", source: "input" },
  ],
  blocks: [
    logo(makeId("reset", 1)),
    { type: "spacer", id: makeId("reset", 2), height: 24 },
    {
      type: "heading",
      id: makeId("reset", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "Reset your password",
    },
    {
      type: "text",
      id: makeId("reset", 4),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, we got a request to reset your password. Tap the button below to choose a new one.",
    },
    { type: "spacer", id: makeId("reset", 5), height: 24 },
    brandButton(makeId("reset", 6), "Reset password", "{{reset_url}}"),
    { type: "spacer", id: makeId("reset", 7), height: 28 },
    {
      type: "divider",
      id: makeId("reset", 8),
      color: BRAND.border,
    },
    { type: "spacer", id: makeId("reset", 9), height: 16 },
    {
      type: "text",
      id: makeId("reset", 10),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "This link expires in {{expiry_minutes}} minutes. Didn't request this? You can safely ignore this email — your password won't change.",
    },
  ],
});

const emailVerification: EmailDocument = EmailDocumentSchema.parse({
  category: "transactional",
  previewText: "Confirm your email address to finish setting up your account.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "verify_url", type: "string", source: "input" },
    { name: "verification_code", type: "string", source: "input" },
  ],
  blocks: [
    logo(makeId("verify", 1)),
    { type: "spacer", id: makeId("verify", 2), height: 24 },
    {
      type: "heading",
      id: makeId("verify", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "Confirm your email",
    },
    {
      type: "text",
      id: makeId("verify", 4),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, you're almost there. Tap the button below to verify this address and activate your account.",
    },
    { type: "spacer", id: makeId("verify", 5), height: 24 },
    brandButton(makeId("verify", 6), "Verify email", "{{verify_url}}"),
    { type: "spacer", id: makeId("verify", 7), height: 24 },
    {
      type: "section",
      id: makeId("verify", 8),
      backgroundColor: BRAND.tint,
      paddingX: 24,
      paddingY: 20,
      border: { radius: 12 },
      children: [
        {
          type: "text",
          id: makeId("verify", 9),
          align: "center",
          fontSize: 13,
          color: BRAND.muted,
          text: "Or enter this code manually:",
          marginBottom: 8,
        },
        {
          type: "heading",
          id: makeId("verify", 10),
          level: 2,
          align: "center",
          color: BRAND.ink,
          letterSpacing: 6,
          text: "{{verification_code}}",
          marginBottom: 0,
        },
      ],
    },
    { type: "spacer", id: makeId("verify", 11), height: 20 },
    {
      type: "text",
      id: makeId("verify", 12),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "If you didn't create an account, you can safely ignore this email.",
    },
  ],
});

const magicLink: EmailDocument = EmailDocumentSchema.parse({
  category: "transactional",
  previewText: "Your sign-in link — valid for the next 15 minutes.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "login_url", type: "string", source: "input" },
    { name: "expiry_minutes", type: "number", source: "input" },
  ],
  blocks: [
    logo(makeId("magic", 1)),
    { type: "spacer", id: makeId("magic", 2), height: 24 },
    {
      type: "heading",
      id: makeId("magic", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "Your sign-in link",
    },
    {
      type: "text",
      id: makeId("magic", 4),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, tap the button below to sign in securely — no password required.",
    },
    { type: "spacer", id: makeId("magic", 5), height: 24 },
    brandButton(makeId("magic", 6), "Sign in", "{{login_url}}"),
    { type: "spacer", id: makeId("magic", 7), height: 28 },
    { type: "divider", id: makeId("magic", 8), color: BRAND.border },
    { type: "spacer", id: makeId("magic", 9), height: 16 },
    {
      type: "text",
      id: makeId("magic", 10),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "This link expires in {{expiry_minutes}} minutes and can only be used once. Didn't try to sign in? You can ignore this email.",
    },
  ],
});

const receipt: EmailDocument = EmailDocumentSchema.parse({
  category: "transactional",
  previewText: "Thanks for your purchase — here's your receipt.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "order_number", type: "string", source: "input" },
    { name: "item_name", type: "string", source: "input" },
    { name: "amount", type: "string", source: "input" },
    { name: "receipt_url", type: "string", source: "input" },
  ],
  blocks: [
    logo(makeId("receipt", 1)),
    { type: "spacer", id: makeId("receipt", 2), height: 20 },
    {
      type: "text",
      id: makeId("receipt", 3),
      align: "center",
      fontSize: 13,
      color: BRAND.success,
      letterSpacing: 1,
      fontWeight: "600",
      text: "PAYMENT CONFIRMED",
    },
    {
      type: "heading",
      id: makeId("receipt", 4),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "Thanks for your purchase",
    },
    {
      type: "text",
      id: makeId("receipt", 5),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, we've received your payment. A copy of your receipt is below for your records.",
    },
    { type: "spacer", id: makeId("receipt", 6), height: 20 },
    keyValueRow("receipt", 1, [
      { label: "Order", value: "{{order_number}}" },
      { label: "{{item_name}}", value: "$49.00" },
      { label: "Editor seats × 3", value: "$27.00" },
      { label: "Usage overage", value: "$8.00" },
      { label: "Total paid", value: "{{amount}}" },
    ]),
    { type: "spacer", id: makeId("receipt", 9), height: 24 },
    brandButton(makeId("receipt", 10), "View receipt", "{{receipt_url}}"),
    { type: "spacer", id: makeId("receipt", 11), height: 16 },
    {
      type: "text",
      id: makeId("receipt", 12),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "Questions about this charge? Just reply to this email and we'll help.",
    },
  ],
});

const invoice: EmailDocument = EmailDocumentSchema.parse({
  category: "transactional",
  previewText: "Invoice {{invoice_number}} is ready — due {{due_date}}.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "invoice_number", type: "string", source: "input" },
    { name: "amount_due", type: "string", source: "input" },
    { name: "due_date", type: "string", source: "input" },
    { name: "pay_url", type: "string", source: "input" },
  ],
  blocks: [
    logo(makeId("inv", 1)),
    { type: "spacer", id: makeId("inv", 2), height: 24 },
    {
      type: "heading",
      id: makeId("inv", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "Invoice {{invoice_number}}",
    },
    {
      type: "text",
      id: makeId("inv", 4),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, your latest invoice is ready. You can review and pay it online in one click.",
    },
    { type: "spacer", id: makeId("inv", 5), height: 20 },
    {
      type: "section",
      id: makeId("inv", 6),
      backgroundColor: BRAND.tint,
      paddingX: 28,
      paddingY: 26,
      border: { radius: 12 },
      children: [
        {
          type: "text",
          id: makeId("inv", 7),
          align: "center",
          fontSize: 13,
          color: BRAND.muted,
          letterSpacing: 1,
          fontWeight: "600",
          text: "AMOUNT DUE",
          marginBottom: 6,
        },
        {
          type: "heading",
          id: makeId("inv", 8),
          level: 1,
          align: "center",
          color: BRAND.ink,
          text: "{{amount_due}}",
          marginBottom: 6,
        },
        {
          type: "text",
          id: makeId("inv", 9),
          align: "center",
          fontSize: 14,
          color: BRAND.muted,
          text: "Due {{due_date}}",
        },
      ],
    },
    { type: "spacer", id: makeId("inv", 10), height: 24 },
    brandButton(makeId("inv", 11), "Pay invoice", "{{pay_url}}"),
    { type: "spacer", id: makeId("inv", 12), height: 16 },
    {
      type: "text",
      id: makeId("inv", 13),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "Prefer to pay another way? Reply to this email and we'll sort it out.",
    },
  ],
});

const teamInvite: EmailDocument = EmailDocumentSchema.parse({
  category: "transactional",
  previewText: "{{inviter_name}} invited you to join {{team_name}}.",
  theme: BRAND_THEME,
  variables: [
    { name: "inviter_name", type: "string", source: "input" },
    { name: "team_name", type: "string", source: "input" },
    { name: "accept_url", type: "string", source: "input" },
  ],
  blocks: [
    logo(makeId("invite", 1)),
    { type: "spacer", id: makeId("invite", 2), height: 24 },
    {
      type: "heading",
      id: makeId("invite", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "You've been invited to {{team_name}}",
    },
    {
      type: "text",
      id: makeId("invite", 4),
      align: "center",
      color: BRAND.body,
      text: "{{inviter_name}} has invited you to collaborate on {{team_name}}. Accept the invite to get started.",
    },
    { type: "spacer", id: makeId("invite", 5), height: 24 },
    brandButton(makeId("invite", 6), "Accept invitation", "{{accept_url}}"),
    { type: "spacer", id: makeId("invite", 7), height: 28 },
    { type: "divider", id: makeId("invite", 8), color: BRAND.border },
    { type: "spacer", id: makeId("invite", 9), height: 16 },
    {
      type: "text",
      id: makeId("invite", 10),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "This invitation was intended for you. If you weren't expecting it, you can safely ignore this email.",
    },
  ],
});

// A shipping confirmation — order status hero, a tracking-summary detail table,
// and a track-package CTA. Uses the key-value row (the receipt idiom) for the
// order + carrier details.
const shippingConfirmation: EmailDocument = EmailDocumentSchema.parse({
  category: "transactional",
  previewText: "Your order is on the way — track it any time.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "order_number", type: "string", source: "input" },
    { name: "carrier", type: "string", source: "input" },
    { name: "tracking_number", type: "string", source: "input" },
    { name: "estimated_delivery", type: "string", source: "input" },
    { name: "track_url", type: "string", source: "input" },
  ],
  blocks: [
    logo(makeId("ship", 1)),
    { type: "spacer", id: makeId("ship", 2), height: 20 },
    eyebrow("ship", 1, "ON THE WAY", BRAND.success),
    {
      type: "heading",
      id: makeId("ship", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "Your order is shipped",
    },
    {
      type: "text",
      id: makeId("ship", 4),
      align: "center",
      color: BRAND.body,
      text: "Good news, {{first_name}} — order {{order_number}} is on its way. Here are the details.",
    },
    { type: "spacer", id: makeId("ship", 5), height: 20 },
    keyValueRow("ship", 1, [
      { label: "Carrier", value: "{{carrier}}" },
      { label: "Tracking", value: "{{tracking_number}}" },
      { label: "Est. delivery", value: "{{estimated_delivery}}" },
    ]),
    { type: "spacer", id: makeId("ship", 6), height: 24 },
    brandButton(makeId("ship", 7), "Track your package", "{{track_url}}"),
    { type: "spacer", id: makeId("ship", 8), height: 16 },
    {
      type: "text",
      id: makeId("ship", 9),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "Tracking can take a few hours to update after your parcel leaves our warehouse.",
    },
  ],
});

// A subscription-renewal notice — a heads-up that a plan renews soon, with the
// plan + amount + renewal date in a detail table and a manage-subscription CTA.
const subscriptionRenewal: EmailDocument = EmailDocumentSchema.parse({
  category: "transactional",
  previewText: "Your {{plan_name}} plan renews on {{renewal_date}}.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "plan_name", type: "string", source: "input" },
    { name: "renewal_amount", type: "string", source: "input" },
    { name: "renewal_date", type: "string", source: "input" },
    { name: "manage_url", type: "string", source: "input" },
  ],
  blocks: [
    logo(makeId("renew", 1)),
    { type: "spacer", id: makeId("renew", 2), height: 24 },
    {
      type: "heading",
      id: makeId("renew", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "Your plan renews soon",
    },
    {
      type: "text",
      id: makeId("renew", 4),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, just a heads-up that your subscription will renew automatically. No action is needed to stay subscribed.",
    },
    { type: "spacer", id: makeId("renew", 5), height: 20 },
    keyValueRow("renew", 1, [
      { label: "Plan", value: "{{plan_name}}" },
      { label: "Renews on", value: "{{renewal_date}}" },
      { label: "Amount", value: "{{renewal_amount}}" },
    ]),
    { type: "spacer", id: makeId("renew", 6), height: 24 },
    brandButton(makeId("renew", 7), "Manage subscription", "{{manage_url}}"),
    { type: "spacer", id: makeId("renew", 8), height: 16 },
    {
      type: "text",
      id: makeId("renew", 9),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "Want to change or cancel? You can do it any time before {{renewal_date}} from your billing settings.",
    },
  ],
});

// A trial-ending nudge — friendly reminder that a free trial is about to end,
// what happens next, and a clear upgrade action.
const trialEnding: EmailDocument = EmailDocumentSchema.parse({
  category: "transactional",
  previewText: "Your {{product_name}} trial ends in {{days_left}} days.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "product_name", type: "string", source: "input" },
    { name: "days_left", type: "string", source: "input" },
    { name: "upgrade_url", type: "string", source: "input" },
  ],
  blocks: [
    logo(makeId("trial", 1), "{{product_name}}"),
    { type: "spacer", id: makeId("trial", 2), height: 24 },
    eyebrow("trial", 1, "TRIAL ENDING"),
    {
      type: "heading",
      id: makeId("trial", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "{{days_left}} days left in your trial",
    },
    {
      type: "text",
      id: makeId("trial", 4),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, your free trial of {{product_name}} is wrapping up. Upgrade now to keep your work, your settings, and everything you've set up.",
    },
    { type: "spacer", id: makeId("trial", 5), height: 24 },
    brandButton(makeId("trial", 6), "Upgrade my account", "{{upgrade_url}}"),
    { type: "spacer", id: makeId("trial", 7), height: 28 },
    {
      type: "divider",
      id: makeId("trial", 8),
      color: BRAND.border,
    },
    { type: "spacer", id: makeId("trial", 9), height: 16 },
    {
      type: "text",
      id: makeId("trial", 10),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "If your trial ends first, your account simply pauses — nothing is deleted, and you can upgrade any time to pick up right where you left off.",
    },
  ],
});

// A security alert — a new-sign-in / new-device notice, with the event details
// in a detail table and a prominent "secure my account" action if it wasn't
// them. The eyebrow uses the muted color (not success) — this is a caution.
const securityAlert: EmailDocument = EmailDocumentSchema.parse({
  category: "transactional",
  previewText: "New sign-in to your account — was this you?",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "device", type: "string", source: "input" },
    { name: "location", type: "string", source: "input" },
    { name: "sign_in_time", type: "string", source: "input" },
    { name: "secure_url", type: "string", source: "input" },
  ],
  blocks: [
    logo(makeId("sec", 1)),
    { type: "spacer", id: makeId("sec", 2), height: 24 },
    {
      type: "heading",
      id: makeId("sec", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "New sign-in detected",
    },
    {
      type: "text",
      id: makeId("sec", 4),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, we noticed a new sign-in to your account. If this was you, no action is needed.",
    },
    { type: "spacer", id: makeId("sec", 5), height: 20 },
    keyValueRow("sec", 1, [
      { label: "Device", value: "{{device}}" },
      { label: "Location", value: "{{location}}" },
      { label: "Time", value: "{{sign_in_time}}" },
    ]),
    { type: "spacer", id: makeId("sec", 6), height: 24 },
    brandButton(makeId("sec", 7), "Secure my account", "{{secure_url}}"),
    { type: "spacer", id: makeId("sec", 8), height: 16 },
    {
      type: "text",
      id: makeId("sec", 9),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "Don't recognize this? Secure your account above — we'll help you change your password and sign out other sessions.",
    },
  ],
});

// A comment / mention notification — the collaboration workhorse. Shows who
// said what in a quoted callout, then links straight to the thread.
const commentMention: EmailDocument = EmailDocumentSchema.parse({
  category: "transactional",
  previewText: "{{actor_name}} mentioned you in {{context_name}}.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "actor_name", type: "string", source: "input" },
    { name: "context_name", type: "string", source: "input" },
    { name: "comment_body", type: "string", source: "input" },
    { name: "thread_url", type: "string", source: "input" },
  ],
  blocks: [
    logo(makeId("mention", 1)),
    { type: "spacer", id: makeId("mention", 2), height: 24 },
    {
      type: "heading",
      id: makeId("mention", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "{{actor_name}} mentioned you",
    },
    {
      type: "text",
      id: makeId("mention", 4),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, you were mentioned in {{context_name}}.",
    },
    { type: "spacer", id: makeId("mention", 5), height: 20 },
    {
      type: "section",
      id: makeId("mention", 6),
      backgroundColor: BRAND.tint,
      paddingX: 24,
      paddingY: 20,
      border: { radius: 12 },
      children: [
        {
          type: "text",
          id: makeId("mention", 7),
          align: "left",
          fontSize: 16,
          color: BRAND.ink,
          text: "“{{comment_body}}”",
          marginBottom: 6,
        },
        {
          type: "text",
          id: makeId("mention", 8),
          align: "left",
          fontSize: 13,
          color: BRAND.muted,
          text: "— {{actor_name}}",
          marginBottom: 0,
        },
      ],
    },
    { type: "spacer", id: makeId("mention", 9), height: 24 },
    brandButton(makeId("mention", 10), "View the thread", "{{thread_url}}"),
    { type: "spacer", id: makeId("mention", 11), height: 16 },
    {
      type: "text",
      id: makeId("mention", 12),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "Reply directly from the thread to keep the conversation in one place.",
    },
  ],
});

// ---------------------------------------------------------------------------
// Marketing (carry the required unsubscribe + postal-address footer)
// ---------------------------------------------------------------------------

// Marketing sample variables. The compliance footer (unsubscribe line + company
// name/address) is appended by the RENDERER at send time from the workspace's
// managed footer — samples must NOT bake their own footer into the body, or it
// double-renders. `company_name`/`company_address` are declared so the managed
// footer's {{tokens}} resolve; {{unsubscribe_url}} is intentionally NOT declared
// — it's a reserved system token minted per-recipient by the engine (declaring
// it is rejected by VariableSchema). No per-variable defaults: templates just
// declare shape; missing values block the send.
const MARKETING_FOOTER_VARS = [
  { name: "company_name", type: "string" as const, source: "input" as const },
  { name: "company_address", type: "string" as const, source: "input" as const },
];

const newsletter: EmailDocument = EmailDocumentSchema.parse({
  category: "marketing",
  previewText: "This month's highlights, tips, and what's new.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "headline", type: "string", source: "input" },
    { name: "cta_url", type: "string", source: "input" },
    ...MARKETING_FOOTER_VARS,
  ],
  blocks: [
    logo(makeId("news", 1), "{{company_name}}"),
    { type: "spacer", id: makeId("news", 2), height: 24 },
    eyebrow("news", 1, "THE MONTHLY"),
    {
      type: "heading",
      id: makeId("news", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "{{headline}}",
    },
    {
      type: "text",
      id: makeId("news", 4),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, here's a quick roundup of everything worth knowing this month.",
    },
    { type: "spacer", id: makeId("news", 5), height: 24 },
    // A compact three-up strip — the "at a glance" highlights, then the deeper
    // detail below. Built from real columns so it stacks cleanly on mobile.
    featureColumns("news", 1, [
      { title: "Faster", caption: "A quicker dashboard, end to end." },
      { title: "Smarter", caption: "Shortcuts that halve your workflow." },
      { title: "Together", caption: "1,200 of you joined last month." },
    ]),
    { type: "spacer", id: makeId("news", 10), height: 20 },
    {
      type: "divider",
      id: makeId("news", 11),
      color: BRAND.border,
    },
    { type: "spacer", id: makeId("news", 12), height: 20 },
    {
      type: "section",
      id: makeId("news", 6),
      backgroundColor: BRAND.tint,
      paddingX: 28,
      paddingY: 24,
      border: { radius: 12 },
      children: [
        {
          type: "heading",
          id: makeId("news", 13),
          level: 3,
          align: "left",
          color: BRAND.ink,
          text: "Feature spotlight",
          marginBottom: 8,
        },
        {
          type: "text",
          id: makeId("news", 7),
          align: "left",
          fontSize: 15,
          color: BRAND.body,
          text: "We rebuilt the dashboard from the ground up — it now loads in a fraction of the time, and the pages you use most are one tap away.",
          marginBottom: 0,
        },
      ],
    },
    { type: "spacer", id: makeId("news", 8), height: 24 },
    brandButton(makeId("news", 9), "Read the full update", "{{cta_url}}"),
  ],
});

const productAnnouncement: EmailDocument = EmailDocumentSchema.parse({
  category: "marketing",
  previewText: "Introducing {{feature_name}} — now available to everyone.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "feature_name", type: "string", source: "input" },
    { name: "cta_url", type: "string", source: "input" },
    ...MARKETING_FOOTER_VARS,
  ],
  blocks: [
    {
      type: "image",
      id: makeId("ann", 1),
      src: STOCK.launch,
      alt: "{{feature_name}}",
      align: "center",
      borderRadius: 12,
    },
    { type: "spacer", id: makeId("ann", 2), height: 28 },
    {
      type: "text",
      id: makeId("ann", 3),
      align: "center",
      fontSize: 13,
      color: BRAND.muted,
      letterSpacing: 1,
      fontWeight: "600",
      text: "NEW",
    },
    {
      type: "heading",
      id: makeId("ann", 4),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "Say hello to {{feature_name}}",
    },
    {
      type: "text",
      id: makeId("ann", 5),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, we've been working on something we think you'll love. It's live in your account today.",
    },
    { type: "spacer", id: makeId("ann", 6), height: 24 },
    brandButton(makeId("ann", 7), "Try it now", "{{cta_url}}"),
    { type: "spacer", id: makeId("ann", 8), height: 28 },
    {
      type: "divider",
      id: makeId("ann", 9),
      color: BRAND.border,
    },
    { type: "spacer", id: makeId("ann", 10), height: 24 },
    featureColumns("ann", 1, [
      { title: "Instant", caption: "Live in your account right now." },
      { title: "Built in", caption: "No setup — it just works." },
      { title: "For everyone", caption: "On every plan, at no extra cost." },
    ]),
  ],
});

// A single "what we shipped" entry: a small caps eyebrow, a bold title, and one
// line of copy. Built from leaf blocks so it renders identically in the canvas,
// the sent email, and Outlook (no custom HTML). Reused for each July highlight.
function shippedItem(
  prefix: string,
  n: number,
  eyebrow: string,
  title: string,
  body: string,
): SampleBlocksInput {
  return [
    {
      type: "text",
      id: makeId(`${prefix}-item${n}`, 1),
      align: "left",
      fontSize: 12,
      color: BRAND.muted,
      letterSpacing: 1,
      fontWeight: "600",
      text: eyebrow,
    },
    {
      type: "heading",
      id: makeId(`${prefix}-item${n}`, 2),
      level: 3,
      align: "left",
      color: BRAND.ink,
      text: title,
      marginBottom: 8,
    },
    {
      type: "text",
      id: makeId(`${prefix}-item${n}`, 3),
      align: "left",
      fontSize: 15,
      color: BRAND.body,
      text: body,
    },
  ];
}

const julyNewsletter: EmailDocument = EmailDocumentSchema.parse({
  category: "marketing",
  previewText: "What we shipped in July — plus what's next.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "changelog_url", type: "string", source: "input" },
    ...MARKETING_FOOTER_VARS,
  ],
  blocks: [
    logo(makeId("july", 1), "{{company_name}}"),
    { type: "spacer", id: makeId("july", 2), height: 24 },
    {
      type: "text",
      id: makeId("july", 3),
      align: "center",
      fontSize: 13,
      color: BRAND.muted,
      letterSpacing: 1,
      fontWeight: "600",
      text: "JULY · PRODUCT UPDATE",
    },
    {
      type: "heading",
      id: makeId("july", 4),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "Here's what we shipped in July",
    },
    {
      type: "text",
      id: makeId("july", 5),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, it was a busy month. Here are the three biggest things we built for you — all live in your account today.",
    },
    { type: "spacer", id: makeId("july", 6), height: 8 },
    // The "what we shipped" list — each highlight in its own tinted section with
    // a hairline divider between them, composed from leaf blocks.
    {
      type: "section",
      id: makeId("july", 7),
      backgroundColor: BRAND.tint,
      paddingX: 28,
      paddingY: 28,
      border: { radius: 12 },
      children: [
        ...shippedItem(
          "july",
          1,
          "FASTER SENDS",
          "Batch & scheduled sending",
          "Queue a whole segment and pick the exact moment it goes out — with a hard confirmation so nothing ships by accident.",
        ),
        { type: "spacer", id: makeId("july-div", 1), height: 20 },
        { type: "divider", id: makeId("july-div", 2), color: BRAND.border },
        { type: "spacer", id: makeId("july-div", 3), height: 20 },
        ...shippedItem(
          "july",
          2,
          "DELIVERABILITY",
          "Automatic suppression list",
          "Hard bounces and complaints are now suppressed for you automatically, so your sender reputation stays clean without any manual list hygiene.",
        ),
        { type: "spacer", id: makeId("july-div", 4), height: 20 },
        { type: "divider", id: makeId("july-div", 5), color: BRAND.border },
        { type: "spacer", id: makeId("july-div", 6), height: 20 },
        ...shippedItem(
          "july",
          3,
          "TEMPLATES",
          "React & visual editor",
          "Design once in the visual builder or in code — the same document renders pixel-for-pixel across every inbox, Outlook included.",
        ),
      ],
    },
    { type: "spacer", id: makeId("july", 8), height: 28 },
    brandButton(makeId("july", 9), "Read the full changelog", "{{changelog_url}}"),
    { type: "spacer", id: makeId("july", 10), height: 8 },
    {
      type: "text",
      id: makeId("july", 11),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "More coming in August — inbound parsing and topic-level unsubscribes are next up.",
    },
  ],
});

const eventInvite: EmailDocument = EmailDocumentSchema.parse({
  category: "marketing",
  previewText: "You're invited: {{event_name}} on {{event_date}}.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "event_name", type: "string", source: "input" },
    { name: "event_date", type: "string", source: "input" },
    { name: "register_url", type: "string", source: "input" },
    ...MARKETING_FOOTER_VARS,
  ],
  blocks: [
    {
      type: "image",
      id: makeId("event", 1),
      src: STOCK.event,
      alt: "{{event_name}}",
      align: "center",
      borderRadius: 12,
    },
    { type: "spacer", id: makeId("event", 2), height: 28 },
    {
      type: "text",
      id: makeId("event", 3),
      align: "center",
      fontSize: 13,
      color: BRAND.muted,
      letterSpacing: 1,
      fontWeight: "600",
      text: "YOU'RE INVITED",
    },
    {
      type: "heading",
      id: makeId("event", 4),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "{{event_name}}",
    },
    {
      type: "text",
      id: makeId("event", 5),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, join us on {{event_date}} for a live session. Save your spot — seats are limited.",
    },
    { type: "spacer", id: makeId("event", 6), height: 24 },
    brandButton(makeId("event", 7), "Save my spot", "{{register_url}}"),
  ],
});

const discountOffer: EmailDocument = EmailDocumentSchema.parse({
  category: "marketing",
  previewText: "A little something for you — {{discount}} off, this week only.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "discount", type: "string", source: "input" },
    { name: "promo_code", type: "string", source: "input" },
    { name: "shop_url", type: "string", source: "input" },
    ...MARKETING_FOOTER_VARS,
  ],
  blocks: [
    logo(makeId("offer", 1), "{{company_name}}"),
    { type: "spacer", id: makeId("offer", 2), height: 24 },
    {
      type: "heading",
      id: makeId("offer", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "{{discount}} off — just for you",
    },
    {
      type: "text",
      id: makeId("offer", 4),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, thanks for being with us. Here's a little thank-you — use it before the week is out.",
    },
    { type: "spacer", id: makeId("offer", 5), height: 20 },
    {
      type: "section",
      id: makeId("offer", 6),
      backgroundColor: BRAND.tint,
      paddingX: 28,
      paddingY: 24,
      border: { radius: 12 },
      children: [
        {
          type: "text",
          id: makeId("offer", 7),
          align: "center",
          fontSize: 13,
          color: BRAND.muted,
          letterSpacing: 1,
          fontWeight: "600",
          text: "YOUR CODE",
          marginBottom: 8,
        },
        {
          type: "heading",
          id: makeId("offer", 8),
          level: 2,
          align: "center",
          color: BRAND.ink,
          letterSpacing: 3,
          text: "{{promo_code}}",
          marginBottom: 0,
        },
      ],
    },
    { type: "spacer", id: makeId("offer", 9), height: 24 },
    brandButton(makeId("offer", 10), "Shop now", "{{shop_url}}"),
  ],
});

const reEngagement: EmailDocument = EmailDocumentSchema.parse({
  category: "marketing",
  previewText: "We miss you, {{first_name}} — here's what's new.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "product_name", type: "string", source: "input" },
    { name: "return_url", type: "string", source: "input" },
    ...MARKETING_FOOTER_VARS,
  ],
  blocks: [
    logo(makeId("reeng", 1), "{{company_name}}"),
    { type: "spacer", id: makeId("reeng", 2), height: 24 },
    {
      type: "heading",
      id: makeId("reeng", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "We miss you, {{first_name}}",
    },
    {
      type: "text",
      id: makeId("reeng", 4),
      align: "center",
      color: BRAND.body,
      text: "It's been a while. We've shipped a lot since you last stopped by {{product_name}} — come see what's new.",
    },
    { type: "spacer", id: makeId("reeng", 5), height: 16 },
    {
      type: "section",
      id: makeId("reeng", 6),
      backgroundColor: BRAND.tint,
      paddingX: 28,
      paddingY: 24,
      border: { radius: 12 },
      children: [
        {
          type: "markdown",
          id: makeId("reeng", 7),
          fontSize: 15,
          color: BRAND.body,
          markdown:
            "**Faster than ever** — the whole experience got a speed pass.\n\n**New integrations** — connect the tools you already use.\n\n**Simpler workflows** — fewer clicks to get things done.",
        },
      ],
    },
    { type: "spacer", id: makeId("reeng", 8), height: 24 },
    ctaBand(
      "reeng",
      1,
      "Pick up where you left off",
      "Your account and data are exactly as you left them.",
      "Take another look",
      "{{return_url}}",
    ),
    { type: "spacer", id: makeId("reeng", 10), height: 12 },
    {
      type: "text",
      id: makeId("reeng", 11),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "Not for you anymore? No hard feelings — you can unsubscribe below.",
    },
  ],
});

const feedbackSurvey: EmailDocument = EmailDocumentSchema.parse({
  category: "marketing",
  previewText: "Got a minute? Tell us how we're doing.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "product_name", type: "string", source: "input" },
    { name: "survey_url", type: "string", source: "input" },
    ...MARKETING_FOOTER_VARS,
  ],
  blocks: [
    logo(makeId("survey", 1), "{{company_name}}"),
    { type: "spacer", id: makeId("survey", 2), height: 24 },
    {
      type: "heading",
      id: makeId("survey", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "How are we doing?",
    },
    {
      type: "text",
      id: makeId("survey", 4),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, we're always trying to make {{product_name}} better. A quick two-minute survey would mean a lot — and it genuinely shapes what we build next.",
    },
    { type: "spacer", id: makeId("survey", 5), height: 24 },
    brandButton(makeId("survey", 6), "Share your feedback", "{{survey_url}}"),
    { type: "spacer", id: makeId("survey", 7), height: 16 },
    {
      type: "text",
      id: makeId("survey", 8),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "Thanks for helping us improve. Every response is read by a real person on the team.",
    },
  ],
});

// A waitlist "you're in" invite — the anticipation-builder. Eyebrow, a warm
// headline, and a CTA band to claim the spot, closed with a scarcity line.
const waitlistInvite: EmailDocument = EmailDocumentSchema.parse({
  category: "marketing",
  previewText: "You're off the waitlist — your spot is ready.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "product_name", type: "string", source: "input" },
    { name: "claim_url", type: "string", source: "input" },
    ...MARKETING_FOOTER_VARS,
  ],
  blocks: [
    logo(makeId("wait", 1), "{{company_name}}"),
    { type: "spacer", id: makeId("wait", 2), height: 24 },
    eyebrow("wait", 1, "YOU'RE IN"),
    {
      type: "heading",
      id: makeId("wait", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "Your spot is ready, {{first_name}}",
    },
    {
      type: "text",
      id: makeId("wait", 4),
      align: "center",
      color: BRAND.body,
      text: "Thanks for waiting. {{product_name}} is ready for you — claim your spot and jump straight in.",
    },
    { type: "spacer", id: makeId("wait", 5), height: 24 },
    ctaBand(
      "wait",
      1,
      "Claim your early-access spot",
      "It's reserved for you — no code needed.",
      "Get started",
      "{{claim_url}}",
    ),
    { type: "spacer", id: makeId("wait", 6), height: 12 },
    {
      type: "text",
      id: makeId("wait", 7),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "Spots are released in small batches, so we'd grab yours in the next few days.",
    },
  ],
});

// An abandoned-cart nudge — a gentle reminder of a left-behind item with a
// quick-facts strip and a return-to-cart CTA.
const abandonedCart: EmailDocument = EmailDocumentSchema.parse({
  category: "marketing",
  previewText: "You left something behind — it's still in your cart.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "item_name", type: "string", source: "input" },
    { name: "cart_url", type: "string", source: "input" },
    ...MARKETING_FOOTER_VARS,
  ],
  blocks: [
    logo(makeId("cart", 1), "{{company_name}}"),
    { type: "spacer", id: makeId("cart", 2), height: 24 },
    {
      type: "heading",
      id: makeId("cart", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "You left something behind",
    },
    {
      type: "text",
      id: makeId("cart", 4),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, {{item_name}} is still in your cart. We saved it for you — pick up right where you left off.",
    },
    { type: "spacer", id: makeId("cart", 5), height: 24 },
    featureColumns("cart", 1, [
      { title: "Free returns", caption: "30 days, no questions asked." },
      { title: "Fast shipping", caption: "Out the door in 24 hours." },
      { title: "Secure checkout", caption: "Encrypted end to end." },
    ]),
    { type: "spacer", id: makeId("cart", 6), height: 24 },
    brandButton(makeId("cart", 7), "Return to your cart", "{{cart_url}}"),
    { type: "spacer", id: makeId("cart", 8), height: 12 },
    {
      type: "text",
      id: makeId("cart", 9),
      align: "center",
      fontSize: 14,
      color: BRAND.muted,
      text: "Carts don't hold forever — popular items can sell out.",
    },
  ],
});

// A customer case-study / social-proof send — a quote callout, a results strip,
// and a read-the-story CTA. The most "trust-building" marketing template.
const caseStudy: EmailDocument = EmailDocumentSchema.parse({
  category: "marketing",
  previewText: "How {{customer_name}} got results with {{product_name}}.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "product_name", type: "string", source: "input" },
    { name: "customer_name", type: "string", source: "input" },
    { name: "story_url", type: "string", source: "input" },
    ...MARKETING_FOOTER_VARS,
  ],
  blocks: [
    logo(makeId("case", 1), "{{company_name}}"),
    { type: "spacer", id: makeId("case", 2), height: 24 },
    eyebrow("case", 1, "CUSTOMER STORY"),
    {
      type: "heading",
      id: makeId("case", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "How {{customer_name}} did it",
    },
    {
      type: "text",
      id: makeId("case", 4),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, we sat down with the team at {{customer_name}} to hear how {{product_name}} changed the way they work.",
    },
    { type: "spacer", id: makeId("case", 5), height: 20 },
    {
      type: "section",
      id: makeId("case", 6),
      backgroundColor: BRAND.tint,
      paddingX: 28,
      paddingY: 24,
      border: { radius: 12 },
      children: [
        {
          type: "text",
          id: makeId("case", 7),
          align: "left",
          fontSize: 17,
          color: BRAND.ink,
          text: "“It paid for itself in the first month. We can't imagine going back.”",
          marginBottom: 6,
        },
        {
          type: "text",
          id: makeId("case", 8),
          align: "left",
          fontSize: 13,
          color: BRAND.muted,
          text: "— Head of Growth, {{customer_name}}",
          marginBottom: 0,
        },
      ],
    },
    { type: "spacer", id: makeId("case", 9), height: 20 },
    featureColumns("case", 1, [
      { title: "3×", caption: "Faster turnaround." },
      { title: "40%", caption: "Lower costs." },
      { title: "2 wks", caption: "To full rollout." },
    ]),
    { type: "spacer", id: makeId("case", 10), height: 24 },
    brandButton(makeId("case", 11), "Read the full story", "{{story_url}}"),
  ],
});

// A post-event / webinar recap — thanks-for-joining, a link to the recording,
// and a next-step CTA. The follow-up companion to the event invite.
const webinarRecap: EmailDocument = EmailDocumentSchema.parse({
  category: "marketing",
  previewText: "Thanks for joining — here's the recording.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "event_name", type: "string", source: "input" },
    { name: "recording_url", type: "string", source: "input" },
    { name: "cta_url", type: "string", source: "input" },
    ...MARKETING_FOOTER_VARS,
  ],
  blocks: [
    logo(makeId("recap", 1), "{{company_name}}"),
    { type: "spacer", id: makeId("recap", 2), height: 24 },
    eyebrow("recap", 1, "THANKS FOR JOINING"),
    {
      type: "heading",
      id: makeId("recap", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "The {{event_name}} recording is ready",
    },
    {
      type: "text",
      id: makeId("recap", 4),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, thanks for coming to {{event_name}}. Missed a moment — or want to share it with a colleague? The full recording is up.",
    },
    { type: "spacer", id: makeId("recap", 5), height: 24 },
    brandButton(makeId("recap", 6), "Watch the recording", "{{recording_url}}"),
    { type: "spacer", id: makeId("recap", 7), height: 28 },
    {
      type: "divider",
      id: makeId("recap", 8),
      color: BRAND.border,
    },
    { type: "spacer", id: makeId("recap", 9), height: 20 },
    {
      type: "text",
      id: makeId("recap", 10),
      align: "center",
      color: BRAND.body,
      text: "Ready to put it into practice? Here's the best next step.",
    },
    { type: "spacer", id: makeId("recap", 11), height: 16 },
    brandButton(makeId("recap", 12), "Get started", "{{cta_url}}"),
  ],
});

// A referral / invite-a-friend send — a warm ask backed by a clear incentive in
// a tinted callout, with a share CTA. The growth-loop template.
const referral: EmailDocument = EmailDocumentSchema.parse({
  category: "marketing",
  previewText: "Give {{reward}}, get {{reward}} — invite a friend.",
  theme: BRAND_THEME,
  variables: [
    { name: "first_name", type: "string", source: "contact", contactField: "first_name" },
    { name: "product_name", type: "string", source: "input" },
    { name: "reward", type: "string", source: "input" },
    { name: "referral_url", type: "string", source: "input" },
    ...MARKETING_FOOTER_VARS,
  ],
  blocks: [
    logo(makeId("ref", 1), "{{company_name}}"),
    { type: "spacer", id: makeId("ref", 2), height: 24 },
    {
      type: "heading",
      id: makeId("ref", 3),
      level: 1,
      align: "center",
      color: BRAND.ink,
      text: "Give {{reward}}, get {{reward}}",
    },
    {
      type: "text",
      id: makeId("ref", 4),
      align: "center",
      color: BRAND.body,
      text: "Hi {{first_name}}, love using {{product_name}}? Share it with a friend — when they join, you both get {{reward}}.",
    },
    { type: "spacer", id: makeId("ref", 5), height: 20 },
    {
      type: "section",
      id: makeId("ref", 6),
      backgroundColor: BRAND.tint,
      paddingX: 28,
      paddingY: 24,
      border: { radius: 12 },
      children: [
        {
          type: "text",
          id: makeId("ref", 7),
          align: "center",
          fontSize: 13,
          color: BRAND.muted,
          letterSpacing: 1,
          fontWeight: "600",
          text: "THE DEAL",
          marginBottom: 8,
        },
        {
          type: "heading",
          id: makeId("ref", 8),
          level: 2,
          align: "center",
          color: BRAND.ink,
          text: "{{reward}} for you, {{reward}} for them",
          marginBottom: 0,
        },
      ],
    },
    { type: "spacer", id: makeId("ref", 9), height: 24 },
    brandButton(makeId("ref", 10), "Share your link", "{{referral_url}}"),
  ],
});

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const SAMPLE_TEMPLATES: readonly SampleTemplate[] = [
  { key: "welcome", name: "Welcome", category: "transactional", subject: "Welcome to {{product_name}}!", design: welcome },
  { key: "email-verification", name: "Email verification", category: "transactional", subject: "Confirm your email address", design: emailVerification },
  { key: "magic-link", name: "Magic sign-in link", category: "transactional", subject: "Your sign-in link", design: magicLink },
  { key: "password-reset", name: "Password reset", category: "transactional", subject: "Reset your password", design: passwordReset },
  { key: "receipt", name: "Payment receipt", category: "transactional", subject: "Your receipt from {{company_name}}", design: receipt },
  { key: "invoice", name: "Invoice", category: "transactional", subject: "Invoice {{invoice_number}}", design: invoice },
  { key: "team-invite", name: "Team invitation", category: "transactional", subject: "You've been invited to {{team_name}}", design: teamInvite },
  { key: "shipping-confirmation", name: "Shipping confirmation", category: "transactional", subject: "Your order {{order_number}} has shipped", design: shippingConfirmation },
  { key: "subscription-renewal", name: "Subscription renewal", category: "transactional", subject: "Your {{plan_name}} plan renews soon", design: subscriptionRenewal },
  { key: "trial-ending", name: "Trial ending", category: "transactional", subject: "Your trial ends in {{days_left}} days", design: trialEnding },
  { key: "security-alert", name: "Security alert", category: "transactional", subject: "New sign-in to your account", design: securityAlert },
  { key: "comment-mention", name: "Comment mention", category: "transactional", subject: "{{actor_name}} mentioned you", design: commentMention },
  { key: "newsletter", name: "Newsletter", category: "marketing", subject: "{{headline}}", design: newsletter },
  { key: "july-newsletter", name: "July newsletter", category: "marketing", subject: "What we shipped in July", design: julyNewsletter },
  { key: "product-announcement", name: "Product announcement", category: "marketing", subject: "Introducing {{feature_name}}", design: productAnnouncement },
  { key: "event-invite", name: "Event invite", category: "marketing", subject: "You're invited: {{event_name}}", design: eventInvite },
  { key: "discount-offer", name: "Discount offer", category: "marketing", subject: "{{discount}} off — this week only", design: discountOffer },
  { key: "re-engagement", name: "Re-engagement", category: "marketing", subject: "We miss you", design: reEngagement },
  { key: "feedback-survey", name: "Feedback survey", category: "marketing", subject: "Got a minute? Tell us how we're doing", design: feedbackSurvey },
  { key: "waitlist-invite", name: "Waitlist invite", category: "marketing", subject: "You're off the waitlist", design: waitlistInvite },
  { key: "abandoned-cart", name: "Abandoned cart", category: "marketing", subject: "You left something behind", design: abandonedCart },
  { key: "case-study", name: "Customer story", category: "marketing", subject: "How {{customer_name}} did it", design: caseStudy },
  { key: "webinar-recap", name: "Webinar recap", category: "marketing", subject: "Thanks for joining — here's the recording", design: webinarRecap },
  { key: "referral", name: "Referral invite", category: "marketing", subject: "Give {{reward}}, get {{reward}}", design: referral },
];

export function getSampleTemplate(key: string): SampleTemplate | undefined {
  return SAMPLE_TEMPLATES.find((t) => t.key === key);
}
