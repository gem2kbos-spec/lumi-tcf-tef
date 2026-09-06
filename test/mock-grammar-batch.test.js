import test from "node:test";
import assert from "node:assert/strict";
import { mockGrammarBatch001 } from "../server/mock-grammar-batch-001.js";
import { questionBank } from "../server/question-bank.js";

test("first TCF structure mock batch contains exactly 50 usable questions", () => {
  assert.equal(mockGrammarBatch001.length, 50);
  assert.deepEqual(mockGrammarBatch001.map((item) => item.id), Array.from({ length: 50 }, (_, index) => `mock-msl-${String(index + 1).padStart(3, "0")}`));
  for (const question of mockGrammarBatch001) {
    assert.equal(question.type, "grammar");
    assert.equal(question.exam, "tcf");
    assert.equal(question.source, "mock");
    assert.equal(question.answerVerified, true);
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map((option) => option.trim().toLocaleLowerCase("fr"))).size, 4);
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4);
    assert.ok(question.prompt.includes("_"));
    assert.ok(question.explanation.length >= 35);
  }
});

test("first TCF structure mock batch progresses from A1 to C2 without difficulty regression", () => {
  assert.deepEqual([...new Set(mockGrammarBatch001.map((item) => item.level))], ["A1", "A2", "B1", "B2", "C1", "C2"]);
  for (let index = 1; index < mockGrammarBatch001.length; index++) assert.ok(mockGrammarBatch001[index].difficulty >= mockGrammarBatch001[index - 1].difficulty);
});

test("mock questions have no duplicate prompt or collision with the rest of the bank", () => {
  const prompts = questionBank.map((question) => question.prompt.trim().toLocaleLowerCase("fr"));
  const ids = questionBank.map((question) => question.id);
  assert.equal(new Set(prompts).size, prompts.length);
  assert.equal(new Set(ids).size, ids.length);
});

test("mock source can be distinguished from authentic and curated questions", () => {
  assert.ok(mockGrammarBatch001.every((question) => question.source === "mock"));
  assert.ok(questionBank.some((question) => question.source === "mock"));
});
