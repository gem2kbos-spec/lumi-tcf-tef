import test from "node:test";
import assert from "node:assert/strict";
import mockReadingBatch001 from "../server/mock-reading-batch-001.json" with { type: "json" };
import { questionBank } from "../server/question-bank.js";

const levels = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

test("first TCF reading mock batch contains exactly 50 complete items", () => {
  assert.equal(mockReadingBatch001.length, 50);
  for (const [index, question] of mockReadingBatch001.entries()) {
    assert.equal(question.id, `mock-reading-${String(index + 1).padStart(3, "0")}`);
    assert.equal(question.type, "reading");
    assert.equal(question.exam, "tcf");
    assert.equal(question.source, "mock");
    assert.equal(question.answerVerified, true);
    assert.equal(question.options.length, 4);
    assert.equal(new Set(question.options.map((option) => option.trim().toLocaleLowerCase("fr"))).size, 4);
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4);
    assert.ok(question.passage.trim().split(/\s+/).length >= 8);
    assert.ok(question.prompt.trim().endsWith("?"));
    assert.ok(question.explanation.length >= 45);
  }
});

test("reading mock items progress from A1 to C2 and difficulty 1 to 10", () => {
  assert.deepEqual([...new Set(mockReadingBatch001.map((item) => item.level))], ["A1", "A2", "B1", "B2", "C1", "C2"]);
  assert.equal(mockReadingBatch001[0].difficulty, 1);
  assert.equal(mockReadingBatch001.at(-1).difficulty, 10);
  for (let index = 1; index < mockReadingBatch001.length; index++) {
    assert.ok(levels[mockReadingBatch001[index].level] >= levels[mockReadingBatch001[index - 1].level]);
    assert.ok(mockReadingBatch001[index].difficulty >= mockReadingBatch001[index - 1].difficulty);
  }
});

test("advanced reading items use substantial argumentative documents", () => {
  for (const question of mockReadingBatch001.filter((item) => ["C1", "C2"].includes(item.level))) {
    assert.ok(question.passage.trim().split(/\s+/).length >= 130);
    assert.ok(["idee_principale", "intention_auteur", "inference", "cause_consequence"].includes(question.skill));
  }
});

test("reading mock prompts and ids do not collide with the full bank", () => {
  const ids = questionBank.map((question) => question.id);
  const readingPrompts = questionBank.filter((question) => question.type === "reading").map((question) => `${question.passage}\n${question.prompt}`.toLocaleLowerCase("fr"));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(readingPrompts).size, readingPrompts.length);
});
