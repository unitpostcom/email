import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDocument, safeParseDocument } from "./schema";
import { collectVariables, resolveVariablesWithContact } from "./render";

// Regression coverage for the data-integrity gate: a template that references a
// {{variable}} with no provided value and no contact field is REPORTED AS
// MISSING — the signal the Main App turns into a 422 BEFORE accepting a send
// (and the engine turns into a NonRetriable FAILED). Previously the missing-
// variable case was discovered only inside the engine render step, so a
// structurally-impossible send was accepted (row QUEUED) and surfaced as a
// deferred failure minutes later. These tests pin the resolver contract that
// both the boundary validation and the engine render rely on.
//
// Templates deliberately carry NO per-variable fallback anymore (silent
// per-template defaults were shipping placeholder copy to real recipients
// without any UI surfacing — see MESSAGING_MODEL.md §1.4). Legacy stored docs
// with the old `fallback` field are stripped by migrateDocument on load.

// A template referencing {{first_name}} declared as a contact-sourced variable.
function docRef(name: string, decl: Record<string, unknown> = {}) {
  return parseDocument({
    variables: [{ name, ...decl }],
    blocks: [
      { type: "text", id: "t1", content: [{ text: `Hi {{${name}}}` }] },
    ],
  });
}

test("collectVariables sees the referenced token", () => {
  const doc = docRef("first_name", { source: "contact" });
  assert.deepEqual(collectVariables(doc), ["first_name"]);
});

test("collectVariables sees tokens inside raw-HTML blocks (TPL-034)", () => {
  // renderHtmlBlock interpolates {{vars}} into html blocks, so the collector
  // must report them — otherwise the send pre-flight never resolves them and
  // an unresolvable token would ship literally instead of 422-ing.
  const doc = parseDocument({
    blocks: [
      { type: "html", id: "h1", html: "<p>Hello {{qa_missing_var}}</p>" },
    ],
  });
  assert.deepEqual(collectVariables(doc), ["qa_missing_var"]);
  const { missing } = resolveVariablesWithContact(doc, {}, {});
  assert.deepEqual(missing, ["qa_missing_var"]);
});

test("missing when no value, no contact field, no campaign default", () => {
  const doc = docRef("first_name", { source: "contact" });
  const { values, missing } = resolveVariablesWithContact(doc, {}, {});
  assert.deepEqual(missing, ["first_name"]);
  assert.equal(values.first_name, undefined);
});

test("resolved when the recipient's contact supplies it", () => {
  const doc = docRef("first_name", { source: "contact" });
  const { values, missing } = resolveVariablesWithContact(
    doc,
    {},
    { first_name: "Ada" },
  );
  assert.deepEqual(missing, []);
  assert.equal(values.first_name, "Ada");
});

test("legacy template `fallback` is STRIPPED on load and NOT used to resolve", () => {
  // A stored document from the old world (per-template fallback declared on
  // the variable). migrateDocument removes the field so VariableSchema
  // continues to parse cleanly; the resolver has no template-fallback branch
  // anymore, so this variable is reported as missing exactly as if the legacy
  // fallback had never been there. This is what closes the newsletter bug:
  // silent template-shipped defaults can never make a variable "not missing".
  const legacy = {
    variables: [
      { name: "first_name", source: "contact", contactField: "first_name", fallback: "there" },
    ],
    blocks: [
      { type: "text", id: "t1", content: [{ text: "Hi {{first_name}}" }] },
    ],
  };
  const r = safeParseDocument(legacy);
  assert.equal(r.success, true);
  if (!r.success) return;
  // Schema no longer carries `fallback`, and migrateDocument dropped it.
  const decl = r.data.variables.find((v) => v.name === "first_name");
  assert.ok(decl);
  assert.equal((decl as { fallback?: unknown }).fallback, undefined);
  // Resolver treats it as missing when contact/defaults are empty.
  const { values, missing } = resolveVariablesWithContact(r.data, {}, {}, {});
  assert.deepEqual(missing, ["first_name"]);
  assert.equal(values.first_name, undefined);
});

test("provided value wins over contact + campaign default", () => {
  const doc = docRef("first_name", { source: "contact" });
  const { values, missing } = resolveVariablesWithContact(
    doc,
    { first_name: "Grace" },
    { first_name: "Ada" },
    { first_name: "there" },
  );
  assert.deepEqual(missing, []);
  assert.equal(values.first_name, "Grace");
});

test("fill-only default backfills a contact missing the value", () => {
  const doc = docRef("first_name", { source: "contact" });
  const { values, missing } = resolveVariablesWithContact(
    doc,
    {},
    {},
    { first_name: "there" },
  );
  assert.deepEqual(missing, []);
  assert.equal(values.first_name, "there");
});

test("fill-only default does NOT clobber a real contact value", () => {
  const doc = docRef("first_name", { source: "contact" });
  const { values, missing } = resolveVariablesWithContact(
    doc,
    {},
    { first_name: "Ada" },
    { first_name: "there" },
  );
  assert.deepEqual(missing, []);
  // Contact's real value wins over the campaign fill-only default.
  assert.equal(values.first_name, "Ada");
});

test("provided override still beats a fill-only default", () => {
  const doc = docRef("first_name", { source: "contact" });
  const { values } = resolveVariablesWithContact(
    doc,
    { first_name: "Grace" },
    { first_name: "Ada" },
    { first_name: "there" },
  );
  // provided (system/branding/transactional) is the top of the precedence.
  assert.equal(values.first_name, "Grace");
});

test("an empty contact value does NOT satisfy a required variable", () => {
  const doc = docRef("first_name", { source: "contact" });
  const { missing } = resolveVariablesWithContact(
    doc,
    {},
    { first_name: "" },
  );
  assert.deepEqual(missing, ["first_name"]);
});

// F2: a {{token}} used ONLY in the subject (not the document body) must still be
// scanned + resolved via `extraTexts`, so it enters the missing-var report and
// gets a per-recipient value instead of shipping as a literal in the subject.
function docNoVars() {
  return parseDocument({
    variables: [],
    blocks: [{ type: "text", id: "t1", content: [{ text: "Hello there" }] }],
  });
}

test("collectVariables scans subject-only tokens via extraTexts", () => {
  const doc = docNoVars();
  assert.deepEqual(collectVariables(doc), []);
  assert.deepEqual(collectVariables(doc, ["Hi {{first_name}}!"]), [
    "first_name",
  ]);
});

test("subject-only variable is reported missing when unresolved", () => {
  const doc = docNoVars();
  const { missing } = resolveVariablesWithContact(doc, {}, {}, {}, [
    "Hi {{first_name}}!",
  ]);
  assert.deepEqual(missing, ["first_name"]);
});

test("subject-only variable resolves from the contact", () => {
  const doc = docNoVars();
  const { values, missing } = resolveVariablesWithContact(
    doc,
    { first_name: "Ada" },
    {},
    {},
    ["Hi {{first_name}}!"],
  );
  assert.deepEqual(missing, []);
  assert.equal(values.first_name, "Ada");
});
