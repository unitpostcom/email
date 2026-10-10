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
