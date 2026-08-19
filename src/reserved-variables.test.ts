import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EmailDocumentSchema,
  VariableSchema,
  isReservedVariableName,
  isSystemVariableName,
  isBuiltInContactField,
  safeParseDocument,
} from "./schema";

// Reserved-variable policy: a user-declared template
// variable can't OWN a reserved name with conflicting semantics — that would let
// a template override a recipient's identity (first_name/last_name/email) or the
// system-minted unsubscribe link. Built-in contact fields may be declared, but
// only as `source: "contact"`; system tokens (unsubscribe_url) can't be declared
// at all. These tests pin the schema enforcement that runs at template
// create/update (via EmailDocumentSchema) for both the dashboard and public API.

test("classifier helpers recognize reserved names (case-insensitive)", () => {
  for (const n of ["first_name", "FIRST_NAME", "Email", "unsubscribe_url"]) {
    assert.equal(isReservedVariableName(n), true, n);
  }
  assert.equal(isReservedVariableName("headline"), false);
  assert.equal(isSystemVariableName("unsubscribe_url"), true);
  assert.equal(isSystemVariableName("first_name"), false);
  assert.equal(isBuiltInContactField("email"), true);
  assert.equal(isBuiltInContactField("unsubscribe_url"), false);
});

test("system token unsubscribe_url can't be declared as a variable", () => {
  for (const source of ["input", "contact"] as const) {
    const r = VariableSchema.safeParse({ name: "unsubscribe_url", source });
    assert.equal(r.success, false, `source=${source}`);
  }
  // case-insensitive
  assert.equal(VariableSchema.safeParse({ name: "UNSUBSCRIBE_URL" }).success, false);
});

test("built-in contact field as `input` is rejected", () => {
  for (const name of ["first_name", "last_name", "email", "Email"]) {
    const r = VariableSchema.safeParse({ name, source: "input" });
    assert.equal(r.success, false, name);
  }
});

test("built-in contact field as `contact` is accepted", () => {
  const r = VariableSchema.safeParse({
    name: "first_name",
    source: "contact",
    contactField: "first_name",
  });
  assert.equal(r.success, true);
});

test("built-in contact field can't be remapped to a different contactField", () => {
  const r = VariableSchema.safeParse({
    name: "email",
    source: "contact",
    contactField: "secret_field",
  });
  assert.equal(r.success, false);
});

test("non-reserved custom variable is unaffected (input is fine)", () => {
  const r = VariableSchema.safeParse({ name: "headline", source: "input" });
  assert.equal(r.success, true);
});

test("EmailDocument with a bad reserved declaration is rejected at the boundary", () => {
  const bad = {
    blocks: [{ type: "text", id: "t1", content: [{ text: "Hi {{first_name}}" }] }],
    variables: [{ name: "first_name", source: "input" }],
  };
  assert.throws(() => EmailDocumentSchema.parse(bad));

  const badSystem = {
    blocks: [{ type: "text", id: "t1", content: [{ text: "x {{unsubscribe_url}}" }] }],
    variables: [{ name: "unsubscribe_url", source: "input", fallback: "https://evil" }],
  };
  assert.throws(() => EmailDocumentSchema.parse(badSystem));
});

test("EmailDocument referencing {{unsubscribe_url}} WITHOUT declaring it is allowed", () => {
  const ok = {
    category: "marketing",
    blocks: [
      {
        type: "text",
        id: "t1",
        content: [{ text: "Bye. Unsubscribe: {{unsubscribe_url}}" }],
      },
    ],
    variables: [{ name: "first_name", source: "contact", contactField: "first_name" }],
  };
  assert.doesNotThrow(() => EmailDocumentSchema.parse(ok));
});

test("legacy stored docs are coerced on load instead of being wiped", () => {
  // A template saved before the rule: first_name declared as input, the system
  // token declared outright, and per-variable `fallback` values still present
  // on stored docs. safeParseDocument (used when loading the DB `design`) must
  // succeed by NORMALIZING, not fall back to an empty document:
  //   • built-in contact fields get coerced to `source: "contact"`
  //   • system tokens (unsubscribe_url) get dropped (the engine mints them)
  //   • legacy per-template `fallback` gets stripped from every variable
  //     (templates no longer carry defaults — see MESSAGING_MODEL.md §1.4)
  const legacy = {
    blocks: [{ type: "text", id: "t1", content: [{ text: "Hi {{first_name}}" }] }],
    variables: [
      { name: "first_name", source: "input", fallback: "there" },
      { name: "unsubscribe_url", source: "input", fallback: "https://old" },
      { name: "headline", source: "input", fallback: "What's new" },
    ],
  };
  const r = safeParseDocument(legacy);
  assert.equal(r.success, true);
  if (!r.success) return;
  const byName = new Map(r.data.variables.map((v) => [v.name, v]));
  // first_name coerced to contact-sourced
  assert.equal(byName.get("first_name")?.source, "contact");
  assert.equal(byName.get("first_name")?.contactField, "first_name");
  // legacy `fallback` stripped from every variable (not just reserved ones).
  assert.equal(
    (byName.get("first_name") as { fallback?: unknown } | undefined)?.fallback,
    undefined,
  );
  assert.equal(
    (byName.get("headline") as { fallback?: unknown } | undefined)?.fallback,
    undefined,
  );
  // unsubscribe_url declaration dropped (engine mints it per recipient)
  assert.equal(byName.has("unsubscribe_url"), false);
  // custom variable preserved (its `fallback` stripped)
  assert.equal(byName.get("headline")?.source, "input");
});
