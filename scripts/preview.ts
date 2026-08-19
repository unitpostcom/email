// Email template width/rendering preview generator.
//
// WHY THIS EXISTS: the send pipeline is gated off locally (SEND_PIPELINE_LIVE),
// and Gmail (the obvious test inbox) strips <style>/@media anyway — so it can't
// exercise the responsive `.ee-body` media query in render.ts. The reliable way
// to eyeball the width behavior is to render each template to standalone HTML
// and view it at different viewport widths in a real browser. This script does
// exactly that, with zero AWS/DB/secrets: it renders every SAMPLE_TEMPLATE via
// the SAME renderToHtml the engine uses, writes one file per template, and an
// index.html that embeds each in resizable iframes at a few widths so you can
// see the container go fluid below its contentWidth instead of overflowing.
//
// Run:  npm run preview --workspace=@unitpost/email
// Then open the printed dist/preview/index.html in a browser.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SAMPLE_TEMPLATES, renderToHtml, resolveVariables } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "dist", "preview");

// Viewport widths to preview each template at. Chosen to straddle the common
// contentWidth values (480 / 600 / 700): a wide desktop where the fixed width
// applies, a narrow desktop that used to force a horizontal scrollbar, and a
// phone. Resize any single-template file's window to sweep continuously.
const PREVIEW_WIDTHS = [760, 600, 480, 375] as const;

function htmlEscapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

mkdirSync(outDir, { recursive: true });

const rendered = SAMPLE_TEMPLATES.map((tpl) => {
  // Fallbacks declared on each sample supply every {{token}}, so no manual
  // sample values are needed — this matches gallery/preview behavior.
  const { values } = resolveVariables(tpl.design, {});
  const html = renderToHtml(tpl.design, values);
  const fileName = `${tpl.key}.html`;
  writeFileSync(join(outDir, fileName), html, "utf8");
  return {
    key: tpl.key,
    name: tpl.name,
    category: tpl.category,
    contentWidth: tpl.design.theme.contentWidth,
    fileName,
  };
});

// The index: for each template, a row of iframes at PREVIEW_WIDTHS. An iframe's
// width IS the viewport the embedded email's media query responds to, so this
// visualizes the fix directly — below contentWidth the .ee-body should fill the
// frame (no horizontal scrollbar); at/above it the fixed pixel width applies.
const cards = rendered
  .map((r) => {
    const frames = PREVIEW_WIDTHS.map((w) => {
      const belowBreakpoint = w < r.contentWidth;
      return `        <figure class="frame">
          <figcaption>${w}px${belowBreakpoint ? " <span class=\"fluid\">&lt; contentWidth → fluid</span>" : ""}</figcaption>
          <iframe
            title="${htmlEscapeAttr(r.name)} at ${w}px"
            src="./${r.fileName}"
            style="width:${w}px"
            loading="lazy"
          ></iframe>
        </figure>`;
    }).join("\n");
    return `      <section class="card">
        <header>
          <h2>${r.name} <span class="tag">${r.category}</span></h2>
          <p>contentWidth: <code>${r.contentWidth}px</code> · <a href="./${r.fileName}" target="_blank" rel="noreferrer">open full &nearr;</a></p>
        </header>
        <div class="frames">
${frames}
        </div>
      </section>`;
  })
  .join("\n");

const index = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Email template width preview — Unitpost</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:#f5f5f7; color:#111; }
  @media (prefers-color-scheme: dark){ body{ background:#0b0b0c; color:#eee; } }
  .wrap { max-width:1200px; margin:0 auto; padding:32px 24px 96px; }
  h1 { font-size:22px; margin:0 0 4px; }
  .lede { color:#666; margin:0 0 32px; }
  .card { background:transparent; border-top:1px solid #ddd; padding-top:24px; margin-top:32px; }
  @media (prefers-color-scheme: dark){ .card{ border-color:#333; } }
  .card header h2 { font-size:17px; margin:0 0 2px; display:flex; align-items:center; gap:8px; }
  .card header p { margin:0 0 16px; color:#777; font-size:13px; }
  .tag { font:600 10px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.08em; color:#555; background:#e6e6e9; padding:3px 6px; border-radius:5px; }
  @media (prefers-color-scheme: dark){ .tag{ background:#26262b; color:#aaa; } }
  code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; }
  a { color:#2563eb; }
  .frames { display:flex; gap:20px; align-items:flex-start; overflow-x:auto; padding-bottom:8px; }
  .frame { margin:0; flex:0 0 auto; }
  .frame figcaption { font:12px ui-monospace,monospace; color:#888; margin-bottom:6px; }
  .frame .fluid { color:#16a34a; }
  .frame iframe { height:640px; border:1px solid #ccc; border-radius:8px; background:#fff; }
  @media (prefers-color-scheme: dark){ .frame iframe{ border-color:#333; } }
</style>
</head>
<body>
  <div class="wrap">
    <h1>Email template width preview</h1>
    <p class="lede">
      Each row shows the same template inside iframes at different viewport widths.
      The iframe width is the viewport the email's <code>@media</code> query responds to.
      Below a template's <code>contentWidth</code> the <code>.ee-body</code> container should
      go fluid (fill the frame, no horizontal scroll); at/above it the fixed pixel width applies.
      Tip: open a single template full and drag-resize the window to sweep continuously.
    </p>
${cards}
  </div>
</body>
</html>
`;

writeFileSync(join(outDir, "index.html"), index, "utf8");

const rel = join("packages", "email", "dist", "preview", "index.html");
console.log(`Rendered ${rendered.length} templates → ${outDir}`);
for (const r of rendered) {
  console.log(`  • ${r.name.padEnd(22)} contentWidth=${r.contentWidth}px  (${r.fileName})`);
}
console.log(`\nOpen: ${rel}`);
