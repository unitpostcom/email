// Rasterise the hosted email assets (src/email-assets.ts) to PNG:
//   icons        → apps/web/public/email-assets/icons/{name}-{variant}.png
//   placeholders → apps/web/public/email-assets/placeholders/{name}.png
// Run from the repo root after changing EMAIL_ICONS / EMAIL_PLACEHOLDERS:
//   npx tsx packages/email/scripts/render-email-assets.mts
// Only files that don't exist yet are written: a shipped asset is permanent
// (sent emails point at it; LICENSE.md, ADR-0105), and a re-render on another
// Chromium could change its pixels. `--force` re-renders everything.
// Needs the root playwright (dev dependency) with Chromium installed. The
// icon geometry comes from lucide-react (ISC), the same set the dashboard uses.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

import { chromium } from "playwright";

import {
  EMAIL_ICONS,
  EMAIL_ICON_SIZE,
  EMAIL_ICON_VARIANTS,
  EMAIL_PLACEHOLDERS,
  type EmailIconVariant,
} from "../src/email-assets.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const out = join(repo, "apps", "web", "public", "email-assets");
const require = createRequire(import.meta.url);
const lucideDir = join(dirname(require.resolve("lucide-react/package.json")), "dist", "esm", "icons");

type IconNode = [string, Record<string, string>][];
async function iconNode(name: string): Promise<IconNode> {
  const file = join(lucideDir, `${name}.mjs`);
  const mod = (await import(pathToFileURL(file).href)) as { __iconData?: { node: IconNode } };
  if (mod.__iconData) return mod.__iconData.node;
  // An alias (circle-help → circle-question-mark) re-exports only the
  // component; read the icon it points at.
  const target = /export \{ default \} from '\.\/([\w-]+)\.mjs'/.exec(readFileSync(file, "utf8"))?.[1];
  if (!target) throw new Error(`lucide-react has no icon data for "${name}"`);
  return iconNode(target);
}

function svg(node: IconNode, color: string, px: number): string {
  const kids = node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${kids}</svg>`;
}

const INK = "#18181b";
const CHIP_LIGHT = "#f4f4f5";
const PLACEHOLDER_ICON = "#a1a1aa";

function iconHtml(node: IconNode, variant: EmailIconVariant): string {
  const size = EMAIL_ICON_SIZE[variant];
  if (variant === "ink" || variant === "white") return svg(node, variant === "ink" ? INK : "#ffffff", size);
  const bg = variant === "soft" ? CHIP_LIGHT : INK;
  const fg = variant === "soft" ? INK : "#ffffff";
  return `<div style="width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.3)}px;background:${bg};display:flex;align-items:center;justify-content:center">${svg(node, fg, Math.round(size * 0.5))}</div>`;
}

function placeholderHtml(name: keyof typeof EMAIL_PLACEHOLDERS, node: IconNode, person: IconNode): string {
  const { width, height } = EMAIL_PLACEHOLDERS[name];
  const w = width / 2;
  const h = height / 2;
  const glyph = name === "avatar" ? person : node;
  const radius = name === "avatar" ? "50%" : "0";
  return `<div style="width:${w}px;height:${h}px;border-radius:${radius};background:#eeeef0;display:flex;align-items:center;justify-content:center">${svg(glyph, PLACEHOLDER_ICON, Math.round(Math.min(w, h) * (name === "avatar" ? 0.45 : 0.22)))}</div>`;
}

// CHROMIUM_PATH: a Chromium other than the one the repo's playwright
// expects (e.g. a cloud session's preinstalled browser).
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(`<body style="margin:0;background:transparent"><div id="s" style="display:inline-block"></div></body>`);
const stage = page.locator("#s");

const force = process.argv.includes("--force");
let kept = 0;
async function shoot(html: string, file: string) {
  if (!force && existsSync(file)) {
    kept++;
    return;
  }
  await stage.evaluate((el, h) => (el.innerHTML = h), html);
  writeFileSync(file, await stage.screenshot({ omitBackground: true }));
}

mkdirSync(join(out, "icons"), { recursive: true });
mkdirSync(join(out, "placeholders"), { recursive: true });
let n = 0;
for (const name of Object.keys(EMAIL_ICONS)) {
  const node = await iconNode(name);
  for (const variant of EMAIL_ICON_VARIANTS) {
    await shoot(iconHtml(node, variant), join(out, "icons", `${name}-${variant}.png`));
    n++;
  }
}
const imageGlyph = await iconNode("image");
const userGlyph = await iconNode("user");
for (const name of Object.keys(EMAIL_PLACEHOLDERS) as (keyof typeof EMAIL_PLACEHOLDERS)[]) {
  await shoot(placeholderHtml(name, imageGlyph, userGlyph), join(out, "placeholders", `${name}.png`));
  n++;
}
await browser.close();
console.log(`${n - kept} assets written, ${kept} already there → ${out}`);
