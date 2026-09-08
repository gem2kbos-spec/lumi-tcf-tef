import test from "node:test";
import assert from "node:assert/strict";
import grammar from "../server/mock-grammar-batch-004.json" with { type: "json" };
import reading from "../server/mock-reading-batch-004.json" with { type: "json" };
import { questionBank } from "../server/question-bank.js";
import { validateGeneratedQuestions } from "../server/ai-generator.js";

const norm = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/\s+/g, " ").trim();

function verify(items, type, prefix) {
  assert.equal(items.length, 50);
  assert.equal(items.filter((item) => item.level === "A2").length, 25);
  assert.equal(items.filter((item) => item.level === "B1").length, 25);
  assert.deepEqual([0, 1, 2, 3].map((answer) => items.filter((item) => item.answer === answer).length), [13, 13, 12, 12]);
  items.forEach((item, index) => {
    assert.equal(item.id, `${prefix}-${String(index + 151).padStart(3, "0")}`);
    assert.equal(item.type, type);
    assert.equal(item.exam, "tcf");
    assert.equal(item.source, "mock");
    assert.equal(item.batch, 4);
    assert.equal(item.answerVerified, true);
    assert.equal(item.options.length, 4);
    assert.equal(new Set(item.options.map(norm)).size, 4);
    assert.ok(Number.isInteger(item.answer) && item.answer >= 0 && item.answer < 4);
    assert.ok(item.explanation.length >= 35);
    if (type === "grammar") assert.match(item.prompt, /_{2,}/);
    if (type === "reading") assert.ok(item.passage.trim().split(/\s+/).length >= 25);
  });
  validateGeneratedQuestions(items.slice(0, 25), { type, level: "A2", count: 25 });
  validateGeneratedQuestions(items.slice(25), { type, level: "B1", count: 25 });
}

test("fourth TCF grammar batch contains 50 audited A2-B1 questions", () => verify(grammar, "grammar", "mock-msl"));
test("fourth TCF reading batch contains 50 audited A2-B1 questions", () => verify(reading, "reading", "mock-reading"));

test("fourth batch remains unique across the complete bank", () => {
  const ids = questionBank.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  const grammarPrompts = questionBank.filter((item) => item.type === "grammar").map((item) => norm(item.prompt));
  const readingPrompts = questionBank.filter((item) => item.type === "reading").map((item) => norm(`${item.passage}\n${item.prompt}`));
  assert.equal(new Set(grammarPrompts).size, grammarPrompts.length);
  assert.equal(new Set(readingPrompts).size, readingPrompts.length);
});
