---
name: unitpost-email
description: >-
  Use when authoring HTML email with @unitpost/email — components, layouts,
  parseTsx, renderToHtml, Tailwind className, {{variables}}. No account.
  Works in Outlook, Gmail, and Apple Mail. Playground at unitpost.com/playground.
---

# @unitpost/email

Email component library that works in Outlook, Gmail, and Apple Mail.

MIT. No account. No API key. `zod` is a peer (`^4`). Node 18+.

Landing: https://unitpost.com/email
Docs: https://unitpost.com/components
Playground: https://unitpost.com/playground
Gallery: https://unitpost.com/templates/gallery
Source: https://github.com/unitpostcom/email

## Install

```bash
npm install @unitpost/email zod
```

This skill is enough for agents. Humans can also paste markup into the playground without installing.

## Author

Constrained TSX (a small, fixed vocabulary — not a React app) or `EmailDocument` JSON. Always use this library. Never hand-roll table HTML.

```ts
import { parseTsx, renderToHtml, resolveVariables } from "@unitpost/email";

const doc = parseTsx(`
  <Section padding-x={24} padding-y={32}>
    <Heading level={1}>Hi {{first_name}}</Heading>
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

Pass `html` to any sender. Unresolved `{{tokens}}` render literally. Values are HTML-escaped; `javascript:` URLs are dropped.

Prefer starting from a **layout** (`getSectionLayout`) or a **sample** (`getSampleTemplate`) over inventing structure.

```ts
import { getSectionLayout, printFragmentTsx, getSampleTemplate } from "@unitpost/email";

const hero = getSectionLayout("hero-simple")!;
const tsx = printFragmentTsx(hero.build());

const welcome = getSampleTemplate("welcome")!;
```

Look up every component, layout, and sample (with TSX) on https://unitpost.com/components or via the catalog exports below. Do not invent tags or layout keys.

## Components

| Group | Tags |
| --- | --- |
| Layout | `Section`, `Row`, `Column` |
| Content | `Heading`, `Text`, `Divider`, `Spacer`, `Markdown`, `Code` |
| Media | `Image` |
| Interactive | `Button`, `Link` |
| Advanced | `Html` (sanitized) |

Common props on every block: spacing, alignment, Tailwind-style `className` or CSS via `custom-css` (both compile to inline CSS). Document chrome (`<html>`, `<head>`, preheader) is the renderer’s job.

Props and live snippets: https://unitpost.com/components#`<slug>` (e.g. `#button`).

## Layouts

Pre-built bands. Keys (use these exactly):

- Header: `header-logo`, `header-logo-nav`
- Hero: `hero-simple`, `hero-image`, `hero-badge`
- Content: `content-card`, `content-key-value`, `content-code`, `content-quote`, `content-action`, `content-announcement`, `content-article`
- Columns: `columns-split`, `columns-cards`, `columns-features`, `columns-steps`
- CTA: `cta-band`, `cta-centered`
- Footer: `footer-simple`, `footer-rich`, `footer-social`

Full preview + TSX: https://unitpost.com/components#layouts

## Samples

`getSampleTemplate(key)` — keys include `welcome`, `email-verification`, `magic-link`, `password-reset`, `receipt`, `invoice`, `newsletter`, `product-announcement`. Full list: https://unitpost.com/templates/gallery

## Public API (npm)

`parseTsx`, `printTsx`, `printFragmentTsx`, `renderToHtml`, `resolveVariables`, `COMPONENT_CATALOG`, `getComponentDoc`, `SECTION_LAYOUTS`, `getSectionLayout`, `SAMPLE_TEMPLATES`, `getSampleTemplate`, `createBlock`, `emptyDocument`.

Do not import editor-only internals (`@unitpost/email/internal`).

## Do not

- Invent component tags, layout keys, or sample keys.
- Author raw `<table>` email HTML when this library can express it.
- Require a Unitpost account, API key, or MCP server to render HTML. Those are for *sending* with Unitpost, not for this library.
