# @unitpost/email

Author email as JSON or a tiny TSX dialect. Render table-based HTML that actually works in Outlook, Gmail, and Apple Mail.

```bash
npm install @unitpost/email zod
```

**[Playground](https://unitpost.com/playground)** · **[Template gallery](https://unitpost.com/templates/gallery)** · **[Components](https://unitpost.com/components)** · **[npm](https://www.npmjs.com/package/@unitpost/email)**

No account. No API key. `zod` is a peer (`^4`). Node 18+.

<p align="center">
  <img src="docs/examples/welcome.png" width="520" alt="Welcome email rendered by @unitpost/email" />
</p>

## Quick start

```ts
import { parseTsx, renderToHtml, resolveVariables } from "@unitpost/email";

const doc = parseTsx(`
  <Section padding-x={24} padding-y={32}>
    <Heading level={1}>Hi {{first_name}} 👋</Heading>
    <Text>Welcome to {{product_name}}.</Text>
    <Button href="{{cta_url}}">Get started</Button>
  </Section>
`);

const { values, missing } = resolveVariables(doc, {
  first_name: "Ada",
  product_name: "Northwind",
  cta_url: "https://example.com",
});
if (missing.length > 0) throw new Error(`Unresolved: ${missing.join(", ")}`);

const html = renderToHtml(doc, values);
```

Paste that markup into the [playground](https://unitpost.com/playground) to see the HTML before you install.

Unresolved `{{tokens}}` render literally. Values are HTML-escaped; `javascript:` URLs are dropped; a value containing `{{other}}` is never re-interpolated.

---

## Examples

Same renderer as the samples above — copy one from the [gallery](https://unitpost.com/templates/gallery) or `getSampleTemplate`.

<p align="center">
  <a href="https://unitpost.com/templates/gallery"><img src="docs/examples/receipt.png" width="48%" alt="Payment receipt" /></a>
  <a href="https://unitpost.com/templates/gallery"><img src="docs/examples/product-announcement.png" width="48%" alt="Product announcement" /></a>
</p>
<p align="center">
  <a href="https://unitpost.com/templates/gallery"><img src="docs/examples/newsletter.png" width="48%" alt="Newsletter" /></a>
</p>

```ts
import { getSampleTemplate, renderToHtml, resolveVariables } from "@unitpost/email";

const welcome = getSampleTemplate("welcome")!;
const { values } = resolveVariables(welcome.design, { first_name: "Ada", product_name: "Northwind" });
const html = renderToHtml(welcome.design, values);
```

| Transactional | Marketing |
| --- | --- |
| [welcome](https://unitpost.com/templates/gallery) · [email-verification](https://unitpost.com/templates/gallery) · [magic-link](https://unitpost.com/templates/gallery) · [password-reset](https://unitpost.com/templates/gallery) · [receipt](https://unitpost.com/templates/gallery) · [invoice](https://unitpost.com/templates/gallery) · [team-invite](https://unitpost.com/templates/gallery) · [shipping-confirmation](https://unitpost.com/templates/gallery) · [subscription-renewal](https://unitpost.com/templates/gallery) · [trial-ending](https://unitpost.com/templates/gallery) · [security-alert](https://unitpost.com/templates/gallery) · [comment-mention](https://unitpost.com/templates/gallery) | [newsletter](https://unitpost.com/templates/gallery) · [july-newsletter](https://unitpost.com/templates/gallery) · [product-announcement](https://unitpost.com/templates/gallery) · [event-invite](https://unitpost.com/templates/gallery) · [discount-offer](https://unitpost.com/templates/gallery) · [re-engagement](https://unitpost.com/templates/gallery) · [feedback-survey](https://unitpost.com/templates/gallery) · [waitlist-invite](https://unitpost.com/templates/gallery) · [abandoned-cart](https://unitpost.com/templates/gallery) · [case-study](https://unitpost.com/templates/gallery) · [webinar-recap](https://unitpost.com/templates/gallery) · [referral](https://unitpost.com/templates/gallery) |

---

## Layouts

Pre-built bands you drop in, then edit. Live preview + TSX for each one: **[all layouts](https://unitpost.com/components#layouts)**.

```ts
import { getSectionLayout, printFragmentTsx } from "@unitpost/email";

const hero = getSectionLayout("hero-simple")!;
const tsx = printFragmentTsx(hero.build());
```

| Group | Layouts |
| --- | --- |
| **[Header](https://unitpost.com/components#layouts-header)** | [Logo header](https://unitpost.com/components#layout-header-logo) · [Logo + links](https://unitpost.com/components#layout-header-logo-nav) |
| **[Hero](https://unitpost.com/components#layouts-hero)** | [Simple hero](https://unitpost.com/components#layout-hero-simple) · [Image hero](https://unitpost.com/components#layout-hero-image) · [Status hero](https://unitpost.com/components#layout-hero-badge) |
| **[Content](https://unitpost.com/components#layouts-content)** | [Card](https://unitpost.com/components#layout-content-card) · [Detail rows](https://unitpost.com/components#layout-content-key-value) · [Verification code](https://unitpost.com/components#layout-content-code) · [Quote / callout](https://unitpost.com/components#layout-content-quote) · [Action feature](https://unitpost.com/components#layout-content-action) · [Announcement banner](https://unitpost.com/components#layout-content-announcement) · [Article feature](https://unitpost.com/components#layout-content-article) |
| **[Columns](https://unitpost.com/components#layouts-columns)** | [Split 50/50](https://unitpost.com/components#layout-columns-split) · [Two cards](https://unitpost.com/components#layout-columns-cards) · [Three features](https://unitpost.com/components#layout-columns-features) · [Numbered steps](https://unitpost.com/components#layout-columns-steps) |
| **[Call to action](https://unitpost.com/components#layouts-call-to-action)** | [CTA band](https://unitpost.com/components#layout-cta-band) · [Centered CTA](https://unitpost.com/components#layout-cta-centered) |
| **[Footer](https://unitpost.com/components#layouts-footer)** | [Simple footer](https://unitpost.com/components#layout-footer-simple) · [Rich footer](https://unitpost.com/components#layout-footer-rich) · [Footer + apps](https://unitpost.com/components#layout-footer-social) |

Footer bands are chrome only (logo, nav, a reply line). If you send marketing mail, add your own unsubscribe copy and postal address.

---

## Components

[Full prop tables and live previews](https://unitpost.com/components).

| Group | Components |
| --- | --- |
| **Layout** | [`Section`](https://unitpost.com/components#section) · [`Row`](https://unitpost.com/components#row) · [`Column`](https://unitpost.com/components#column) |
| **Content** | [`Heading`](https://unitpost.com/components#heading) · [`Text`](https://unitpost.com/components#text) · [`Divider`](https://unitpost.com/components#divider) · [`Spacer`](https://unitpost.com/components#spacer) · [`Markdown`](https://unitpost.com/components#markdown) · [`Code`](https://unitpost.com/components#code) |
| **Media** | [`Image`](https://unitpost.com/components#image) |
| **Interactive** | [`Button`](https://unitpost.com/components#button) · [`Link`](https://unitpost.com/components#link) |
| **Advanced** | [`Html`](https://unitpost.com/components#html) (sanitized) |

Every block accepts [common props](https://unitpost.com/components#common-props) (spacing, alignment, Tailwind-style `className` compiled to inline CSS). Document chrome (`<html>`, `<head>`, preheader, the centered paper) is the renderer’s job — not missing components.

Or skip TSX and build the JSON:

```ts
import { emptyDocument, createBlock, renderToHtml } from "@unitpost/email";

const doc = emptyDocument();
doc.blocks.push(
  createBlock("heading", { text: "Hello", level: 1 }),
  createBlock("text", { text: "Built as data, rendered as email." }),
);
const html = renderToHtml(doc, {});
```

---

## API

| Area | Exports |
| --- | --- |
| Document | `EmailDocument`, `EmailDocumentSchema`, `parseDocument`, `migrateDocument`, `COMPONENT_DEFAULTS`, `STYLE_TOKENS`, `TEMPLATE_CATEGORIES` |
| Rendering | `renderToHtml`, `resolveVariables`, `resolveVariablesWithContact`, `collectVariables`, `documentHasPerRecipientVariables` |
| Codec | `parseTsx`, `printTsx`, `printFragmentTsx`, `TsxParseError` |
| Catalog | `COMPONENT_CATALOG`, `COMPONENT_GROUPS`, `COMMON_PROPS`, `getComponentDoc`, `resolvePropDefault` |
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

## License

[MIT](./LICENSE) © Unitpost
