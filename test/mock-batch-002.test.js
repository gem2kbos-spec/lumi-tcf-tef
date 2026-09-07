import test from "node:test";
import assert from "node:assert/strict";
import { mockGrammarBatch002 } from "../server/mock-grammar-batch-002.js";
import mockReadingBatch002 from "../server/mock-reading-batch-002.json" with { type: "json" };
import { questionBank } from "../server/question-bank.js";

const levelRank = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
const normalized = (value) => value.trim().toLocaleLowerCase("fr");

test("second TCF structure batch contains 50 complete progressive questions", () => {
  assert.equal(mockGrammarBatch002.length, 50);
  assert.deepEqual(mockGrammarBatch002.map((item) => item.id), Array.from({ length: 50 }, (_, index) => `mock-msl-${String(index + 51).padStart(3, "0")}`));
  assert.deepEqual([...new Set(mockGrammarBatch002.map((item) => item.level))], ["A1", "A2", "B1", "B2", "C1", "C2"]);
  for (const [index, question] of mockGrammarBatch002.entries()) {
    assert.equal(question.type, "grammar");
    assert.equal(question.exam, "tcf");
    assert.equal(question.source, "mock");
    assert.equal(question.batch, 2);
    assert.equal(question.answerVerified, true);
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map(normalized)).size, 4);
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4);
    assert.ok(question.prompt.includes("_"));
    assert.ok(question.explanation.length >= 45);
    if (index) {
      assert.ok(levelRank[question.level] >= levelRank[mockGrammarBatch002[index - 1].level]);
      assert.ok(question.difficulty >= mockGrammarBatch002[index - 1].difficulty);
    }
  }
});

test("second TCF reading batch contains 50 complete progressive questions", () => {
  assert.equal(mockReadingBatch002.length, 50);
  assert.deepEqual(mockReadingBatch002.map((item) => item.id), Array.from({ length: 50 }, (_, index) => `mock-reading-${String(index + 51).padStart(3, "0")}`));
  assert.deepEqual([...new Set(mockReadingBatch002.map((item) => item.level))], ["A1", "A2", "B1", "B2", "C1", "C2"]);
  for (const [index, question] of mockReadingBatch002.entries()) {
    assert.equal(question.type, "reading");
    assert.equal(question.exam, "tcf");
    assert.equal(question.source, "mock");
    assert.equal(question.batch, 2);
    assert.equal(question.answerVerified, true);
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map(normalized)).size, 4);
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4);
    assert.ok(question.prompt.trim().endsWith("?"));
    assert.ok(question.explanation.length >= 45);
    if (["C1", "C2"].includes(question.level)) assert.ok(question.passage.trim().split(/\s+/).length >= 130);
    if (index) {
      assert.ok(levelRank[question.level] >= levelRank[mockReadingBatch002[index - 1].level]);
      assert.ok(question.difficulty >= mockReadingBatch002[index - 1].difficulty);
    }
  }
});

test("second mock batches do not collide with the complete bank", () => {
  const ids = questionBank.map((question) => question.id);
  const grammarPrompts = questionBank.filter((question) => question.type === "grammar").map((question) => normalized(question.prompt));
  const readingPrompts = questionBank.filter((question) => question.type === "reading").map((question) => normalized(`${question.passage}\n${question.prompt}`));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(grammarPrompts).size, grammarPrompts.length);
  assert.equal(new Set(readingPrompts).size, readingPrompts.length);
});

test("second reading batch contains no editorial notes or numeric option labels", () => {
  for (const question of mockReadingBatch002) {
    assert.doesNotMatch(question.explanation, /(?:l'|L')option\s+[0-4]|régénérer|réexaminons/i);
  }
});
