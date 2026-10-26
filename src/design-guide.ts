// The email design guide, as data.
//
// ONE SOURCE for "what a good email looks like" across every surface that
// generates one:
//   • packages/email/EMAIL_DESIGN.md — the readable guide (generated:
//     `npm run guide:write -w @unitpost/email`; a test fails on drift),
//   • Unit's AUTHORING prompt (emailDesignPromptSection, agent-core policy.ts),
//   • the design_library tool, topic "guide" (Ask Unit + the MCP server),
//     which also hands out a brand-themed starter email per type,
//   • the published agent skill (SKILL.md points at the tool + the guide).
// The measurable rules are enforced by lintEmailDesign (design-lint.ts).
//
// Distilled from the research in .audit/email-generation-2026-10-24/
// (research-patterns.md, research-technical.md); each recipe lists the
// examples it was drawn from. This is separate from the repo-root DESIGN.md,
// which governs the Unitpost app UI, not the emails our customers send.

import * as bands from "./bands";
import { BAND_GUTTER, brandPalette, type BandBlock, type BandBrand, type BrandPalette } from "./bands";
import { printTsx } from "./codec";
import { EMAIL_ICONS, EMAIL_ICON_VARIANTS, EMAIL_PLACEHOLDERS, emailIconUrl, emailPlaceholderUrl } from "./email-assets";
import { EmailDocumentSchema, FONT_STACKS, type Block, type EmailDocument } from "./schema";

// ------------------------------------------------------------- tokens --

export const EMAIL_DESIGN_TOKENS = {
  contentWidth: 600,
  bodyPadding: 0,
  bodyRadius: 16,
  gutter: BAND_GUTTER,
  bandPaddingY: 28,
  heroPaddingY: "32 (light) / 44 (contrast, gradient)",
  cardBandPaddingY: 16,
  blockGaps: "overline → heading 8 · heading → body 12 · paragraph → paragraph 16 · body → button 24 · rows 20 · last block 0",
  type: {
    h1: "28px / 1.2, weight 700, tracking -0.56 (32px on a contrast hero; 36px for an offer)",
    h2: "22px / 1.3, tracking -0.44 — section titles",
    h3: "16–18px, weight 600 — row and card titles",
    lead: "16px / 1.6 — the line under the H1",
    body: "15px / 1.6 (14px minimum)",
    small: "13px — notes, captions",
    finePrint: "12px — terms, the overline label",
    overline: "12px, weight 600, tracking 0.72, upper case, accent-coloured",
  },
  fontStack: FONT_STACKS[0].value,
  serifStack: "Georgia, 'Times New Roman', Times, serif",
} as const;

// -------------------------------------------------------------- rules --

export type DesignRule = {
  text: string;
  /** In the compact prompt version (the rest live in EMAIL_DESIGN.md and design_library). */
  core?: boolean;
  source?: string;
};
export type DesignRuleSection = { key: string; title: string; rules: DesignRule[] };

