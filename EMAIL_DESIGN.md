<!-- Generated from packages/email/src/design-guide.ts — edit that file, then run `npm run guide:write -w @unitpost/email`. -->

# Email design guide

How Unitpost builds a good email from a short ask — "a welcome email", "a receipt", "a launch announcement" — with the `@unitpost/email` components, our layout bands and the workspace's Brand Kit. Ask Unit, the MCP server's `design_library` tool and the agent skill all follow it, and `lintEmailDesign()` checks its measurable rules on every write.

This guide is about the emails our customers send. The Unitpost app's own UI follows the repo-root `DESIGN.md`.

## Tokens

| Token | Value |
|---|---|
| Content width | 600px card, `body-padding={0}`, `body-radius={16}` |
| Side gutter | 32px, carried by every band |
| Band padding | 28px top and bottom; heroes 32 (light) / 44 (contrast, gradient); card bands 16 — adjacent paddings add up |
| Block spacing | overline → heading 8 · heading → body 12 · paragraph → paragraph 16 · body → button 24 · rows 20 · last block 0 |
| H1 | 28px / 1.2, weight 700, tracking -0.56 (32px on a contrast hero; 36px for an offer) |
| H2 | 22px / 1.3, tracking -0.44 — section titles |
| H3 | 16–18px, weight 600 — row and card titles |
| Lead | 16px / 1.6 — the line under the H1 |
| Body | 15px / 1.6 (14px minimum) |
| Small | 13px — notes, captions |
| Fine print | 12px — terms, the overline label |
| Overline | 12px, weight 600, tracking 0.72, upper case, accent-coloured |
| Font stack | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` (serif: `Georgia, 'Times New Roman', Times, serif`) |
| Neutral palette | ink `#18181b`, body `#3f3f46`, muted `#71717a`, hairline `#e4e4e7`, tint `#fafafa`, backdrop `#f4f4f5`, card `#ffffff` |

## Rules

### Layout and rhythm

- One column, 600px wide, on a light backdrop. `<Email content-width={600} body-padding={0} body-radius={16}>` and every band brings its own 32px side gutter, so tinted, contrast and gradient bands reach the card's edges.
- Build top to bottom from bands: header → hero → 1–4 content bands → closing action → sign-off. Separate topics with whitespace or a hairline `<Divider>`, not with boxes around everything.
- One email, one job. Everything below the hero supports the single primary action.
- Spacing has ONE source per gap. A band's padding-y is the space around its content: 28 for a content band, 32 for a light hero, 44 for a contrast or gradient hero, 16 around a card band (callout, offer, closing CTA card), 20–24 for the header row. Adjacent paddings add up (28 + 28 = 56 between sections), so never stack a <Spacer> or a margin on padded bands; a <Spacer> is only for space around a <Row> or a padding-y={0} band, which have no outer margin.
- Inside a band, blocks space with margin-bottom: overline → heading 8, heading → body 12, paragraph → paragraph 16, body → button 24, rows 20 apart; inside a card 20–32 padding. The LAST block in a band or card has margin-bottom={0}, or its margin stacks on the padding. Every band keeps its 32px side padding: nothing sits directly in an edge-to-edge card.
- Rows (`<Row>`) only for genuinely parallel content: label/value lines, 2–3 stats, two product tiles, icon + text. Side-by-side text columns stack on phones; keep label/value and icon rows `stack-on-mobile={false}`.

### Typography

