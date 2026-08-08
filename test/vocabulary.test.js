import test from "node:test";
import assert from "node:assert/strict";
import { isPlausibleLemma, localLookup, resolveFrenchLemma } from "../server/vocabulary-store.js";

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

test("common inflected forms are saved under their lemma", async () => {
  assert.equal(await resolveFrenchLemma("sommes", "Nous sommes prêts."), "être");
  assert.equal(await resolveFrenchLemma("obtenues", "Les autorisations obtenues"), "obtenir");
  assert.equal(await resolveFrenchLemma("m'envahissait", "Comme si le chagrin m'envahissait."), "envahir");
});

test("lemma guard rejects synonyms and accepts real inflections", () => {
  assert.equal(isPlausibleLemma("tristesse", "chagrin"), false);
  assert.equal(isPlausibleLemma("mangeait", "manger"), true);
  assert.equal(isPlausibleLemma("s'intéresse", "intéresser"), true);
  assert.equal(isPlausibleLemma("demain", "demain"), true);
});