export const EMAIL_DESIGN_RULES: readonly DesignRuleSection[] = [
  {
    key: "layout",
    title: "Layout and rhythm",
    rules: [
      { core: true, text: "One column, 600px wide, on a light backdrop. `<Email content-width={600} body-padding={0} body-radius={16}>` and every band brings its own 32px side gutter, so tinted, contrast and gradient bands reach the card's edges." },
      { core: true, text: "Build top to bottom from bands: header → hero → 1–4 content bands → closing action → sign-off. Separate topics with whitespace or a hairline `<Divider>`, not with boxes around everything." },
      { core: true, text: "One email, one job. Everything below the hero supports the single primary action." },
      { core: true, text: "Spacing has ONE source per gap. A band's padding-y is the space around its content: 28 for a content band, 32 for a light hero, 44 for a contrast or gradient hero, 16 around a card band (callout, offer, closing CTA card), 20–24 for the header row. Adjacent paddings add up (28 + 28 = 56 between sections), so never stack a <Spacer> or a margin on padded bands; a <Spacer> is only for space around a <Row> or a padding-y={0} band, which have no outer margin." },
      { core: true, text: "Inside a band, blocks space with margin-bottom: overline → heading 8, heading → body 12, paragraph → paragraph 16, body → button 24, rows 20 apart; inside a card 20–32 padding. The LAST block in a band or card has margin-bottom={0}, or its margin stacks on the padding. Every band keeps its 32px side padding: nothing sits directly in an edge-to-edge card." },
      { text: "Rows (`<Row>`) only for genuinely parallel content: label/value lines, 2–3 stats, two product tiles, icon + text. Side-by-side text columns stack on phones; keep label/value and icon rows `stack-on-mobile={false}`." },
    ],
  },
  {
    key: "type",
    title: "Typography",
    rules: [
      { core: true, text: "Scale: H1 28px (32 on a contrast hero), section H2 22px, row titles 16px semibold, lead 16px, body 15–16px with line-height 1.6, notes 13px, fine print 12px. Nothing under 12px; body never under 14px (iOS enlarges anything below 13px).", source: "https://www.campaignmonitor.com/dev-resources/guides/mobile/" },
      { core: true, text: "One H1 per email, stating the point. Section titles are H2; never skip levels for looks." },
      { core: true, text: "Overline labels (12px, semibold, tracked, upper case, accent colour) name a section in two or three words: NEW, ORDER CONFIRMED, THIS WEEK ONLY." },
      { text: "Left-align anything longer than two lines. Centre only short transactional heroes, codes and single-line CTAs." },
      { core: true, text: "Fonts: the system stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`) is the default. A Brand Kit font goes first in the stack only when it is web-safe (Arial, Helvetica, Georgia, Verdana, Tahoma, Trebuchet MS, Times New Roman); otherwise use the system stack, or the Georgia serif stack for a serif brand. Gmail and every Outlook ignore web fonts, so the email must look intentional in the fallback.", source: "https://www.caniemail.com/features/css-at-font-face/" },
    ],
  },
  {
    key: "colour",
    title: "Colour and contrast",
    rules: [
      { core: true, text: "Neutral base: near-black ink #18181b text on a white card over a #f4f4f5 backdrop, grey #3f3f46 body, #71717a secondary, #e4e4e7 hairlines. Colour is for the primary button, overlines, links, one contrast band and light washes — not for paragraphs." },
      { core: true, text: "Brand accent (Brand Kit ACCENT or the colour the user named) fills the primary button. Its label is white or ink, whichever reads (4.5:1); overlines and links use the accent shaded dark enough to pass 4.5:1 on white. design_library topic=guide with `accent` does this maths for you." },
      { core: true, text: "Use one contrast band per email for weight: a brand or near-black hero, offer card or closing CTA card, with light text and a light button. Two at most." },
      { core: true, text: "Gradients only as a band background with a solid `background-color` (the gradient's first stop) and the gradient as `custom-css=\"background: #4f46e5 linear-gradient(…)\"`, the same solid colour first inside the shorthand (on its own the shorthand clears background-color, and some mail apps then darken white text). Outlook, Outlook.com and Yahoo show only the solid colour, so the text must pass contrast on it.", source: "https://www.caniemail.com/features/css-linear-gradient/" },
      { text: "Never pure #000000 on large areas; near-black inverts more gracefully in dark mode. Hex colours only (6 digits), no rgba().", source: "https://www.litmus.com/blog/background-colors-html-email" },
      { core: true, text: "Email-safe CSS only. Layout comes from Section / Row / Column (tables), never display:flex or grid, position, float, gap, transform, calc(), CSS variables or negative margins — Gmail and Outlook drop them. custom-css is for touches that degrade gracefully: an inline-block pill, border-radius (square in Outlook), a gradient as `background:` over a solid background-color, vertical-align, a fixed px width on a column.", source: "https://www.caniemail.com/" },
    ],
  },
  {
    key: "cta",
    title: "Buttons and links",
    rules: [
      { core: true, text: "One primary button: a verb plus an object (\"Start your trial\", \"View receipt\", \"Get 30% off\"), never \"Click here\". Put it right after the hero copy; repeat the same action once at the end of a long email. Secondary actions are text links (\"Learn more →\")." },
      { core: true, text: "Buttons are pills with 12px × 24px inner padding (about 44px tall) — big enough to tap.", source: "https://www.campaignmonitor.com/dev-resources/guides/mobile/" },
      { core: true, text: "Every link is real: the user's URL, the Brand Kit website / core pages, or a {{variable}} such as {{cta_url}} that the user fills in. Never example.com, never \"#\"." },
    ],
  },
  {
    key: "imagery",
    title: "Images, icons and placeholders",
    rules: [
      { core: true, text: "Image sources: Brand Kit graphics and attached images (`/img/{id}`), our hosted icons and placeholders (design_library topic=assets), or https URLs the user gave. Never invent or guess an image URL." },
      { core: true, text: "No image is better than a fake one. With no brand imagery, carry the email with type, colour and icons: a contrast or gradient hero, an offer card, icon rows, stats. Use a neutral placeholder only where the email needs a picture the user must supply (product tiles, a product screenshot, a speaker photo) — and tell them to swap it before sending." },
      { core: true, text: "Every image gets alt text that says what it shows (a logo's alt is the brand name). Decorative icons next to a text label get alt=\"\". Never put the headline, offer, price or date only inside an image: many inboxes block images by default." },
      { text: "Icons are PNG (Gmail and classic Outlook don't render SVG): the `soft` chip (ink on a light chip) beside text on white, `ink` for small inline markers, `white` on dark or brand bands, `solid` for emphasis. Emoji only inline in copy, at most one per block.", source: "https://www.caniemail.com/features/image-svg/" },
      { text: "Set `width` on every image (536 for a full-width image inside the 32px gutters) so Outlook doesn't render it at its natural size; round photos 10–12px." },
    ],
  },
  {
    key: "dark",
    title: "Dark mode",
    rules: [
      { text: "Design light; make it survive inversion. Gmail iOS and classic Outlook invert everything, Gmail Android and Outlook.com invert light backgrounds, Apple Mail leaves explicit colours alone.", source: "https://www.litmus.com/blog/the-ultimate-guide-to-dark-mode-for-email-marketers" },
      { core: true, text: "Dark mode: set explicit backgrounds, keep text near-black rather than #000, give transparent dark logos a light backing (the soft chip style) or use a logo with its own background, and never bake text into images." },
    ],
  },
  {
    key: "a11y",
    title: "Accessibility",
    rules: [
      { text: "Real headings in order (one H1), real text for anything that matters, descriptive link text, alt on every image, 4.5:1 text contrast (3:1 for 24px+ headings). lintEmailDesign checks the measurable ones on every write.", source: "https://www.w3.org/WAI/WCAG22/quickref/#contrast-minimum" },
    ],
  },
  {
    key: "copy",
    title: "Copy, subject and preview",
    rules: [
      { core: true, text: "Write for skimmers: short paragraphs (1–3 sentences), the most important item first, a heading for every section.", source: "https://www.nngroup.com/articles/e-mail-newsletters-usability/" },
      { core: true, text: "Subject: plain and specific, about 30–50 characters, the key fact first (amount, feature, offer, date). Preview text complements it in one line — the payoff, the deadline or a question — and never repeats it." },
      { core: true, text: "Specific beats generic: name the product, the plan, the amount, the date with its time zone. Never lorem ipsum, never [brackets]." },
      { core: true, text: "Never invent facts: features, numbers, prices, policies, dates, durations, materials, and anything the recipient did come only from the ask, the Brand Kit or a tool result. When a section needs news you weren't given, write it from what the Brand Kit says the product is, or leave the section out. An example line you can't avoid stays free of specifics (no percentages, schedules or materials) and your reply names it as one to replace. Never a made-up price, discount or policy. A newsletter, launch or event the ask gives no content for: ask for it once, offering to draft with examples; examples you then write are listed in your reply for the user to replace." },
      { core: true, text: "Variables sparingly: only what changes per recipient or per send and is supplied then — {{first_name}} from the contact, an order total, a code or a reset link the app passes. Write in what you already know (product, website, plans, the offer, an event's name). A template should read finished in the preview; more than about five custom variables means you left the user work. {{company_name}} fills itself only on campaigns and marketing sends." },
      { core: true, text: "Transactional or marketing decides consent and the footer: marketing email gets the managed unsubscribe / reason / postal-address footer at send, so never write any of it; transactional email has none and needs none. When an ask could be either (a bare welcome, a pricing or policy change, an announcement), ask; when one reading is the common one, decide and say so in one line." },
      { text: "Sign as the team or a named person. Transactional email is neutral and factual; marketing can be warmer. Marketing email never carries a hand-written unsubscribe line or postal address: the managed footer adds them." },
    ],
  },
  {
    key: "mobile",
    title: "Mobile and weight",
    rules: [
      { text: "Single column reads on every phone; keep two-column rows to short, parallel content. Keep the HTML under about 90KB: Gmail clips at about 102KB and hides the rest, including the footer.", source: "https://help.blueshift.com/hc/en-us/articles/42292160006675-Understanding-Gmail-email-clipping" },
    ],
  },
];