- Scale: H1 28px (32 on a contrast hero), section H2 22px, row titles 16px semibold, lead 16px, body 15–16px with line-height 1.6, notes 13px, fine print 12px. Nothing under 12px; body never under 14px (iOS enlarges anything below 13px). ([source](https://www.campaignmonitor.com/dev-resources/guides/mobile/))
- One H1 per email, stating the point. Section titles are H2; never skip levels for looks.
- Overline labels (12px, semibold, tracked, upper case, accent colour) name a section in two or three words: NEW, ORDER CONFIRMED, THIS WEEK ONLY.
- Left-align anything longer than two lines. Centre only short transactional heroes, codes and single-line CTAs.
- Fonts: the system stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`) is the default. A Brand Kit font goes first in the stack only when it is web-safe (Arial, Helvetica, Georgia, Verdana, Tahoma, Trebuchet MS, Times New Roman); otherwise use the system stack, or the Georgia serif stack for a serif brand. Gmail and every Outlook ignore web fonts, so the email must look intentional in the fallback. ([source](https://www.caniemail.com/features/css-at-font-face/))

### Colour and contrast

- Neutral base: near-black ink #18181b text on a white card over a #f4f4f5 backdrop, grey #3f3f46 body, #71717a secondary, #e4e4e7 hairlines. Colour is for the primary button, overlines, links, one contrast band and light washes — not for paragraphs.
- Brand accent (Brand Kit ACCENT or the colour the user named) fills the primary button. Its label is white or ink, whichever reads (4.5:1); overlines and links use the accent shaded dark enough to pass 4.5:1 on white. design_library topic=guide with `accent` does this maths for you.
- Use one contrast band per email for weight: a brand or near-black hero, offer card or closing CTA card, with light text and a light button. Two at most.
- Gradients only as a band background with a solid `background-color` (the gradient's first stop) and the gradient as `custom-css="background: #4f46e5 linear-gradient(…)"`, the same solid colour first inside the shorthand (on its own the shorthand clears background-color, and some mail apps then darken white text). Outlook, Outlook.com and Yahoo show only the solid colour, so the text must pass contrast on it. ([source](https://www.caniemail.com/features/css-linear-gradient/))
- Never pure #000000 on large areas; near-black inverts more gracefully in dark mode. Hex colours only (6 digits), no rgba(). ([source](https://www.litmus.com/blog/background-colors-html-email))
- Email-safe CSS only. Layout comes from Section / Row / Column (tables), never display:flex or grid, position, float, gap, transform, calc(), CSS variables or negative margins — Gmail and Outlook drop them. custom-css is for touches that degrade gracefully: an inline-block pill, border-radius (square in Outlook), a gradient as `background:` over a solid background-color, vertical-align, a fixed px width on a column. ([source](https://www.caniemail.com/))

### Buttons and links

- One primary button: a verb plus an object ("Start your trial", "View receipt", "Get 30% off"), never "Click here". Put it right after the hero copy; repeat the same action once at the end of a long email. Secondary actions are text links ("Learn more →").
- Buttons are pills with 12px × 24px inner padding (about 44px tall) — big enough to tap. All buttons in one email share one shape and colour: a new one copies the existing ones. ([source](https://www.campaignmonitor.com/dev-resources/guides/mobile/))
- Every link is real: the user's URL, the Brand Kit website / core pages, or a {{variable}} such as {{cta_url}} that the user fills in. Never example.com, never "#".

### Images, icons and placeholders

- Image sources: Brand Kit graphics and attached images (`/img/{id}`), our hosted icons and placeholders (design_library topic=assets), or https URLs the user gave. Never invent or guess an image URL.
- No image is better than a fake one. With no brand imagery, carry the email with type, colour and icons: a contrast or gradient hero, an offer card, icon rows, stats. Use a neutral placeholder only where the email needs a picture the user must supply (product tiles, a product screenshot, a speaker photo) — and tell them to swap it before sending.
- Every image gets alt text that says what it shows (a logo's alt is the brand name). Decorative icons next to a text label get alt="". Never put the headline, offer, price or date only inside an image: many inboxes block images by default.
- Icons are PNG (Gmail and classic Outlook don't render SVG): the `soft` chip (ink on a light chip) beside text on white, `ink` for small inline markers, `white` on dark or brand bands, `solid` for emphasis. Pick by the background the icon sits on, never by habit: an ink icon on a dark band (or a white one on white) disappears. A dark-mode email swaps ink icons on the card to white by itself. Emoji only inline in copy, at most one per block. ([source](https://www.caniemail.com/features/image-svg/))
- Set `width` on every image (536 for a full-width image inside the 32px gutters) so Outlook doesn't render it at its natural size; round photos 10–12px.

### Dark mode

- Design light; make it survive inversion. Gmail iOS and classic Outlook invert everything, Gmail Android and Outlook.com invert light backgrounds, Apple Mail leaves explicit colours alone. ([source](https://www.litmus.com/blog/the-ultimate-guide-to-dark-mode-for-email-marketers))
- Dark mode: set explicit backgrounds, keep text near-black rather than #000, give transparent dark logos a light backing (the soft chip style) or use a logo with its own background, and never bake text into images.

### Accessibility

- Real headings in order (one H1), real text for anything that matters, descriptive link text, alt on every image, 4.5:1 text contrast (3:1 for 24px+ headings). lintEmailDesign checks the measurable ones on every write. ([source](https://www.w3.org/WAI/WCAG22/quickref/#contrast-minimum))

### Copy, subject and preview

- Write for skimmers: short paragraphs (1–3 sentences), the most important item first, a heading for every section. ([source](https://www.nngroup.com/articles/e-mail-newsletters-usability/))
- Subject: plain and specific, about 30–50 characters, the key fact first (amount, feature, offer, date). Preview text complements it in one line — the payoff, the deadline or a question — and never repeats it.
- Specific beats generic: name the product, the plan, the amount, the date with its time zone. Never lorem ipsum, never [brackets].
- Never invent facts: features, numbers, prices, policies, dates, durations, materials, and anything the recipient did come only from the ask, the Brand Kit or a tool result. When a section needs news you weren't given, write it from what the Brand Kit says the product is, or leave the section out. An example line you can't avoid stays free of specifics (no percentages, schedules or materials) and your reply names it as one to replace. Never a made-up price, discount or policy. A newsletter, launch or event the ask gives no content for: ask for it once, offering to draft with examples; examples you then write are listed in your reply for the user to replace.
- Variables sparingly: only what changes per recipient or per send and is supplied then — {{first_name}} from the contact, an order total, a code or a reset link the app passes. Write in what you already know (product, website, plans, the offer, an event's name). A template should read finished in the preview; more than about five custom variables means you left the user work. {{company_name}} fills itself only on campaigns and marketing sends.
- Transactional or marketing decides consent and the footer: marketing email gets the managed unsubscribe / reason / postal-address footer at send, so never write any of it; transactional email has none and needs none. When an ask could be either (a bare welcome, a pricing or policy change, an announcement), ask; when one reading is the common one, decide and say so in one line.
- Sign as the team or a named person. Transactional email is neutral and factual; marketing can be warmer. Marketing email never carries a hand-written unsubscribe line or postal address: the managed footer adds them.

### Mobile and weight

- Single column reads on every phone; keep two-column rows to short, parallel content. Keep the HTML under about 90KB: Gmail clips at about 102KB and hides the rest, including the footer. ([source](https://help.blueshift.com/hc/en-us/articles/42292160006675-Understanding-Gmail-email-clipping))

## Recipes

One per common email type. `design_library` with `topic: "guide"` and `key: "<type>"` returns the recipe plus a complete starter email in our components; pass `accent`, `logo`, `brand`, `website` and `font` from the Brand Kit and the starter comes back in the brand's colours.

### Welcome / onboarding — `welcome`

Right after sign-up: confirm they're in and get them to the first useful action. Category: **transactional** unless the ask says otherwise — when it doesn't, ask: "Is it sent when someone creates an account (transactional) or when they join a newsletter or list (marketing)?". Length: 55–200 words.

Skeleton:

1. Logo or wordmark header [header-brand / header-wordmark]
2. Headline hero: "Welcome to {Product}" + one line of what it does for them + ONE button to the first action [hero-headline]
3. 2–4 next-step rows: icon + bold title + one line, ordered by first value [content-icon-rows]
4. Sign-off: how to get help (reply / docs) + the team [footer-signoff]

- **Subject:** Welcome to {Product}
- **Preview:** The payoff or a question: "Here's how to get started in two minutes"
- 55–200 words. Lead with one benefit, then one action.
- Name links by what they open ("Read the guide"), not "Learn more".
- Warm, second person; sign as the team or a named founder.
- **Imagery:** None needed: logo + icon rows. A product screenshot only if the user has one.
- **Avoid:** Feature dumps: 3–4 next steps at most. Competing buttons: repeat the same one at the end instead. A headline baked into a hero image.
- **Drawn from:** <https://reallygoodemails.com/emails/welcome-to-linear>, <https://reallygoodemails.com/emails/welcome-to-figma>, <https://reallygoodemails.com/emails/welcome-to-calendly>, <https://knock.app/blog/welcome-email-examples>

### Receipt / order confirmation / invoice — `receipt`

After a payment or order: the facts, the total, what happens next. Category: **transactional**. Length: 80–240 words.

Skeleton:

1. Logo or wordmark header [header-brand]
2. Status hero: overline + "Payment received" / "Order confirmed" + one line with amount, what and when [hero-status]
3. Summary band: order/invoice number + date, line items, tax, bold total [content-summary]
4. Fulfilment or next step when there is one (download, tracking, renewal date) + at most one button [text band]
5. Support line: reply or support address [footer-signoff]

- **Subject:** Your receipt from {Business} — {amount}  /  Order {number} confirmed
- **Preview:** The one-line summary: amount, item, date, card ending
- 80–240 words, almost all data. One line of thanks at most.
- Absolute dates; card brand + last 4 only.
- Neutral tone; no marketing above the receipt.
- **Imagery:** None beyond the logo (product thumbnails only for physical goods).
- **Avoid:** Upsells above the totals. Full card numbers. Big hero images. A noreply address with no way to ask a question.
- **Drawn from:** <https://reallygoodemails.com/emails/your-receipt-from-simplecast-6500-0050>, <https://reallygoodemails.com/emails/spotify-receipt>, <https://postmarkapp.com/guides/receipt-and-invoice-email-best-practices>, <https://docs.stripe.com/receipts>

### Sign-in / verification code (OTP) — `sign-in-code`

A one-time code the user types in: sign-in, email verification, 2FA. Category: **transactional**. Length: 50–130 words.

Skeleton:

1. Logo or wordmark header [header-brand]
2. Short headline hero: "Your sign-in code" + who it's for, no button [hero-headline]
3. Code card: the code at 34px, spaced, selectable, plus how long it lasts [content-code-card]
4. "Didn't request this?" line: safe to ignore, nothing changed [footer-signoff]

- **Subject:** {code} is your {Product} code  (the code first)
- **Preview:** "Expires in 10 minutes. Didn't ask for it? Ignore this email."
- 50–130 words. One job.
- Say who it's for and when it expires; single use.
- Never reveal whether an account exists.
- **Imagery:** None. The code card is the design.
- **Avoid:** Codes in images or split across cells (breaks copy and autofill). Promos, social links, more than one action.
- **Drawn from:** <https://reallygoodemails.com/emails/slack-confirmation-code>, <https://reallygoodemails.com/emails/sign-in-to-shop>, <https://postmarkapp.com/guides/password-reset-email-best-practices>

### Password reset / magic link — `password-reset`

A link that does one security action: reset a password, sign in by link, confirm an address. Category: **transactional**. Length: 50–130 words.

Skeleton:

1. Logo or wordmark header [header-brand]
2. Headline hero naming the action + who it's for + ONE button with the exact verb [hero-headline]
3. Expiry + single-use note, and the raw link as a fallback [text band]
4. "Didn't request this?" line + support [footer-signoff]

- **Subject:** Reset your {Product} password  /  Sign in to {Product}
- **Preview:** "This link expires in 1 hour and works once."
- 50–130 words.
- Name the account email, state the expiry, say nothing has changed yet.
- The button says the action ("Reset password"), never "Click here".
- **Imagery:** None.
- **Avoid:** Passwords in the email. Images, promos, a second button.
- **Drawn from:** <https://reallygoodemails.com/emails/reset-your-stripe-password>, <https://reallygoodemails.com/emails/zapier-password-reset>, <https://reallygoodemails.com/emails/sign-in-to-medium>, <https://www.descope.com/blog/post/magic-link-email-templates>

### Product launch / feature announcement — `product-launch`

Something new shipped: what it is, who gets it, how to try it. Category: **marketing**. Length: 30–250 words. Content: when the ask gives none, ask first: "What's launching, and what changes for customers? Notes, a link or a paste all work — or I can draft it with example details for you to replace."

Skeleton:

1. Logo header with a 'New' label [header-brand]
2. Contrast or gradient hero: overline "Introducing" + the benefit as the headline + who gets it + ONE button [hero-gradient / hero-contrast]
3. 2–4 feature sections or icon rows: benefit first, one line each; a screenshot only if the user has one [content-feature / content-icon-rows]
4. Availability / pricing / what's next as a callout [content-callout]
5. Closing CTA card repeating the action [cta-contrast]
6. Sign-off [footer-signoff]

- **Subject:** Introducing {Feature}  /  {Feature} is here
- **Preview:** The benefit in one line
- 30–250 words.
- Show the benefit before the mechanism; one line per feature.
- Say who gets it and when (plans, rollout, beta).
- **Imagery:** A screenshot or GIF when the user has one; otherwise a contrast/gradient hero and icon rows (never a stock photo standing in for the product).
- **Avoid:** Copy only inside an image. Several buttons for different goals. A changelog dump — link to the changelog.
- **Drawn from:** <https://reallygoodemails.com/emails/introducing-dropbox-rewind>, <https://reallygoodemails.com/emails/meet-the-new-notion-projects>, <https://reallygoodemails.com/emails/introducing-dashboards>

### Newsletter / digest / changelog — `newsletter`

A periodic round-up: what's new this month, top stories, a usage digest. Category: **marketing**. Length: 150–500 words. Content: when the ask gives none, ask first: "What's in this issue? Paste notes or a link — or I can draft it with example stories for you to replace."

Skeleton:

1. Brand header with the issue or month as the label [header-brand]
2. Headline hero: "What's new in {Month}" + 1–3 sentences naming the top items, no button [hero-headline]
3. Optional stats band for a digest [content-stats]
4. 3–5 feature sections, the most important first: overline + H2 + 2–3 lines (+ bullets when there are details) + one text link each, hairlines between [content-feature]
5. Optional 'coming soon' callout [content-callout]
6. Sign-off asking for replies [footer-signoff]

- **Subject:** Name the lead item (or the top two or three), not "Newsletter #12"
- **Preview:** The other items: "Plus: …, … and …"
- One heading per item; title + 1–2 sentences + a verb link.
- Most readers skim: the best item goes first.
- Text links per item, at most one button per issue.
- **Imagery:** One image per major item when the user has them; otherwise none — overlines and section rhythm carry it.
- **Avoid:** One button per item. Long sections with no headings. Images without alt text.
- **Drawn from:** <https://reallygoodemails.com/emails/release-notes-new-things-to-love-in-figma>, <https://reallygoodemails.com/emails/framer-monthly-product-update>, <https://reallygoodemails.com/emails/stripe-developer-digest-workbench-is-now-available-to-everyone>, <https://www.nngroup.com/articles/e-mail-newsletters-usability/>

### Promo / sale / discount — `promo`

A time-limited offer: a sale, a discount code, a free month. Category: **marketing**. Length: 60–200 words.

Skeleton:

1. Logo header [header-brand]
2. Offer card: overline with the occasion + the offer as a big headline + one line + the code in a pill + a button that carries the offer + terms [content-offer]
3. 2–3 reasons or how-to-redeem rows [content-icon-rows]
4. Optional product tiles (placeholders until they add photos) [columns-products]
5. Sign-off [footer-signoff]

- **Subject:** {Offer} + deadline: "30% off everything — ends Sunday"
- **Preview:** The deadline or the benefit
- 60–200 words. One offer.
- Benefit first, then the number; the button label carries the offer ("Get 30% off").
- Real deadlines as absolute dates; terms in small print next to the button.
- **Imagery:** Product photos only when the user has them; a typographic offer on a brand band is the default.
- **Avoid:** The offer only in an image. Fake urgency, vague "save big", ALL CAPS paragraphs. Several unrelated offers.
- **Drawn from:** <https://reallygoodemails.com/emails/final-hours-40-off-headspace-ends-tonight>, <https://reallygoodemails.com/emails/duolingo-back-school-family-sale>, <https://reallygoodemails.com/emails/last-chance-to-save-40-off-on-grammarly-premium>

### Re-engagement / win-back — `re-engagement`

Someone went quiet: a specific reason to come back, and an easy way out. Category: **marketing**. Length: 35–200 words.

Skeleton:

1. Logo header [header-brand]
2. Headline hero naming the gap ("We miss you, {name}") + why it's worth coming back, from the Brand Kit + ONE button [hero-headline]
3. 2–3 'new since you left' rows ONLY with news the user gave; otherwise an invitation to reply with what would bring them back, or an incentive callout when they named one [content-callout / content-icon-rows]
4. Sign-off: a reply-to-us help line and the team [footer-signoff]. No opt-down or unsubscribe line in the body: the managed footer carries unsubscribe and preferences

- **Subject:** Personal: "{first_name}, we miss you" (or what changed, when the user named news)
- **Preview:** The hook: the brand's promise, the incentive, or news the user gave
- 35–200 words. One ask.
- Reassure without promising what you don't know: "whenever you're ready", not claims about their saved data or new features.
- "We miss you" beats "We want you back"; state incentives as amounts.
- **Imagery:** Optional; icon rows for what's new.
- **Avoid:** Guilt that reads as hostile. A feature tour. Image-only layouts.
- **Drawn from:** <https://reallygoodemails.com/emails/your-slack-workspace-misses-you-smiles-davis>, <https://reallygoodemails.com/emails/you-made-duo-sad>, <https://reallygoodemails.com/emails/your-zapier-trial-has-ended>, <https://experienceleague.adobe.com/en/docs/deliverability-learn/deliverability-best-practice-guide/additional-resources/generic-resources/re-engagement>

### Event invite / webinar — `event-invite`

An invitation, save-the-date or registration confirmation for an online or in-person event. Category: **marketing**. Length: 80–250 words. Content: when the ask gives none, ask first: "What will it cover, and how long is it? I'll leave the date, time and sign-up link as fields — or I can draft it with an example agenda for you to replace."

Skeleton:

1. Logo header with the format as the label ("Live webinar") [header-brand]
2. Contrast hero: overline with format + date, the event name as the headline, why attend, ONE button (Register / Save my spot) [hero-contrast]
3. Event details: date, time with time zone, place or 'Online', price [content-event]
4. What you'll learn: 3–4 bullets; speakers as name + role when known [content-feature]
5. Can't make it? Recording line [footer-signoff]

- **Subject:** You're invited: {Event} on {date}
- **Preview:** Format, length and cost: "Free, online, 45 minutes"
- 80–250 words (under 120 for a confirmation).
- Absolute date + time + time zone, always live text.
- Say the format, cost and length up front.
- **Imagery:** Optional speaker photos (placeholders until supplied); the contrast hero and the details rows carry it.
- **Avoid:** The date only in an image. "Tomorrow" without a date; no time zone. Long speaker bios.
- **Drawn from:** <https://reallygoodemails.com/emails/save-the-date-for-webflow-conf-2023>, <https://reallygoodemails.com/emails/youre-invited-to-asanas-virtual-workshops>, <https://reallygoodemails.com/emails/you-are-registered-building-products-on-claude-opus-46>

## Assets

Hosted by Unitpost and safe to use in any email. Icons are Lucide (ISC), rasterised to PNG at 2x.

- Icons: `https://www.unitpost.com/email-assets/icons/{name}-{variant}.png` — variants `ink`, `white`, `soft`, `solid`.
- Icon names: `check`, `circle-check`, `sparkles`, `zap`, `rocket`, `gift`, `tag`, `percent`, `badge-percent`, `ticket`, `shopping-bag`, `shopping-cart`, `truck`, `package`, `credit-card`, `receipt`, `calendar`, `calendar-check`, `clock`, `map-pin`, `video`, `users`, `user-plus`, `star`, `heart`, `shield-check`, `lock`, `key-round`, `mail`, `inbox`, `send`, `bell`, `message-circle`, `chart-column`, `trending-up`, `settings`, `book-open`, `lightbulb`, `globe`, `download`, `smartphone`, `refresh-cw`, `party-popper`, `trophy`, `headphones`, `life-buoy`, `arrow-right`, `check-check`, `circle-x`, `circle-alert`, `triangle-alert`, `info`, `circle-help`, `badge-check`, `thumbs-up`, `smile`, `vote`, `award`, `medal`, `crown`, `gem`, `flame`, `coins`, `infinity`, `user`, `user-check`, `contact`, `handshake`, `hand-heart`, `messages-square`, `message-square`, `headset`, `megaphone`, `newspaper`, `mic`, `presentation`, `graduation-cap`, `languages`, `accessibility`, `mail-open`, `mail-check`, `at-sign`, `phone`, `phone-call`, `bell-ring`, `share-2`, `link`, `external-link`, `calendar-days`, `calendar-clock`, `calendar-x`, `hourglass`, `timer`, `alarm-clock`, `repeat`, `rotate-ccw`, `wallet`, `banknote`, `piggy-bank`, `landmark`, `circle-dollar-sign`, `dollar-sign`, `euro`, `trending-down`, `ticket-percent`, `tags`, `store`, `shopping-basket`, `package-check`, `package-open`, `boxes`, `warehouse`, `barcode`, `qr-code`, `file-text`, `file-check`, `clipboard-list`, `list-checks`, `pen-line`, `pencil`, `briefcase`, `building-2`, `house`, `chart-line`, `chart-pie`, `activity`, `target`, `flag`, `bookmark`, `layout-dashboard`, `layers`, `sliders-horizontal`, `puzzle`, `plug`, `code`, `terminal`, `database`, `bot`, `brain`, `wand-sparkles`, `wrench`, `eye`, `eye-off`, `shield`, `lock-open`, `log-in`, `upload`, `cloud-upload`, `laptop`, `monitor`, `camera`, `image`, `circle-play`, `music`, `palette`, `plane`, `luggage`, `hotel`, `car`, `train-front`, `bike`, `map`, `compass`, `mountain`, `utensils`, `coffee`, `wine`, `cake`, `shirt`, `dumbbell`, `heart-pulse`, `stethoscope`, `pill`, `apple`, `paw-print`, `sun`, `moon`, `snowflake`, `tree-pine`, `leaf`, `sprout`, `recycle`, `umbrella`, `battery-charging`.
- Placeholders: `https://www.unitpost.com/email-assets/placeholders/wide.png` (1200×600, hero or feature image (2:1)); `https://www.unitpost.com/email-assets/placeholders/landscape.png` (1200×900, article or product shot (4:3)); `https://www.unitpost.com/email-assets/placeholders/square.png` (800×800, product tile, grid image (1:1)); `https://www.unitpost.com/email-assets/placeholders/avatar.png` (240×240, person: speaker, author, testimonial (circle)). Replace before sending; the lint flags any left in.
