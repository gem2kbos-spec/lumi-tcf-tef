import test from "node:test";
import assert from "node:assert/strict";
import { coverageGaps, questionCoversSkill } from "../server/coverage.js";

test("coverage recognizes taxonomy categories and explanation evidence", () => {
  assert.equal(questionCoversSkill({ type: "grammar", category: "pronouns", skill: "pronoun", prompt: "", passage: "", topic: "", explanation: "" }, "pronoms y et en"), true);
  assert.equal(questionCoversSkill({ type: "grammar", category: "verb-tenses", skill: "tense", prompt: "", passage: "", topic: "", explanation: "On emploie le plus-que-parfait.", options: [] }, "plus-que-parfait"), true);
});

test("coverage gaps only reports genuinely unmatched skills", () => {
  const questions = [{ type: "reading", category: "reading-purpose", skill: "idee_principale", prompt: "", passage: "", topic: "", explanation: "", options: [] }];
  assert.deepEqual(coverageGaps(questions, "reading", ["identifier l'idée principale", "comprendre une consigne"]), ["comprendre une consigne"]);
});
