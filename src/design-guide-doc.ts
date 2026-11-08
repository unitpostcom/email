// EMAIL_DESIGN.md, generated from design-guide.ts plus the layouts registry.
//   npm run guide:write -w @unitpost/email
// Kept apart from design-guide.ts so that module never imports layouts.ts:
// layouts pulls in every sample template, and design-guide is imported by
// code that only needs the rules and recipes (Unit's prompt, the MCP tool).

import { EMAIL_ICONS, EMAIL_ICON_VARIANTS, EMAIL_PLACEHOLDERS, emailIconUrl, emailPlaceholderUrl } from "./email-assets";
import { EMAIL_DESIGN_RULES, EMAIL_DESIGN_TOKENS, EMAIL_OPENERS, EMAIL_RECIPES } from "./design-guide";
import { LAYOUT_GROUPS, SECTION_LAYOUTS, isThemedLayout } from "./layouts";

const RECIPES = EMAIL_RECIPES;

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
    "## Openers",
    "",
    "The first screen carries the email's one visual anchor. Pick the opener by type; each is a layout in `design_library` (topic `layouts`) and in the editor's Layouts rail, drawn in the brand's colours.",
    "",
    "| Opener | Layouts | Use for | Picture | Drawn from |",
    "|---|---|---|---|---|",
    ...EMAIL_OPENERS.map((o) => `| ${o.name} | ${o.layouts.map((k) => `\`${k}\``).join(", ")} | ${mdEscapePipes(o.use)} | ${o.picture} | ${o.from.join(", ")} |`),
    "",
    "## Sections",
    "",
    "Change the shape from one section to the next. Every band below is palette-aware and carries its own 32px gutter.",
    "",
  );
  for (const group of LAYOUT_GROUPS) {
    const rows = SECTION_LAYOUTS.filter((l) => l.group === group && isThemedLayout(l.key));
    if (!rows.length) continue;
    lines.push(`### ${group}`, "", ...rows.map((l) => `- \`${l.key}\` (${l.name}): ${l.description}`), "");
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
