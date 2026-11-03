import assert from "node:assert/strict";
import { test } from "node:test";

import { poweredByHtml } from "./brand-mark";

// The mark is rendered into the dashboard document itself (editor preview),
// so a theme font value must never be able to leave the style attribute.
test("poweredByHtml: the theme font cannot break out of the style attribute", () => {
  const html = poweredByHtml({ fontFamily: 'Arial"><img src=x onerror=alert(1)>' });
  // The payload survives only as inert text inside the quoted attribute.
  assert.ok(!html.includes("<img src=x"), html);
  assert.ok(!/<[^>]*onerror=/.test(html.replace(/style="[^"]*"/g, "")), html);
  assert.ok(html.includes("font-family:Arial&quot;&gt;&lt;img src=x onerror=alert(1)&gt; !important"), html);
});

test("poweredByHtml: an ordinary quoted font stack is left as valid CSS", () => {
  const html = poweredByHtml({ fontFamily: "'Segoe UI', Roboto, \"Helvetica Neue\", sans-serif" });
  assert.ok(html.includes("font-family:'Segoe UI', Roboto, &quot;Helvetica Neue&quot;, sans-serif !important"), html);
});

// The library renders other people's email with any provider, so the mark is
// opt-in: only the Unitpost platform turns it on (from the plan entitlement).
test("renderToHtml / renderToText / render: no mark unless showPoweredBy is true", async () => {
  const { parseTsx } = await import("./codec");
  const { renderToHtml } = await import("./render");
  const { renderToText } = await import("./text");
  const { render, Section, Text } = await import("./react");
  const { createElement: h } = await import("react");
  const doc = parseTsx(`<Section><Text>Hi</Text></Section>`);
  const simple = { ...doc, compositionMode: "simple" as const };
  for (const html of [
    renderToHtml(doc),
    renderToHtml(simple),
    render(h(Section, null, h(Text, null, "Hi"))),
  ]) {
    assert.ok(!html.includes("powered_by"), html);
  }
  assert.ok(!renderToText(doc).includes("Unitpost"));
  assert.ok(renderToHtml(doc, {}, { showPoweredBy: true }).includes("utm_medium=powered_by"));
  assert.ok(renderToHtml(simple, {}, { showPoweredBy: true }).includes("powered_by_simple"));
  assert.ok(renderToText(doc, {}, { showPoweredBy: true }).includes("Unitpost"));
});
