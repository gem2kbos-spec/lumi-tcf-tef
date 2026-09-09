import assert from "node:assert/strict";
import test from "node:test";
import mockVocabularyBatch001 from "../server/mock-vocabulary-batch-001.json" with { type: "json" };
import { questionBank } from "../server/question-bank.js";
import { loadImportedQuestions } from "../server/imported-questions.js";

const normalized = (value) => String(value).trim().toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

test("new vocabulary batch contains exactly 77 complete questions", () => {
  assert.equal(mockVocabularyBatch001.length, 77);
  assert.ok(mockVocabularyBatch001.every((question) => question.type === "vocabulary" && ["A2", "B1"].includes(question.level)));
  assert.ok(mockVocabularyBatch001.every((question) => question.prompt && question.explanation && question.skill && question.topic));
  assert.ok(mockVocabularyBatch001.every((question) => question.options.length === 4 && question.answer >= 0 && question.answer < 4));
  assert.ok(mockVocabularyBatch001.every((question) => /[?？]|_{2,}|…{2,}|\.{3,}/.test(question.prompt)));
  assert.deepEqual([0, 1, 2, 3].map((answer) => mockVocabularyBatch001.filter((question) => question.answer === answer).length), [20, 19, 19, 19]);
  assert.equal(new Set(mockVocabularyBatch001.map((question) => normalized(question.prompt))).size, 77);
});

test("active bank has 1200 unique non-listening questions", async () => {
  const imported = await loadImportedQuestions(); const all = [...questionBank, ...imported];
  assert.equal(all.length, 1200);
  assert.equal(all.some((question) => question.type === "listening"), false);
  assert.equal(new Set(all.map((question) => normalized(`${question.passage || ""} ${question.prompt}`))).size, all.length);
  assert.deepEqual(Object.fromEntries(["grammar", "vocabulary", "reading"].map((type) => [type, all.filter((question) => question.type === type).length])), { grammar: 484, vocabulary: 307, reading: 409 });
});
