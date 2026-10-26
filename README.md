# @unitpost/email

Email component library that works in Outlook, Gmail, and Apple Mail.

Write emails as React components, turn them into HTML with `render()`, and send them with any provider. MIT licensed. No account or API key needed.

```bash
npm install @unitpost/email zod
```

**[Docs](https://unitpost.com/components)** · **[Playground](https://unitpost.com/playground)** · **[Template gallery](https://unitpost.com/templates/gallery)** · **[npm](https://www.npmjs.com/package/@unitpost/email)**

<p align="center">
  <img src="https://raw.githubusercontent.com/unitpostcom/email/main/docs/examples/welcome.png" width="520" alt="Welcome email rendered by @unitpost/email" />
</p>

## Quickstart

### 1. Install

```bash
npm install @unitpost/email zod
```

React and Next.js apps already have `react`. In a plain Node project, install it too. `zod` is a peer dependency. Node 18 or newer.

### 2. Create an email

An email is a React component made of the library's components. Pass data in as props, like any other component.

```tsx
// emails/welcome.tsx
import { Section, Heading, Text, Button } from "@unitpost/email/react";

export function WelcomeEmail({ name }: { name: string }) {
  return (
    <Section>
      <Heading>Welcome, {name}</Heading>
      <Text>Thanks for signing up. Confirm your email to get started.</Text>
      <Button href="https://example.com/confirm">Confirm email</Button>
    </Section>
  );
}
```

### 3. Render and send

`render()` returns an HTML string, so it works with any provider.

```tsx
import { render } from "@unitpost/email/react";
import { Unitpost } from "unitpost";
import { WelcomeEmail } from "./emails/welcome";

const unitpost = new Unitpost(process.env.UNITPOST_API_KEY);

await unitpost.email.send({
  from: "Acme <hello@acme.com>",
  to: "ada@example.com",
  subject: "Welcome to Acme",
  html: render(<WelcomeEmail name="Ada" />),
});
```

Prefer SMTP? Send the same `html` through the [Unitpost SMTP relay](https://unitpost.com/components#unitpost-smtp). Already on another provider? Pass `html` to it. There are copy-paste examples for [Nodemailer](https://unitpost.com/components#nodemailer), [AWS SES](https://unitpost.com/components#aws-ses), [SendGrid](https://unitpost.com/components#sendgrid), [Postmark](https://unitpost.com/components#postmark), [Mailgun](https://unitpost.com/components#mailgun), [Brevo](https://unitpost.com/components#brevo), [Cloudflare Email Service](https://unitpost.com/components#cloudflare), [AutoSend](https://unitpost.com/components#autosend), and [more](https://unitpost.com/components#integrations).

Using a coding agent? Run `npx skills add unitpostcom/email` and it learns every component and layout.

---

## Rendering

Most apps only need `render()`. The rest are for working without React, or for building editors and tools on top of the library.

| Function | Takes | Returns | Use it when |
| --- | --- | --- | --- |
| `render(<Email />)` | A React element | An HTML string | You write emails in React. Import it from `@unitpost/email/react`. |
| `parseTsx(source)` | The same tags, as a string | An `EmailDocument` (JSON) | You don't use React, or the markup comes from the editor or an agent. |
| `renderToHtml(doc)` | An `EmailDocument` | An HTML string | You have a document from `parseTsx()`, `fromJsx()` or the API. |
| `renderToText(doc)` | An `EmailDocument` | A plain-text string | You want a plain-text part to send with the HTML. |
| `fromJsx(<Email />)` | A React element | An `EmailDocument` (JSON) | You want to store an email as data, or turn it into plain text. |
| `printTsx(doc)` | An `EmailDocument` | Source code, as a string | You want to show a document as code. `printFragmentTsx()` does the same for a layout. |

`render()` is `fromJsx()` followed by `renderToHtml()`, and it's synchronous. It runs wherever your code runs: a server, a script, a serverless function. It doesn't use React DOM, so email components can't be mounted on a web page.

**Variables.** `render()` and `renderToHtml()` take an optional second argument that fills `{{tokens}}`. In JSX, write a token as a string, like `{"{{first_name}}"}` or `href="{{cta_url}}"`. Values are HTML-escaped, `javascript:` URLs are dropped, and a token without a value stays as written.

**Formatting.** Use `<strong>`, `<em>`, `<u>`, `<a href>` and `<span style>` inside `<Text>`, `<Heading>` and list items. For multi-line `<Markdown>` or `<Code>`, pass a template literal: ``<Markdown>{`…`}</Markdown>``.

### Without React

Write the same tags as a string and parse them. It's the format the visual editor and agents use, and it needs no build step.

```ts
import { parseTsx, renderToHtml } from "@unitpost/email";

const doc = parseTsx(`
  <Section>
    <Heading>Welcome, {{first_name}}</Heading>
    <Button href="https://example.com/confirm">Confirm email</Button>
  </Section>
`);

const html = renderToHtml(doc, { first_name: "Ada" });
```

Props are the same as in React. In a string you can also write them in kebab-case (`padding-y`). Paste markup into the [playground](https://unitpost.com/playground) to try it before you install.

---

## Components

[Prop tables, live previews and React code for each one](https://unitpost.com/components).

| Group | Components |
| --- | --- |
| **Layout** | [`Email`](https://unitpost.com/components#email) · [`Section`](https://unitpost.com/components#section) · [`Row`](https://unitpost.com/components#row) · [`Column`](https://unitpost.com/components#column) |
| **Content** | [`Heading`](https://unitpost.com/components#heading) · [`Text`](https://unitpost.com/components#text) · [`List`](https://unitpost.com/components#list) · [`Divider`](https://unitpost.com/components#divider) · [`Spacer`](https://unitpost.com/components#spacer) · [`Markdown`](https://unitpost.com/components#markdown) · [`Code`](https://unitpost.com/components#code) |
| **Media** | [`Image`](https://unitpost.com/components#image) |
| **Interactive** | [`Button`](https://unitpost.com/components#button) · [`Link`](https://unitpost.com/components#link) |
| **Advanced** | [`Html`](https://unitpost.com/components#html) (sanitized) |

Every component also takes the [common props](https://unitpost.com/components#common-props): spacing, alignment, Tailwind-style `className`, and `customCss`. Both compile to inline CSS. The renderer adds the document shell (`<html>`, `<head>`, preheader, the centered card). To style it, wrap the email in one `<Email>`: the backdrop, card color, width, padding, corner radius, border, default font and colors, plus the inbox preview text.

```tsx
<Email backgroundColor="#f5f5f4" bodyColor="#ffffff" contentWidth={560} bodyRadius={16} previewText="What's new this month">
  <Section>…</Section>
</Email>
```

---

## Layouts

Ready-made sections built from the components: headers, heroes, cards, columns, calls to action, footers. Each one has a live preview and React code you can copy: **[all layouts](https://unitpost.com/components#layouts)**.

| Group | Layouts |
| --- | --- |
| **[Header](https://unitpost.com/components#layouts-header)** | Brand header · Wordmark header · [Logo header](https://unitpost.com/components#layout-header-logo) · [Logo + links](https://unitpost.com/components#layout-header-logo-nav) |
| **[Hero](https://unitpost.com/components#layouts-hero)** | Headline hero · Contrast hero · Gradient hero · Status hero · Media hero · [Simple hero](https://unitpost.com/components#layout-hero-simple) · [Image hero](https://unitpost.com/components#layout-hero-image) · [Status hero](https://unitpost.com/components#layout-hero-badge) |
| **[Content](https://unitpost.com/components#layouts-content)** | Feature section · Icon rows · Stats row · Order summary · Code card · Callout card · Offer card · Event details · [Card](https://unitpost.com/components#layout-content-card) · [Detail rows](https://unitpost.com/components#layout-content-key-value) · [Verification code](https://unitpost.com/components#layout-content-code) · [Quote / callout](https://unitpost.com/components#layout-content-quote) · [Action feature](https://unitpost.com/components#layout-content-action) · [Announcement banner](https://unitpost.com/components#layout-content-announcement) · [Article feature](https://unitpost.com/components#layout-content-article) |
| **[Columns](https://unitpost.com/components#layouts-columns)** | Product grid · [Split 50/50](https://unitpost.com/components#layout-columns-split) · [Two cards](https://unitpost.com/components#layout-columns-cards) · [Three features](https://unitpost.com/components#layout-columns-features) · [Numbered steps](https://unitpost.com/components#layout-columns-steps) |
| **[Call to action](https://unitpost.com/components#layouts-call-to-action)** | Contrast CTA · [CTA band](https://unitpost.com/components#layout-cta-band) · [Centered CTA](https://unitpost.com/components#layout-cta-centered) |
| **[Footer](https://unitpost.com/components#layouts-footer)** | Sign-off · [Simple footer](https://unitpost.com/components#layout-footer-simple) · [Rich footer](https://unitpost.com/components#layout-footer-rich) · [Footer + apps](https://unitpost.com/components#layout-footer-social) |

The themed layouts (unlinked above) are full-bleed bands with their own 32px gutter: use them with `bodyPadding: 0`, and rebuild one in your brand colours with `buildThemedLayout(key, brandPalette({ accent }))`.

Footer layouts don't include an unsubscribe link or postal address. Add your own if you send marketing email.

---

## Design guide

[`EMAIL_DESIGN.md`](./EMAIL_DESIGN.md) is how we build a good email from a short ask: layout, type scale, colour and contrast, buttons, images, dark mode, copy, and a recipe per common email type. In code:

```ts
import { recipeStarter, lintEmailDesign, renderToHtml } from "@unitpost/email";

const starter = recipeStarter("welcome", { name: "Northwind", accent: "#4f46e5", website: "https://northwind.com" });
const hints = lintEmailDesign(starter.document); // [] — contrast, alt text, links, structure all pass
const html = renderToHtml(starter.document, { first_name: "Ada" });
```

## Examples

Full emails built with the same components. Preview and copy them from the [template gallery](https://unitpost.com/templates/gallery).

<p align="center">
  <a href="https://unitpost.com/templates/gallery"><img src="https://raw.githubusercontent.com/unitpostcom/email/main/docs/examples/receipt.png" width="48%" alt="Payment receipt" /></a>
  <a href="https://unitpost.com/templates/gallery"><img src="https://raw.githubusercontent.com/unitpostcom/email/main/docs/examples/product-announcement.png" width="48%" alt="Product announcement" /></a>
</p>
<p align="center">
  <a href="https://unitpost.com/templates/gallery"><img src="https://raw.githubusercontent.com/unitpostcom/email/main/docs/examples/newsletter.png" width="48%" alt="Newsletter" /></a>
</p>

They ship in the package too:

```ts
import { getSampleTemplate, renderToHtml, resolveVariables } from "@unitpost/email";

const welcome = getSampleTemplate("welcome")!;
const { values } = resolveVariables(welcome.design, { first_name: "Ada", product_name: "Acme" });
const html = renderToHtml(welcome.design, values);
```

| Transactional | Marketing |
| --- | --- |
| welcome · email-verification · magic-link · password-reset · receipt · invoice · team-invite · shipping-confirmation · subscription-renewal · trial-ending · security-alert · comment-mention | newsletter · july-newsletter · product-announcement · event-invite · discount-offer · re-engagement · feedback-survey · waitlist-invite · abandoned-cart · case-study · webinar-recap · referral |

---

## API

| Area | Exports |
| --- | --- |
| React (`@unitpost/email/react`) | `Email`, `Section`, `Row`, `Column`, `Heading`, `Text`, `List`, `Button`, `Link`, `Image`, `Divider`, `Spacer`, `Markdown`, `Code`, `Html`, `render`, `fromJsx` |
| Rendering | `renderToHtml`, `renderToText`, `resolveVariables`, `resolveVariablesWithContact`, `collectVariables`, `documentHasPerRecipientVariables` |
| Codec | `parseTsx`, `parseTsxDocument`, `printTsx`, `printFragmentTsx`, `htmlToBlocks`, `TsxParseError`, `EMAIL_ELEMENT_ATTRIBUTES` |
| Editors | `templateEditor`, `convertTemplateDocument`, `TEMPLATE_EDITORS` |
| Document | `EmailDocument`, `EmailDocumentSchema`, `parseDocument`, `migrateDocument`, `COMPONENT_DEFAULTS`, `STYLE_TOKENS`, `TEMPLATE_CATEGORIES` |
| Catalog | `COMPONENT_CATALOG`, `DOCUMENTED_COMPONENTS`, `EMAIL_ELEMENT_DOC`, `COMPONENT_GROUPS`, `COMMON_PROPS`, `getComponentDoc`, `resolvePropDefault` |
| Layouts | `SECTION_LAYOUTS`, `LAYOUT_GROUPS`, `getSectionLayout` |
| Samples | `SAMPLE_TEMPLATES`, `getSampleTemplate` |
| Sanitizer | `sanitizeEmailHtml`, `safeUrl`, `safeImageUrl`, `hasForbiddenHtml` |
| Helpers | `createBlock`, `createRow`, `regenerateBlockIds`, `emptyDocument`, `safeParseDocument`, `BLOCK_LABELS`, `FONT_STACKS` |
| Styling | `compileClasses`, `cssToUtilities` |

---

## Development

```bash
npm install
npm run typecheck
npm test
npm run preview   # HTML of every sample, open locally
```

A change to the HTML a published document renders to is a **breaking change**. See [CHANGELOG.md](./CHANGELOG.md).

See [CONTRIBUTING.md](./CONTRIBUTING.md). Security reports: [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © Unitpost
