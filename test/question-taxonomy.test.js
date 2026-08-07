import test from "node:test";
import assert from "node:assert/strict";
import { categoriesFor, categoryFor, QUESTION_CATEGORIES } from "../server/question-taxonomy.js";

test("question taxonomy has unique categories and detailed grammar groups", () => {
  assert.equal(new Set(QUESTION_CATEGORIES.map((item) => item.id)).size, QUESTION_CATEGORIES.length);
  const grammar = categoriesFor("grammar");
  assert.ok(grammar.length >= 8);
  assert.ok(grammar.some((item) => item.label.includes("动词搭配与固定结构")));
  assert.ok(grammar.some((item) => item.label.includes("冠词与限定词")));
});

test("category inference accepts an explicit valid import category and maps known skills", () => {
  assert.equal(categoryFor({ type: "grammar", skill: "pronom_en" }), "pronouns");
  assert.equal(categoryFor({ type: "grammar", skill: "unknown", category: "determiners" }), "determiners");
  assert.equal(categoryFor({ type: "reading", skill: "idee_principale" }), "reading-purpose");
});
