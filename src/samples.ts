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

// BRAND / DEFAULT_LOGO_URL / BRAND_THEME live in sample-kit.ts (shared with the
// v2 samples) and are re-exported here so existing imports keep working.
import { BRAND, BRAND_THEME, DEFAULT_LOGO_URL, type SampleTemplate } from "./sample-kit";
export { BRAND, BRAND_THEME, DEFAULT_LOGO_URL, type SampleTemplate };
import { TRANSACTIONAL_V2 } from "./samples-transactional-v2";
import { MARKETING_V2 } from "./samples-marketing-v2";
import { NEWSLETTER_REBUILDS, NEWSLETTERS_V2 } from "./samples-newsletters";
import { MARKETING_REBUILDS, MARKETING_V3 } from "./samples-marketing-v3";



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
  // Apparel still-lifes — abandoned cart line items.
  product:
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=400&h=400&q=80",
  jacket:
    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=400&h=400&q=80",
} as const;



// The header mark of the original samples: the sender's name set as a centred
// text wordmark. A template is a starting point for a customer's own brand, so
// it carries a fictional name (or the template's {{product_name}} /
// {{company_name}}) instead of a logo image: there is no image to swap, nothing
// to break when images are blocked, and the author replaces one word. (It used
// to be the Unitpost app mark, which read as our logo in customers' emails.)
function wordmark(id: string, name: string): SampleBlocksInput[number] {
  return {
    type: "text",
    id,
    text: name,
    align: "center",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: BRAND.ink,
    marginBottom: 0,
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
    // Same as `content-key-value`: never stack. A 520–560px iframe (thumbs)
    // is under the renderer's 600px mobile query; stacking dumps every label
    // into one block and every value into another, which is how receipts and
    // shipping summaries fall apart in gallery/marketing previews.
    stackOnMobile: false,
    columns: [
      {
        type: "column",
        id: makeId(`${prefix}-kv${n}-col`, 1),
        width: 48,
        children: lines.map(labelCell),
      },
      {
        type: "column",
        id: makeId(`${prefix}-kv${n}-col`, 2),
        width: 52,
        children: lines.map(valueCell),
      },
    ],
  } as SampleBlocksInput[number];
}