// ------------------------------------------------------------ recipes --

export const EMAIL_RECIPE_KEYS = [
  "welcome",
  "receipt",
  "sign-in-code",
  "password-reset",
  "product-launch",
  "newsletter",
  "promo",
  "re-engagement",
  "event-invite",
] as const;
export type EmailRecipeKey = (typeof EMAIL_RECIPE_KEYS)[number];

/** What the starter knows about the sender. Everything is optional: the blank-workspace case is the point. */
export type StarterBrand = {
  /** Brand / product name. Default "{{company_name}}" — a variable the user fills in. */
  name?: string | null;
  /** Logo: `/img/{id}` from Brand Kit graphics, or an https URL. Without it the header is a wordmark. */
  logo?: string | null;
  /** Brand accent hex (Brand Kit ACCENT, or the colour the user asked for). */
  accent?: string | null;
  /** Brand website: used for links instead of {{variables}}. */
  website?: string | null;
  /** Brand Kit font name; used only when web-safe (see the typography rules). */
  font?: string | null;
};

type BuildCtx = { p: BrandPalette; brand: BandBrand; link: (path: string, variable: string) => string; now: Date };
type Built = { subject: string; previewText: string; blocks: BandBlock[] };

export type EmailRecipe = {
  key: EmailRecipeKey;
  name: string;
  category: "transactional" | "marketing";
  /** Set when the category is a real question for this type: what to ask. */
  categoryQuestion?: string;
  /** Set when the email is built around content only the user has: what to ask for when the ask gives none. */
  contentQuestion?: string;
  /** One line: when this is the right recipe. */
  when: string;
  /** The default section order, top to bottom, in band names (design_library layout keys in brackets). */
  skeleton: readonly string[];
  /** The themed layout bands the starter uses, in order. */
  bands: readonly string[];
  subject: string;
  preview: string;
  copy: readonly string[];
  avoid: readonly string[];
  imagery: string;
  words: readonly [number, number];
  /** Real examples this recipe was distilled from. */
  sources: readonly string[];
  /** Ask words that select this recipe (matchEmailRecipe). */
  match: RegExp;
  build: (ctx: BuildCtx) => Built;
};

