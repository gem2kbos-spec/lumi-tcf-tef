import test from "node:test";
import assert from "node:assert/strict";
import { localLookup } from "../server/vocabulary-store.js";

test("local vocabulary lookup provides bilingual usage and examples", () => {
  const entry = localLookup("malgré");
  assert.match(entry.meaningZh, /尽管/);
  assert.match(entry.usageFr, /nom/);
  assert.ok(entry.examples.length >= 2);
  assert.ok(entry.collocations.includes("malgré tout"));
});

test("vocabulary lookup normalizes French casing", () => {
  assert.equal(localLookup("FIABLE").meaningZh, localLookup("fiable").meaningZh);
});
