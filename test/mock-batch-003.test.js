import test from "node:test";
import assert from "node:assert/strict";
import mockGrammarBatch003 from "../server/mock-grammar-batch-003.json" with { type: "json" };
import mockReadingBatch003 from "../server/mock-reading-batch-003.json" with { type: "json" };
import { questionBank } from "../server/question-bank.js";

const rank = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
const norm = (value) => value.trim().toLocaleLowerCase("fr");

function verifyBatch(items, type, prefix) {
  assert.equal(items.length, 50);
  assert.deepEqual([...new Set(items.map((item) => item.level))], ["A1", "A2", "B1", "B2", "C1", "C2"]);
  for (const [index, question] of items.entries()) {
    assert.equal(question.id, `${prefix}-${String(index + 101).padStart(3, "0")}`);
    assert.equal(question.type, type);
    assert.equal(question.exam, "tcf");
    assert.equal(question.source, "mock");
    assert.equal(question.batch, 3);
    assert.equal(question.answerVerified, true);
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map(norm)).size, 4);
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4);
    assert.ok(question.explanation.length >= 35);
    if (type === "grammar") assert.match(question.prompt, /_+/);
    if (type === "reading") {
      assert.ok(question.prompt.endsWith("?"));
      assert.ok(question.passage.trim().split(/\s+/).length >= 8);
      assert.doesNotMatch(question.explanation, /(?:l'|L')option\s+[0-4]|régénérer|réexaminons/i);
      if (["C1", "C2"].includes(question.level)) assert.ok(question.passage.trim().split(/\s+/).length >= 130);
    }
    if (index) {
      assert.ok(rank[question.level] >= rank[items[index - 1].level]);
      assert.ok(question.difficulty >= items[index - 1].difficulty);
    }
  }
}

test("third TCF structure batch contains 50 validated progressive questions", () => verifyBatch(mockGrammarBatch003, "grammar", "mock-msl"));
test("third TCF reading batch contains 50 validated progressive questions", () => verifyBatch(mockReadingBatch003, "reading", "mock-reading"));

test("third batches remain unique across the full question bank", () => {
  const ids = questionBank.map((question) => question.id);
  const grammar = questionBank.filter((question) => question.type === "grammar").map((question) => norm(question.prompt));
  const reading = questionBank.filter((question) => question.type === "reading").map((question) => norm(`${question.passage}\n${question.prompt}`));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(grammar).size, grammar.length);
  assert.equal(new Set(reading).size, reading.length);
});

test("third structure batch has no known malformed blank patterns", () => {
  for (const question of mockGrammarBatch003) {
    const before = question.prompt.split(/_+/)[0];
    const after = question.prompt.split(/_+/)[1] || "";
    const correct = question.options[question.answer].trim();
    assert.doesNotMatch(`${before} ${correct} ${after}`, /\ben\s+en\s+\w+ant\b/i);
    assert.doesNotMatch(question.explanation, /peut-être une erreur|réfléchissez|réexaminons/i);
  }
});
