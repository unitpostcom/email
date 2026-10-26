import assert from "node:assert/strict";
import { test } from "node:test";

import { parseTsx } from "./codec";
import { designRemovals } from "./design-diff";
import { emailIconUrl } from "./email-assets";
import { emptyDocument } from "./schema";

const FEATURES = `<Section padding-x={32} padding-y={28}>
  <Heading level={1}>Welcome</Heading>
  <Button href="https://acme.com/start" border-radius={999}>Get started</Button>
</Section>
<Row>
  <Column><Image src="${emailIconUrl("rocket", "soft")}" alt="" width={40} /><Text>Launch fast</Text></Column>
  <Column><Image src="${emailIconUrl("zap", "soft")}" alt="" width={40} /><Text>Automate</Text></Column>
</Row>
<Section padding-x={32} padding-y={28}>
  <Text>Questions? Reply to this email.</Text>
  <Button href="https://acme.com/help" border-radius={999}>Get help</Button>
</Section>`;

test("an unrelated edit that dropped the icons is reported (owner report 2026-10-26)", () => {
  const prev = parseTsx(FEATURES);
  const next = parseTsx(
    FEATURES.replace("Welcome", "Welcome aboard")
      .replace(`<Image src="${emailIconUrl("rocket", "soft")}" alt="" width={40} />`, "")
      .replace(`<Image src="${emailIconUrl("zap", "soft")}" alt="" width={40} />`, ""),
  );
  assert.deepEqual(designRemovals(prev, next), ["2 images (rocket-soft.png, zap-soft.png)"]);
});

test("buttons and sections are counted; rewording and restyling are not removals", () => {
  const prev = parseTsx(FEATURES);
  assert.deepEqual(designRemovals(prev, parseTsx(FEATURES.replace("Get help", "Talk to us").replace(/border-radius=\{999\}/g, "border-radius={8}"))), []);
  const shorter = FEATURES.slice(0, FEATURES.lastIndexOf("<Section"));
  assert.deepEqual(designRemovals(prev, parseTsx(shorter)), ["1 of 2 buttons", "1 of 3 sections"]);
});

test("a first design removes nothing; a repeated image counts each copy", () => {
  assert.deepEqual(designRemovals(emptyDocument(), parseTsx(FEATURES)), []);
  assert.deepEqual(designRemovals(null, parseTsx(FEATURES)), []);
  const twice = parseTsx(`<Image src="https://acme.com/logo.png" alt="Acme" width={120} /><Image src="https://acme.com/logo.png?v=2" alt="Acme" width={120} /><Image src="https://acme.com/logo.png" alt="Acme" width={120} />`);
  const once = parseTsx(`<Image src="https://acme.com/logo.png" alt="Acme" width={120} /><Image src="https://acme.com/logo.png?v=2" alt="Acme" width={120} />`);
  assert.deepEqual(designRemovals(twice, once), ["1 image (logo.png)"]);
});