// A compact cart line — thumbnail + name/meta + price. Receipt-like, stays
// side-by-side in thumbs (stackOnMobile off so 640px previews don't collapse).
function cartLine(
  prefix: string,
  n: number,
  item: { src: string; name: string; meta: string; price: string },
): SampleBlocksInput[number] {
  return {
    type: "row",
    id: makeId(`${prefix}-line`, n),
    backgroundColor: BRAND.tint,
    border: { radius: 12 },
    paddingX: 16,
    paddingY: 12,
    columnGap: 12,
    stackOnMobile: false,
    columns: [
      {
        type: "column",
        id: makeId(`${prefix}-line${n}-col`, 1),
        width: 22,
        paddingX: 0,
        children: [
          {
            type: "image",
            id: makeId(`${prefix}-line${n}-img`, 1),
            src: item.src,
            alt: item.name,
            width: 72,
            height: 72,
            borderRadius: 8,
            objectFit: "cover",
            align: "left",
            marginBottom: 0,
          },
        ],
      },
      {
        type: "column",
        id: makeId(`${prefix}-line${n}-col`, 2),
        width: 53,
        paddingX: 0,
        children: [
          {
            type: "text",
            id: makeId(`${prefix}-line${n}-name`, 1),
            fontSize: 15,
            fontWeight: "600",
            color: BRAND.ink,
            text: item.name,
            align: "left",
            marginBottom: 4,
          },
          {
            type: "text",
            id: makeId(`${prefix}-line${n}-meta`, 1),
            fontSize: 13,
            color: BRAND.muted,
            text: item.meta,
            align: "left",
            marginBottom: 0,
          },
        ],
      },
      {
        type: "column",
        id: makeId(`${prefix}-line${n}-col`, 3),
        width: 25,
        paddingX: 0,
        children: [
          {
            type: "text",
            id: makeId(`${prefix}-line${n}-price`, 1),
            align: "right",
            fontSize: 15,
            fontWeight: "600",
            color: BRAND.ink,
            text: item.price,
            marginBottom: 0,
          },
        ],
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

// SampleTemplate is declared in sample-kit.ts (re-exported above).

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
    wordmark(makeId("welcome", 1), "{{product_name}}"),
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
    wordmark(makeId("reset", 1), "Northwind"),
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
    wordmark(makeId("verify", 1), "Northwind"),
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
    wordmark(makeId("magic", 1), "Northwind"),
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
    wordmark(makeId("receipt", 1), "Lumen"),
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
      { label: "Additional seats × 3", value: "$27.00" },
      { label: "Tax", value: "$8.00" },
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
    wordmark(makeId("inv", 1), "Northwind"),
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
    wordmark(makeId("invite", 1), "Northwind"),
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
    wordmark(makeId("ship", 1), "Alder & Finch"),
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
    wordmark(makeId("renew", 1), "Northwind"),
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
    wordmark(makeId("trial", 1), "{{product_name}}"),
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
    wordmark(makeId("sec", 1), "Northwind"),
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
    wordmark(makeId("mention", 1), "Northwind"),
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

// A waitlist "you're in" invite — the anticipation-builder. Eyebrow, a warm
// headline, and a CTA band to claim the spot, closed with a scarcity line.
// An abandoned-cart nudge — a compact receipt of left-behind items (thumb +
// name + price) and a return-to-cart CTA.
// A customer case-study / social-proof send — a quote callout, a results strip,
// and a read-the-story CTA. The most "trust-building" marketing template.
// A post-event / webinar recap — thanks-for-joining, a link to the recording,
// and a next-step CTA. The follow-up companion to the event invite.
// A referral / invite-a-friend send — a warm ask backed by a clear incentive in
// a tinted callout, with a share CTA. The growth-loop template.
// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

// Demo values for the original samples' {{variables}} — see SampleTemplate.
// sampleValues. Three fictional brands keep the previews coherent: Northwind
// (software), Alder & Finch (shop), Harbor (the newsletter sender).
const EX = "https://example.com";
const COMPANY = { company_name: "Harbor", company_address: "120 Market St, San Francisco, CA 94103" };
const SAMPLE_VALUES: Record<string, Record<string, string>> = {
  welcome: { first_name: "Ada", product_name: "Northwind", get_started_url: `${EX}/start` },
  "email-verification": { first_name: "Ada", verify_url: `${EX}/verify`, verification_code: "482913" },
  "magic-link": { first_name: "Ada", login_url: `${EX}/login`, expiry_minutes: "15" },
  "password-reset": { first_name: "Ada", reset_url: `${EX}/reset`, expiry_minutes: "60" },
  receipt: { first_name: "Maya", order_number: "#1042", item_name: "Studio plan", amount: "$84.00", receipt_url: `${EX}/receipt` },
  invoice: { first_name: "Ada", invoice_number: "INV-0231", amount_due: "$1,240.00", due_date: "30 Nov 2026", pay_url: `${EX}/pay` },
  "team-invite": { inviter_name: "Jordan Lee", team_name: "Harbor Design", accept_url: `${EX}/invite` },
  "shipping-confirmation": { first_name: "Maya", order_number: "#1042", carrier: "Express Post", tracking_number: "1Z 999 AA1 0123", estimated_delivery: "Thu 12 Nov", track_url: `${EX}/track` },
  "subscription-renewal": { first_name: "Ada", plan_name: "Pro", renewal_amount: "$29.00", renewal_date: "1 Dec 2026", manage_url: `${EX}/billing` },
  "trial-ending": { first_name: "Ada", product_name: "Northwind", days_left: "3", upgrade_url: `${EX}/upgrade` },
  "security-alert": { first_name: "Ada", device: "Chrome on macOS", location: "Lisbon, Portugal", sign_in_time: "Today at 09:41", secure_url: `${EX}/security` },
  "comment-mention": { first_name: "Ada", actor_name: "Priya Natarajan", context_name: "Q4 launch plan", comment_body: "Can you take a look at the pricing section before Thursday? I think we're underselling the free plan.", thread_url: `${EX}/thread` },
};

type Original = Omit<SampleTemplate, "sampleValues">;
const rebuilt = (key: string): SampleTemplate => {
  const t = [...NEWSLETTER_REBUILDS, ...MARKETING_REBUILDS].find((r) => r.key === key);
  if (!t) throw new Error(`samples: no rebuilt sample "${key}"`);
  return t;
};
const ORIGINAL: readonly (Original | SampleTemplate)[] = [
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
  // Rebuilt in the house style (samples-newsletters.ts, samples-marketing-v3.ts); same keys, same place.
  rebuilt("newsletter"),
  rebuilt("july-newsletter"),
  rebuilt("product-announcement"),
  rebuilt("event-invite"),
  rebuilt("discount-offer"),
  rebuilt("re-engagement"),
  rebuilt("feedback-survey"),
  rebuilt("waitlist-invite"),
  rebuilt("abandoned-cart"),
  rebuilt("case-study"),
  rebuilt("webinar-recap"),
  rebuilt("referral"),
];

// The full registry: the original set first, then the v2 sets. Order here is
// the fallback display order for pickers that don't group; the public gallery
// (apps/web lib/templates/library.ts) curates its own order and grouping.
export const SAMPLE_TEMPLATES: readonly SampleTemplate[] = [
  ...ORIGINAL.map((t) => ("sampleValues" in t ? t : { ...t, sampleValues: SAMPLE_VALUES[t.key] ?? {} })),
  ...TRANSACTIONAL_V2,
  ...MARKETING_V2,
  ...NEWSLETTERS_V2,
  ...MARKETING_V3,
];

export function getSampleTemplate(key: string): SampleTemplate | undefined {
  return SAMPLE_TEMPLATES.find((t) => t.key === key);
}
