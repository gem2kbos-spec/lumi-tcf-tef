import test from "node:test";
import assert from "node:assert/strict";
import { summarize } from "../server/store.js";

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
  assert.deepEqual(summarize([]), { total: 0, correct: 0, accuracy: 0, wrongCount: 0, weakSkills: [] });
});