const RECIPES: EmailRecipe[] = [
  {
    key: "welcome",
    name: "Welcome / onboarding",
    category: "transactional",
    categoryQuestion: "Is it sent when someone creates an account (transactional) or when they join a newsletter or list (marketing)?",
    when: "Right after sign-up: confirm they're in and get them to the first useful action.",
    skeleton: [
      "Logo or wordmark header [header-brand / header-wordmark]",
      "Headline hero: \"Welcome to {Product}\" + one line of what it does for them + ONE button to the first action [hero-headline]",
      "2–4 next-step rows: icon + bold title + one line, ordered by first value [content-icon-rows]",
      "Sign-off: how to get help (reply / docs) + the team [footer-signoff]",
    ],
    bands: ["header-brand", "hero-headline", "content-icon-rows", "footer-signoff"],
    subject: "Welcome to {Product}",
    preview: "The payoff or a question: \"Here's how to get started in two minutes\"",
    copy: ["55–200 words. Lead with one benefit, then one action.", "Name links by what they open (\"Read the guide\"), not \"Learn more\".", "Warm, second person; sign as the team or a named founder."],
    avoid: ["Feature dumps: 3–4 next steps at most.", "Competing buttons: repeat the same one at the end instead.", "A headline baked into a hero image."],
    imagery: "None needed: logo + icon rows. A product screenshot only if the user has one.",
    words: [55, 200],
    sources: ["https://reallygoodemails.com/emails/welcome-to-linear", "https://reallygoodemails.com/emails/welcome-to-figma", "https://reallygoodemails.com/emails/welcome-to-calendly", "https://knock.app/blog/welcome-email-examples"],
    match: /\b(welcome|onboard(ing)?|sign[- ]?up|signed up|new (user|member|account)|getting started)\b/i,
    build: ({ p, brand, link }) => ({
      subject: `Welcome to ${brand.name}`,
      previewText: "Here's how to get set up in a couple of minutes.",
      blocks: [
        ...bands.headerBrand(p, brand),
        ...bands.heroHeadline(p, {
          title: `Welcome to ${brand.name}, {{first_name}}`,
          lead: "Your account is ready. Here's the fastest way to get your first result.",
          cta: { label: `Open ${brand.name}`, href: link("", "get_started_url") },
        }),
        ...bands.iconRows(p, {
          title: "Your first steps",
          rows: [
            { icon: "settings", title: "Set up your account", line: "Add your details so everything looks like you." },
            { icon: "rocket", title: "Do the first thing", line: "It takes about two minutes and shows you how it works." },
            { icon: "users", title: "Invite your team", line: "Bring the people you work with into one place." },
          ],
        }),
        ...bands.signoff(p, { help: "Questions? Just reply to this email — a real person reads every reply.", signature: `The ${brand.name} team` }),
      ],
    }),
  },
  {
    key: "receipt",
    name: "Receipt / order confirmation / invoice",
    category: "transactional",
    when: "After a payment or order: the facts, the total, what happens next.",
    skeleton: [
      "Logo or wordmark header [header-brand]",
      "Status hero: overline + \"Payment received\" / \"Order confirmed\" + one line with amount, what and when [hero-status]",
      "Summary band: order/invoice number + date, line items, tax, bold total [content-summary]",
      "Fulfilment or next step when there is one (download, tracking, renewal date) + at most one button [text band]",
      "Support line: reply or support address [footer-signoff]",
    ],
    bands: ["header-brand", "hero-status", "content-summary", "footer-signoff"],
    subject: "Your receipt from {Business} — {amount}  /  Order {number} confirmed",
    preview: "The one-line summary: amount, item, date, card ending",
    copy: ["80–240 words, almost all data. One line of thanks at most.", "Absolute dates; card brand + last 4 only.", "Neutral tone; no marketing above the receipt."],
    avoid: ["Upsells above the totals.", "Full card numbers.", "Big hero images.", "A noreply address with no way to ask a question."],
    imagery: "None beyond the logo (product thumbnails only for physical goods).",
    words: [80, 240],
    sources: ["https://reallygoodemails.com/emails/your-receipt-from-simplecast-6500-0050", "https://reallygoodemails.com/emails/spotify-receipt", "https://postmarkapp.com/guides/receipt-and-invoice-email-best-practices", "https://docs.stripe.com/receipts"],
    match: /\b(receipt|invoice|order (confirm|confirmation|placed)|payment (received|confirm|confirmation|successful)|purchase confirm|billing)\b/i,
    build: ({ p, brand, link }) => ({
      subject: `Your receipt from ${brand.name}`,
      previewText: "{{amount}} paid on {{date}}. Your receipt is inside.",
      blocks: [
        ...bands.headerBrand(p, brand),
        ...bands.heroStatus(p, { icon: "circle-check", overline: "Payment received", title: "Thanks for your payment", line: "We've received {{amount}}. Your receipt is below." }),
        ...bands.summary(p, {
          heading: "Receipt",
          meta: "{{date}}",
          lines: [
            { label: "Plan", value: "{{plan_name}}" },
            { label: "Paid with", value: "{{payment_method}}" },
          ],
          total: { label: "Total paid", value: "{{amount}}" },
        }),
        ...bands.buttonBand(p, { cta: { label: "View receipt", href: link("/billing", "receipt_url") }, note: "Keep this email for your records." }),
        ...bands.signoff(p, { help: "Questions about this charge? Reply to this email and we'll help.", signature: `The ${brand.name} team` }),
      ],
    }),
  },
  {
    key: "sign-in-code",
    name: "Sign-in / verification code (OTP)",
    category: "transactional",
    when: "A one-time code the user types in: sign-in, email verification, 2FA.",
    skeleton: [
      "Logo or wordmark header [header-brand]",
      "Short headline hero: \"Your sign-in code\" + who it's for, no button [hero-headline]",
      "Code card: the code at 34px, spaced, selectable, plus how long it lasts [content-code-card]",
      "\"Didn't request this?\" line: safe to ignore, nothing changed [footer-signoff]",
    ],
    bands: ["header-brand", "hero-headline", "content-code-card", "footer-signoff"],
    subject: "{code} is your {Product} code  (the code first)",
    preview: "\"Expires in 10 minutes. Didn't ask for it? Ignore this email.\"",
    copy: ["50–130 words. One job.", "Say who it's for and when it expires; single use.", "Never reveal whether an account exists."],
    avoid: ["Codes in images or split across cells (breaks copy and autofill).", "Promos, social links, more than one action."],
    imagery: "None. The code card is the design.",
    words: [50, 130],
    sources: ["https://reallygoodemails.com/emails/slack-confirmation-code", "https://reallygoodemails.com/emails/sign-in-to-shop", "https://postmarkapp.com/guides/password-reset-email-best-practices"],
    match: /\b(otp|one[- ]time (code|pass(code|word))|verification code|sign[- ]in code|login code|2fa|two[- ]factor|verify (your )?email|confirm(ation)? code|passcode)\b/i,
    build: ({ p, brand }) => ({
      subject: `{{code}} is your ${brand.name} code`,
      previewText: "It expires in 10 minutes. Didn't ask for it? You can ignore this email.",
      blocks: [
        ...bands.headerBrand(p, brand),
        ...bands.heroHeadline(p, { title: "Your sign-in code", lead: `Enter this code to sign in to ${brand.name} as {{email}}.` }).map((b) => ({ ...b, paddingY: 20 })),
        ...bands.codeCard(p, { label: "Your code", code: "{{code}}", note: "Expires in 10 minutes. Use it once." }),
        ...bands.signoff(p, { help: "Didn't try to sign in? You can safely ignore this email — nothing has changed on your account." }),
      ],
    }),
  },
  {
    key: "password-reset",
    name: "Password reset / magic link",
    category: "transactional",
    when: "A link that does one security action: reset a password, sign in by link, confirm an address.",
    skeleton: [
      "Logo or wordmark header [header-brand]",
      "Headline hero naming the action + who it's for + ONE button with the exact verb [hero-headline]",
      "Expiry + single-use note, and the raw link as a fallback [text band]",
      "\"Didn't request this?\" line + support [footer-signoff]",
    ],
    bands: ["header-brand", "hero-headline", "footer-signoff"],
    subject: "Reset your {Product} password  /  Sign in to {Product}",
    preview: "\"This link expires in 1 hour and works once.\"",
    copy: ["50–130 words.", "Name the account email, state the expiry, say nothing has changed yet.", "The button says the action (\"Reset password\"), never \"Click here\"."],
    avoid: ["Passwords in the email.", "Images, promos, a second button."],
    imagery: "None.",
    words: [50, 130],
    sources: ["https://reallygoodemails.com/emails/reset-your-stripe-password", "https://reallygoodemails.com/emails/zapier-password-reset", "https://reallygoodemails.com/emails/sign-in-to-medium", "https://www.descope.com/blog/post/magic-link-email-templates"],
    match: /\b(password|reset|magic link|sign[- ]in link|login link|forgot)\b/i,
    build: ({ p, brand }) => ({
      subject: `Reset your ${brand.name} password`,
      previewText: "This link expires in 1 hour and works once.",
      blocks: [
        ...bands.headerBrand(p, brand),
        ...bands.heroHeadline(p, {
          title: "Reset your password",
          lead: `We got a request to reset the password for {{email}}. Nothing has changed yet.`,
          cta: { label: "Reset password", href: "{{reset_url}}" },
        }),
        ...bands.textBand(p, { paragraphs: ["This link expires in 1 hour and can only be used once."] }).map((b) => ({ ...b, paddingY: 0 })),
        { type: "spacer", id: "", height: 28 },
        ...bands.signoff(p, { help: "Didn't ask to reset your password? Ignore this email and your password stays the same." }),
      ],
    }),
  },
  {
    key: "product-launch",
    name: "Product launch / feature announcement",
    category: "marketing",
    contentQuestion: "What's launching, and what changes for customers? Notes, a link or a paste all work — or I can draft it with example details for you to replace.",
    when: "Something new shipped: what it is, who gets it, how to try it.",
    skeleton: [
      "Logo header with a 'New' label [header-brand]",
      "Contrast or gradient hero: overline \"Introducing\" + the benefit as the headline + who gets it + ONE button [hero-gradient / hero-contrast]",
      "2–4 feature sections or icon rows: benefit first, one line each; a screenshot only if the user has one [content-feature / content-icon-rows]",
      "Availability / pricing / what's next as a callout [content-callout]",
      "Closing CTA card repeating the action [cta-contrast]",
      "Sign-off [footer-signoff]",
    ],
    bands: ["header-brand", "hero-gradient", "content-icon-rows", "content-callout", "cta-contrast", "footer-signoff"],
    subject: "Introducing {Feature}  /  {Feature} is here",
    preview: "The benefit in one line",
    copy: ["30–250 words.", "Show the benefit before the mechanism; one line per feature.", "Say who gets it and when (plans, rollout, beta)."],
    avoid: ["Copy only inside an image.", "Several buttons for different goals.", "A changelog dump — link to the changelog."],
    imagery: "A screenshot or GIF when the user has one; otherwise a contrast/gradient hero and icon rows (never a stock photo standing in for the product).",
    words: [30, 250],
    sources: ["https://reallygoodemails.com/emails/introducing-dropbox-rewind", "https://reallygoodemails.com/emails/meet-the-new-notion-projects", "https://reallygoodemails.com/emails/introducing-dashboards"],
    match: /\b(launch|announc(e|ement|ing)|introduc(e|ing)|new feature|feature (update|release)|release|shipped|now (live|available))\b/i,
    build: ({ p, brand, link }) => ({
      subject: "Introducing {{feature_name}}",
      previewText: "The fastest way yet to get it done — live in your account today.",
      blocks: [
        ...bands.headerBrand(p, brand, { label: "New" }),
        ...bands.heroGradient(p, {
          overline: "Introducing",
          title: "{{feature_name}} is here",
          lead: "One sentence on what it does for you, and who gets it.",
          cta: { label: "Try {{feature_name}}", href: link("", "feature_url") },
        }),
        ...bands.iconRows(p, {
          title: "What you can do with it",
          rows: [
            { icon: "zap", title: "The first benefit", line: "One line on what gets faster or easier." },
            { icon: "sparkles", title: "The second benefit", line: "One line on what's newly possible." },
            { icon: "shield-check", title: "The third benefit", line: "One line on why it's safe to rely on." },
          ],
        }),
        ...bands.callout(p, { overline: "Availability", title: "On every plan, starting today", body: "Say who gets it and when, and anything they need to do to turn it on." }),
        ...bands.ctaContrast(p, { title: "See it for yourself", line: "It takes a minute to try.", cta: { label: "Try {{feature_name}}", href: link("", "feature_url") } }),
        ...bands.signoff(p, { help: "Tell us what you think — reply to this email. We read every reply.", signature: `The ${brand.name} team` }),
      ],
    }),
  },
  {
    key: "newsletter",
    name: "Newsletter / digest / changelog",
    category: "marketing",
    contentQuestion: "What's in this issue? Paste notes or a link — or I can draft it with example stories for you to replace.",
    when: "A periodic round-up: what's new this month, top stories, a usage digest.",
    skeleton: [
      "Brand header with the issue or month as the label [header-brand]",
      "Headline hero: \"What's new in {Month}\" + 1–3 sentences naming the top items, no button [hero-headline]",
      "Optional stats band for a digest [content-stats]",
      "3–5 feature sections, the most important first: overline + H2 + 2–3 lines (+ bullets when there are details) + one text link each, hairlines between [content-feature]",
      "Optional 'coming soon' callout [content-callout]",
      "Sign-off asking for replies [footer-signoff]",
    ],
    bands: ["header-brand", "hero-headline", "content-feature", "content-callout", "footer-signoff"],
    subject: "Name the lead item (or the top two or three), not \"Newsletter #12\"",
    preview: "The other items: \"Plus: …, … and …\"",
    copy: ["One heading per item; title + 1–2 sentences + a verb link.", "Most readers skim: the best item goes first.", "Text links per item, at most one button per issue."],
    avoid: ["One button per item.", "Long sections with no headings.", "Images without alt text."],
    imagery: "One image per major item when the user has them; otherwise none — overlines and section rhythm carry it.",
    words: [150, 500],
    sources: ["https://reallygoodemails.com/emails/release-notes-new-things-to-love-in-figma", "https://reallygoodemails.com/emails/framer-monthly-product-update", "https://reallygoodemails.com/emails/stripe-developer-digest-workbench-is-now-available-to-everyone", "https://www.nngroup.com/articles/e-mail-newsletters-usability/"],
    match: /\b(newsletter|digest|round[- ]?up|changelog|release notes|monthly (update|recap)|weekly (update|recap)|what'?s new|recap|wrapped)\b/i,
    build: ({ p, brand, link, now }) => ({
      // Rewrite with the lead item: the subject should name it (research: "name the lead item").
      subject: `The biggest update, plus two more from ${brand.name}`,
      previewText: "The biggest update, two more, and what's coming next.",
      blocks: [
        ...bands.headerBrand(p, brand, { label: now.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) }),
        ...bands.heroHeadline(p, {
          title: "What's new this month",
          lead: "A sentence or two that names the biggest updates, so a skimmer gets the point here.",
        }),
        { type: "divider", id: "", color: p.border, marginBottom: 0 },
        ...bands.feature(p, {
          overline: "New",
          title: "The biggest update",
          body: "Two or three sentences on what it is and why it matters to the reader.",
          bullets: ["The first detail, in one line.", "The second detail."],
          link: { label: "Read more →", href: link("", "post_url") },
        }),
        { type: "divider", id: "", color: p.border, marginBottom: 0 },
        ...bands.feature(p, {
          overline: "Improved",
          title: "The second update",
          body: "One or two sentences on what changed and who it helps.",
          link: { label: "See how it works →", href: link("", "post_url") },
        }),
        { type: "divider", id: "", color: p.border, marginBottom: 0 },
        ...bands.feature(p, {
          overline: "Fixed",
          title: "The third update",
          body: "One or two sentences on a smaller change readers will notice.",
          link: { label: "Read the changelog →", href: link("", "post_url") },
        }),
        ...bands.callout(p, { overline: "Coming soon", title: "What's next", body: "A line about what's on the way, and how to get early access." }),
        ...bands.signoff(p, { help: "That's it for this month. Reply and tell us what you'd like to see next.", signature: `The ${brand.name} team` }),
      ],
    }),
  },
  {
    key: "promo",
    name: "Promo / sale / discount",
    category: "marketing",
    when: "A time-limited offer: a sale, a discount code, a free month.",
    skeleton: [
      "Logo header [header-brand]",
      "Offer card: overline with the occasion + the offer as a big headline + one line + the code in a pill + a button that carries the offer + terms [content-offer]",
      "2–3 reasons or how-to-redeem rows [content-icon-rows]",
      "Optional product tiles (placeholders until they add photos) [columns-products]",
      "Sign-off [footer-signoff]",
    ],
    bands: ["header-brand", "hero-headline", "content-offer", "content-icon-rows", "footer-signoff"],
    subject: "{Offer} + deadline: \"30% off everything — ends Sunday\"",
    preview: "The deadline or the benefit",
    copy: ["60–200 words. One offer.", "Benefit first, then the number; the button label carries the offer (\"Get 30% off\").", "Real deadlines as absolute dates; terms in small print next to the button."],
    avoid: ["The offer only in an image.", "Fake urgency, vague \"save big\", ALL CAPS paragraphs.", "Several unrelated offers."],
    imagery: "Product photos only when the user has them; a typographic offer on a brand band is the default.",
    words: [60, 200],
    sources: ["https://reallygoodemails.com/emails/final-hours-40-off-headspace-ends-tonight", "https://reallygoodemails.com/emails/duolingo-back-school-family-sale", "https://reallygoodemails.com/emails/last-chance-to-save-40-off-on-grammarly-premium"],
    match: /\b(promo(tion)?|sale|discount|coupon|offer|deal|black friday|cyber monday|% off|percent off|free (month|trial)|limited time)\b/i,
    build: ({ p, brand, link }) => ({
      subject: "{{discount}} off — this week only",
      previewText: "Use {{promo_code}} at checkout before Sunday.",
      blocks: [
        ...bands.headerBrand(p, brand),
        ...bands.heroHeadline(p, { title: "A little thank-you, {{first_name}}", lead: "For this week only, everything is on sale." }).map((b) => ({ ...b, paddingY: 28 })),
        ...bands.offer(p, {
          overline: "This week only",
          title: "{{discount}} off everything",
          line: "Use this code at checkout:",
          code: "{{promo_code}}",
          cta: { label: "Get {{discount}} off", href: link("", "shop_url") },
          terms: "Ends {{end_date}}. One use per customer.",
        }),
        ...bands.iconRows(p, {
          rows: [
            { icon: "tag", title: "On everything", line: "The code works across the whole store." },
            { icon: "truck", title: "Free shipping", line: "On every order this week." },
            { icon: "refresh-cw", title: "Easy returns", line: "Changed your mind? Send it back free." },
          ],
        }),
        ...bands.signoff(p, { help: "Questions about your order? Reply to this email.", signature: `The ${brand.name} team` }),
      ],
    }),
  },
  {
    key: "re-engagement",
    name: "Re-engagement / win-back",
    category: "marketing",
    when: "Someone went quiet: a specific reason to come back, and an easy way out.",
    skeleton: [
      "Logo header [header-brand]",
      "Headline hero naming the gap (\"We miss you, {name}\") + why it's worth coming back, from the Brand Kit + ONE button [hero-headline]",
      "2–3 'new since you left' rows ONLY with news the user gave; otherwise an invitation to reply with what would bring them back, or an incentive callout when they named one [content-callout / content-icon-rows]",
      "Sign-off: a reply-to-us help line and the team [footer-signoff]. No opt-down or unsubscribe line in the body: the managed footer carries unsubscribe and preferences",
    ],
    bands: ["header-brand", "hero-headline", "content-callout", "footer-signoff"],
    subject: "Personal: \"{first_name}, we miss you\" (or what changed, when the user named news)",
    preview: "The hook: the brand's promise, the incentive, or news the user gave",
    copy: ["35–200 words. One ask.", "Reassure without promising what you don't know: \"whenever you're ready\", not claims about their saved data or new features.", "\"We miss you\" beats \"We want you back\"; state incentives as amounts."],
    avoid: ["Guilt that reads as hostile.", "A feature tour.", "Image-only layouts."],
    imagery: "Optional; icon rows for what's new.",
    words: [35, 200],
    sources: ["https://reallygoodemails.com/emails/your-slack-workspace-misses-you-smiles-davis", "https://reallygoodemails.com/emails/you-made-duo-sad", "https://reallygoodemails.com/emails/your-zapier-trial-has-ended", "https://experienceleague.adobe.com/en/docs/deliverability-learn/deliverability-best-practice-guide/additional-resources/generic-resources/re-engagement"],
    match: /\b(re-?engag(e|ement)|win[- ]?back|we miss you|come back|lapsed|inactive|dormant|haven'?t seen you)\b/i,
    build: ({ p, brand, link }) => ({
      subject: "{{first_name}}, we miss you",
      previewText: "Whenever you're ready, we'd love to have you back.",
      blocks: [
        ...bands.headerBrand(p, brand),
        ...bands.heroHeadline(p, {
          title: "We miss you, {{first_name}}",
          lead: `It's been a while since we've seen you at ${brand.name}. Whenever you're ready, we'd love to have you back.`,
          cta: { label: "Pick up where you left off", href: link("", "app_url") },
        }),
        ...bands.callout(p, {
          overline: "One question",
          title: "What would bring you back?",
          body: "Hit reply and tell us. A person on our team reads every answer, and it shapes what we work on next.",
        }),
        ...bands.signoff(p, { help: "Thanks for the time you spent with us.", signature: `The ${brand.name} team` }),
      ],
    }),
  },
  {
    key: "event-invite",
    name: "Event invite / webinar",
    category: "marketing",
    contentQuestion: "What will it cover, and how long is it? I'll leave the date, time and sign-up link as fields — or I can draft it with an example agenda for you to replace.",
    when: "An invitation, save-the-date or registration confirmation for an online or in-person event.",
    skeleton: [
      "Logo header with the format as the label (\"Live webinar\") [header-brand]",
      "Contrast hero: overline with format + date, the event name as the headline, why attend, ONE button (Register / Save my spot) [hero-contrast]",
      "Event details: date, time with time zone, place or 'Online', price [content-event]",
      "What you'll learn: 3–4 bullets; speakers as name + role when known [content-feature]",
      "Can't make it? Recording line [footer-signoff]",
    ],
    bands: ["header-brand", "hero-contrast", "content-event", "content-feature", "footer-signoff"],
    subject: "You're invited: {Event} on {date}",
    preview: "Format, length and cost: \"Free, online, 45 minutes\"",
    copy: ["80–250 words (under 120 for a confirmation).", "Absolute date + time + time zone, always live text.", "Say the format, cost and length up front."],
    avoid: ["The date only in an image.", "\"Tomorrow\" without a date; no time zone.", "Long speaker bios."],
    imagery: "Optional speaker photos (placeholders until supplied); the contrast hero and the details rows carry it.",
    words: [80, 250],
    sources: ["https://reallygoodemails.com/emails/save-the-date-for-webflow-conf-2023", "https://reallygoodemails.com/emails/youre-invited-to-asanas-virtual-workshops", "https://reallygoodemails.com/emails/you-are-registered-building-products-on-claude-opus-46"],
    match: /\b(event|webinar|invite|invitation|rsvp|save the date|conference|meetup|workshop|livestream|register for)\b/i,
    build: ({ p, brand, link }) => ({
      subject: "You're invited: {{event_name}} on {{event_date}}",
      previewText: "Free, online, 45 minutes — save your spot.",
      blocks: [
        ...bands.headerBrand(p, brand, { label: "Live webinar" }),
        ...bands.heroContrast(p, {
          overline: "Live webinar · {{event_date}}",
          title: "{{event_name}}",
          lead: "One sentence on what attendees will walk away with.",
          cta: { label: "Save my spot", href: link("", "register_url") },
        }),
        ...bands.eventDetails(p, {
          title: "The details",
          rows: [
            { icon: "calendar", label: "When", value: "{{event_date}}, 45 minutes" },
            { icon: "video", label: "Where", value: "Online — free. We'll send the link when you register." },
          ],
          link: { label: "Register now →", href: link("", "register_url") },
        }),
        ...bands.feature(p, {
          overline: "Agenda",
          title: "What you'll learn",
          body: "Three things you can use the same day.",
          bullets: ["The first takeaway.", "The second takeaway.", "Live Q&A at the end."],
        }),
        ...bands.signoff(p, { help: "Can't make it? Register anyway and we'll send you the recording.", signature: `The ${brand.name} team` }),
      ],
    }),
  },
];

export const EMAIL_RECIPES: readonly EmailRecipe[] = RECIPES;

export function getEmailRecipe(key: string): EmailRecipe | undefined {
  const k = key.trim().toLowerCase();
  return RECIPES.find((r) => r.key === k) ?? RECIPES.find((r) => r.match.test(k));
}

/** The recipe an ask most likely wants ("make a welcome email" → welcome), or null. Order matters: specific types first. */
export function matchEmailRecipe(ask: string): EmailRecipe | null {
  const order: EmailRecipeKey[] = ["sign-in-code", "password-reset", "receipt", "event-invite", "promo", "re-engagement", "newsletter", "product-launch", "welcome"];
  for (const key of order) {
    const r = RECIPES.find((x) => x.key === key)!;
    if (r.match.test(ask)) return r;
  }
  return null;
}

// ------------------------------------------------------------ starter --

const WEB_SAFE_FONTS = ["arial", "helvetica", "georgia", "verdana", "tahoma", "trebuchet ms", "times new roman"];
const SERIF_HINT = /serif|georgia|times|garamond|playfair|merriweather|lora|baskerville|caslon|didot|bodoni|serif pro|crimson|libre/i;

/** The theme font stack for a Brand Kit font name (see the typography rules). */
export function emailFontStack(font?: string | null): string {
  const f = font?.trim();
  if (!f) return EMAIL_DESIGN_TOKENS.fontStack;
  const lower = f.toLowerCase().replace(/['"]/g, "");
  const serif = SERIF_HINT.test(lower) && !/sans/.test(lower);
  const base = serif ? EMAIL_DESIGN_TOKENS.serifStack : EMAIL_DESIGN_TOKENS.fontStack;
  if (!WEB_SAFE_FONTS.includes(lower)) return base;
  const quoted = /\s/.test(f) ? `'${f.replace(/['"]/g, "")}'` : f;
  return base.toLowerCase().startsWith(lower) ? base : `${quoted}, ${base}`;
}

function linkFor(website: string | null | undefined): BuildCtx["link"] {
  const site = website?.trim().replace(/\/+$/, "");
  const ok = site && /^https:\/\/[^\s/]+\.[^\s/]+/i.test(site);
  return (path, variable) => (ok ? `${site}${path}` : `{{${variable}}}`);
}

export type RecipeStarter = {
  recipe: EmailRecipe;
  subject: string;
  previewText: string;
  document: EmailDocument;
  /** The whole email inside its <Email> element: ready for email_templates_set_design / email_templates_create `tsx`. */
  tsx: string;
};

/**
 * A complete, brand-themed starting email for a recipe. With no brand at all
 * it is a finished neutral email with {{variables}} for anything only the
 * user knows; with a Brand Kit (accent, logo, name, website, font) it is the
 * same email in their colours and voice-neutral copy, ready to adapt.
 */
export function recipeStarter(key: EmailRecipeKey | string, brand: StarterBrand = {}, now: Date = new Date()): RecipeStarter | null {
  const recipe = getEmailRecipe(key);
  if (!recipe) return null;
  const p = brandPalette({ accent: brand.accent });
  const bandBrand: BandBrand = { name: brand.name?.trim() || "{{company_name}}", logo: brand.logo?.trim() || null };
  const built = recipe.build({ p, brand: bandBrand, link: linkFor(brand.website), now });
  const document = EmailDocumentSchema.parse({
    compositionMode: "designed",
    category: recipe.category,
    previewText: built.previewText,
    theme: {
      fontFamily: emailFontStack(brand.font),
      textColor: p.ink,
      backgroundColor: p.page,
      bodyColor: p.surface,
      linkColor: p.accentText,
      contentWidth: EMAIL_DESIGN_TOKENS.contentWidth,
      bodyPadding: EMAIL_DESIGN_TOKENS.bodyPadding,
      bodyRadius: EMAIL_DESIGN_TOKENS.bodyRadius,
    },
    // Ids are assigned fresh by the TSX parser; the starter's are throwaway.
    blocks: withIds(built.blocks) as unknown as Block[],
  });
  return { recipe, subject: built.subject, previewText: built.previewText, document, tsx: printTsx(document, { document: true, meta: true }) };
}

let starterId = 0;
function withIds(blocks: BandBlock[]): BandBlock[] {
  return blocks.map((b) => {
    const out: BandBlock = { ...b, id: b.id || `starter-${++starterId}` };
    if (Array.isArray(b.children)) out.children = withIds(b.children as BandBlock[]);
    if (Array.isArray(b.columns)) out.columns = withIds(b.columns as BandBlock[]);
    return out;
  });
}

// --------------------------------------------------------- generators --

/**
 * The compact style section of Unit's AUTHORING prompt: the core rules plus a
 * one-line recipe index. The full recipes and starters are one design_library
 * call away, so the prompt stays small.
 */
export function emailDesignPromptSection(): string {
  const rules = EMAIL_DESIGN_RULES.flatMap((s) => s.rules.filter((r) => r.core).map((r) => `• ${r.text.replace(/`/g, "")}`));
  const recipes = RECIPES.map((r) => `${r.key} (${r.categoryQuestion ? `${r.category} or marketing — ask: ${r.categoryQuestion}` : r.category}): ${r.bands.join(" → ")}${r.contentQuestion ? " (no content in the ask → ask for it)" : ""}`).join("; ");
  return [
    "EMAIL DESIGN GUIDE — DESIGNED EMAILS ONLY (the house style; full guide: design_library topic=\"guide\"). A good email needs no context beyond its type: these rules make a bare ask (\"a welcome email\", \"a receipt\") come out finished and on-brand.",
    ...rules,
    `RECIPES (type → bands; fetch one with design_library topic="guide" key=<type> plus accent / logo / brand / website / font from the Brand Kit to get a complete brand-themed starter email to adapt): ${recipes}.`,
  ].join("\n  ");
}

function mdEscapePipes(s: string): string {
  return s.replace(/\|/g, "\\|");
}

/** EMAIL_DESIGN.md, generated. */
export function emailDesignGuideMarkdown(): string {
  const t = EMAIL_DESIGN_TOKENS;
  const lines: string[] = [];
  lines.push(
    "<!-- Generated from packages/email/src/design-guide.ts — edit that file, then run `npm run guide:write -w @unitpost/email`. -->",
    "",
    "# Email design guide",
    "",
    "How Unitpost builds a good email from a short ask — \"a welcome email\", \"a receipt\", \"a launch announcement\" — with the `@unitpost/email` components, our layout bands and the workspace's Brand Kit. Ask Unit, the MCP server's `design_library` tool and the agent skill all follow it, and `lintEmailDesign()` checks its measurable rules on every write.",
    "",
    "This guide is about the emails our customers send. The Unitpost app's own UI follows the repo-root `DESIGN.md`.",
    "",
    "## Tokens",
    "",
    "| Token | Value |",
    "|---|---|",
    `| Content width | ${t.contentWidth}px card, \`body-padding={${t.bodyPadding}}\`, \`body-radius={${t.bodyRadius}}\` |`,
    `| Side gutter | ${t.gutter}px, carried by every band |`,
    `| Band padding | ${t.bandPaddingY}px top and bottom; heroes ${t.heroPaddingY}; card bands ${t.cardBandPaddingY} — adjacent paddings add up |`,
    `| Block spacing | ${t.blockGaps} |`,
    ...Object.entries(t.type).map(([k, v]) => `| ${k === "finePrint" ? "Fine print" : k.charAt(0).toUpperCase() + k.slice(1)} | ${mdEscapePipes(v)} |`),
    `| Font stack | \`${t.fontStack}\` (serif: \`${t.serifStack}\`) |`,
    "| Neutral palette | ink `#18181b`, body `#3f3f46`, muted `#71717a`, hairline `#e4e4e7`, tint `#fafafa`, backdrop `#f4f4f5`, card `#ffffff` |",
    "",
    "## Rules",
    "",
  );
  for (const s of EMAIL_DESIGN_RULES) {
    lines.push(`### ${s.title}`, "");
    for (const r of s.rules) lines.push(`- ${r.text}${r.source ? ` ([source](${r.source}))` : ""}`);
    lines.push("");
  }
  lines.push(
    "## Recipes",
    "",
    "One per common email type. `design_library` with `topic: \"guide\"` and `key: \"<type>\"` returns the recipe plus a complete starter email in our components; pass `accent`, `logo`, `brand`, `website` and `font` from the Brand Kit and the starter comes back in the brand's colours.",
    "",
  );
  for (const r of RECIPES) {
    lines.push(
      `### ${r.name} — \`${r.key}\``,
      "",
      `${r.when} Category: **${r.category}**${r.categoryQuestion ? ` unless the ask says otherwise — when it doesn't, ask: "${r.categoryQuestion}"` : ""}. Length: ${r.words[0]}–${r.words[1]} words.${r.contentQuestion ? ` Content: when the ask gives none, ask first: "${r.contentQuestion}"` : ""}`,
      "",
      "Skeleton:",
      "",
      ...r.skeleton.map((s, i) => `${i + 1}. ${s}`),
      "",
      `- **Subject:** ${r.subject}`,
      `- **Preview:** ${r.preview}`,
      ...r.copy.map((c) => `- ${c}`),
      `- **Imagery:** ${r.imagery}`,
      `- **Avoid:** ${r.avoid.join(" ")}`,
      `- **Drawn from:** ${r.sources.map((u) => `<${u}>`).join(", ")}`,
      "",
    );
  }
  lines.push(
    "## Assets",
    "",
    "Hosted by Unitpost and safe to use in any email. Icons are Lucide (ISC), rasterised to PNG at 2x.",
    "",
    `- Icons: \`${emailIconUrl("rocket", "soft").replace("rocket-soft", "{name}-{variant}")}\` — variants ${EMAIL_ICON_VARIANTS.map((v) => `\`${v}\``).join(", ")}.`,
    `- Icon names: ${Object.keys(EMAIL_ICONS).map((n) => `\`${n}\``).join(", ")}.`,
    `- Placeholders: ${Object.entries(EMAIL_PLACEHOLDERS).map(([n, v]) => `\`${emailPlaceholderUrl(n as keyof typeof EMAIL_PLACEHOLDERS)}\` (${v.width}×${v.height}, ${v.use})`).join("; ")}. Replace before sending; the lint flags any left in.`,
    "",
  );
  return lines.join("\n");
}
