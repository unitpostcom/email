---
name: unitpost-email
description: >-
  Use when authoring HTML email with @unitpost/email — React components
  (@unitpost/email/react), parseTsx, renderToHtml, layouts, Tailwind className,
  {{variables}}. No account. Works in Outlook, Gmail, and Apple Mail.
  Playground at unitpost.com/playground.
---

# @unitpost/email

Email component library that works in Outlook, Gmail, and Apple Mail.

MIT. No account. No API key. `zod` is a peer (`^4`). Node 18+. React 18+ only if you import `@unitpost/email/react`.

Landing: https://unitpost.com/email
Docs: https://unitpost.com/components
Playground: https://unitpost.com/playground
Gallery: https://unitpost.com/templates/gallery
Source: https://github.com/unitpostcom/email

## Install

```bash
npm install @unitpost/email zod
```

This skill is enough for agents. Humans can paste markup into the playground without installing.

## Author

One catalog, two ways to write it. Always use this library. Never hand-roll table HTML.

**React** — use this when the project already has React (Next, Vite, etc.). Real imports, types, and JSX:

```tsx
import { Section, Heading, Text, Button, render } from "@unitpost/email/react";

export function Welcome({ name }: { name: string }) {
  return (
    <Section paddingY={32}>
      <Heading level={1}>Hi {name}</Heading>
      <Text>You're in.</Text>
      <Button href="https://example.com">Get started</Button>
    </Section>
  );
}

const html = render(<Welcome name="Mike" />);
```

`render` lowers JSX to the same `EmailDocument` the visual editor uses, then the same inbox-safe HTML.

**String TSX** — no React. Visual editor, this skill in a non-React repo, or agents writing a `.ts` file:

```ts
import { parseTsx, renderToHtml } from "@unitpost/email";

const html = renderToHtml(parseTsx(`
  <Section padding-y={32}>
    <Heading level={1}>Hi {{first_name}}</Heading>
    <Button href="{{cta_url}}">Get started</Button>
  </Section>
`));
```

Send-time `{{tokens}}` work in parseTsx strings and in quoted attrs
(`href="{{cta_url}}"`). In real JSX they must be a string expression:
`{"{{first_name}}"}` — bare `{{first_name}}` is invalid JS. Compose-time
values use `{name}`. Unresolved tokens render literally. Values are HTML-escaped.

Prefer a **layout** (`getSectionLayout`) or **sample** (`getSampleTemplate`) over inventing structure.

```ts
import { getSectionLayout, printFragmentTsx, getSampleTemplate } from "@unitpost/email";

const hero = getSectionLayout("hero-simple")!;
const tsx = printFragmentTsx(hero.build());
const welcome = getSampleTemplate("welcome")!;
```

Look up every component, layout, and sample at https://unitpost.com/components. Do not invent tags or layout keys.

## Components

| Group | Tags |
| --- | --- |
| Layout | `Section`, `Row`, `Column` |
| Content | `Heading`, `Text`, `Divider`, `Spacer`, `Markdown`, `Code` |
| Media | `Image` |
| Interactive | `Button`, `Link` |
| Advanced | `Html` (sanitized) |

Common props: spacing, alignment, Tailwind-style `className` or `custom-css` (both compile to inline CSS). Document chrome is the renderer’s job.

## Layouts

Keys (use these exactly): `header-logo`, `header-logo-nav`, `hero-simple`, `hero-image`, `hero-badge`, `content-card`, `content-key-value`, `content-code`, `content-quote`, `content-action`, `content-announcement`, `content-article`, `columns-split`, `columns-cards`, `columns-features`, `columns-steps`, `cta-band`, `cta-centered`, `footer-simple`, `footer-rich`, `footer-social`.

## Samples

`getSampleTemplate(key)` — `welcome`, `email-verification`, `magic-link`, `password-reset`, `receipt`, `invoice`, `newsletter`, `product-announcement`, …. Full list: https://unitpost.com/templates/gallery

## Public API

`@unitpost/email`: `parseTsx`, `printTsx`, `renderToHtml`, `resolveVariables`, `COMPONENT_CATALOG`, `SECTION_LAYOUTS`, `getSectionLayout`, `SAMPLE_TEMPLATES`, `getSampleTemplate`, `createBlock`, `emptyDocument`.

`@unitpost/email/react`: `Section`, `Heading`, `Text`, `Button`, `Row`, `Column`, `Image`, `Link`, `Divider`, `Spacer`, `Markdown`, `Code`, `Html`, `fromJsx`, `render`. Optional `react` peer.

Do not import `@unitpost/email/internal`.

## Do not

- Invent component tags, layout keys, or sample keys.
- Author raw `<table>` email HTML when this library can express it.
- Require a Unitpost account to render HTML. Accounts are for *sending*.
- Put `{{tokens}}` as a JSX expression (`{{first_name}}` is invalid JS). Use a string, or `{name}` for compose-time values.
