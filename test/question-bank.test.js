import test from "node:test";
import assert from "node:assert/strict";
import { questionBank } from "../server/question-bank.js";
import { blueprintFor } from "../server/tcf-blueprint.js";
import { validateGeneratedQuestions } from "../server/ai-generator.js";

test("all bank questions have one valid answer among four options", () => {
  for (const question of questionBank) {
    assert.equal(question.options.length, 4, question.id);
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4, question.id);
    assert.ok(question.explanation.length > 10, question.id);
  }
});

test("reading bank covers both target levels and always includes a document", () => {
  const reading = questionBank.filter((question) => question.type === "reading");
  assert.equal(reading.length, 10);
  assert.deepEqual(new Set(reading.map((question) => question.level)), new Set(["A2", "B1"]));
  assert.ok(reading.every((question) => question.passage && question.passage.split(/\s+/).length >= 20));
});

test("listening bank has playable scripts and exam coverage", () => {
  const listening = questionBank.filter((question) => question.type === "listening");
  assert.ok(listening.length >= 8);
  assert.ok(listening.every((question) => question.audioText.split(/\s+/).length >= 10));
  assert.ok(listening.some((question) => question.exam === "tcf"));
  assert.ok(listening.some((question) => question.exam === "tef"));
});

test("blueprint defines bounded reading skills and length for each level", () => {
  for (const level of ["A2", "B1"]) {
    const blueprint = blueprintFor("reading", level);
    assert.equal(blueprint.wordRange.length, 2);
    assert.ok(blueprint.skills.length >= 4);
    assert.ok(blueprint.documents.length >= 5);
  }
});

test("AI validator rejects reading passages outside the target range", () => {
  const question = { passage: "Texte trop court.", options: ["A", "B", "C", "D"] };
  assert.throws(() => validateGeneratedQuestions([question], { type: "reading", level: "B1", count: 1 }), /target length/);
});
