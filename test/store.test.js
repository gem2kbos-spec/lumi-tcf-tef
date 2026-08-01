import test from "node:test";
import assert from "node:assert/strict";
import { reviewQuestions, summarize } from "../server/store.js";

test("summarize calculates accuracy and ranks weak skills", () => {
  const stats = summarize([
    { correct: true, skill: "subjonctif" },
    { correct: false, skill: "subjonctif" },
    { correct: false, skill: "subjonctif" },
    { correct: false, skill: "pronom_y" }
  ]);
  assert.equal(stats.accuracy, 25);
  assert.equal(stats.wrongCount, 3);
  assert.deepEqual(stats.weakSkills[0], { skill: "subjonctif", count: 2 });
});

test("summarize handles an empty history", () => {
  const stats = summarize([]);
  assert.equal(stats.total, 0);
  assert.equal(stats.accuracy, 0);
  assert.deepEqual(stats.weakSkills, []);
});

test("reviewQuestions keeps only the latest unresolved mistakes", () => {
  const question = { id: "q1", prompt: "Test" };
  const other = { id: "q2", prompt: "Other" };
  const result = reviewQuestions([
    { questionId: "q1", correct: false, createdAt: "2026-01-01", question },
    { questionId: "q2", correct: false, createdAt: "2026-01-02", question: other },
    { questionId: "q1", correct: true, createdAt: "2026-01-03", question }
  ]);
  assert.deepEqual(result, [other]);
});
