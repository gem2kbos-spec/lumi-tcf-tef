import test from "node:test";
import assert from "node:assert/strict";
import { activitySummary, importedProgress, reviewQuestions, sequenceProgress, summarize, weakSkillForType } from "../server/store.js";

test("summarize calculates accuracy and ranks weak skills", () => {
  const stats = summarize([
    { correct: true, type: "grammar", skill: "subjonctif" },
    { correct: false, type: "grammar", skill: "subjonctif" },
    { correct: false, type: "grammar", skill: "subjonctif" },
    { correct: false, type: "grammar", skill: "pronom_y" }
  ]);
  assert.equal(stats.accuracy, 25);
  assert.equal(stats.wrongCount, 3);
  assert.equal(stats.weakSkills[0].skill, "subjonctif");
  assert.equal(stats.weakSkills[0].title, "虚拟式的触发与变位");
  assert.equal(stats.weakSkills[0].count, 2); assert.equal(stats.weakSkills[0].total, 3); assert.equal(stats.weakSkills[0].errorRate, 67);
});

test("diagnosis separates depuis continuity from futur proche", () => {
  const stats = summarize([
    { correct: false, type: "grammar", skill: "verb_tenses", question: { prompt: "Il habite ici ___ 2020.", options: ["depuis", "pendant"], answer: 0 } },
    { correct: false, type: "grammar", skill: "verb_tenses", question: { prompt: "Demain, nous ___ visiter Lyon.", options: ["allons", "avons"], answer: 0 } }
  ]);
  assert.equal(stats.weakSkills.length, 2);
  assert.deepEqual(new Set(stats.weakSkills.map((item) => item.diagnosticId)), new Set(["time:depuis-present-continuity", "tense:futur-proche"]));
});

test("weak skills keep grammar and reading mistakes separate", () => {
  const stats = summarize([
    { correct: false, type: "grammar", skill: "inference" },
    { correct: false, type: "reading", skill: "inference" }
  ]);
  assert.equal(stats.weakSkills.length, 2);
  assert.deepEqual(new Set(stats.weakSkills.map((item) => item.type)), new Set(["grammar", "reading"]));
  assert.equal(weakSkillForType(stats.weakSkills, "reading"), "inference");
  assert.equal(weakSkillForType(stats.weakSkills, "listening"), null);
});

test("summarize handles an empty history", () => {
  const stats = summarize([]);
  assert.equal(stats.total, 0);
  assert.equal(stats.accuracy, 0);
  assert.deepEqual(stats.weakSkills, []);
});

test("streak uses the learner timezone around midnight", () => {
  const stats = summarize([
    { correct: true, type: "grammar", skill: "present", createdAt: "2026-08-06T16:30:00.000Z" }
  ], new Date("2026-08-06T17:00:00.000Z"), "Asia/Shanghai");
  assert.equal(stats.streak, 1);
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

test("importedProgress counts each source question only once", () => {
  const result = importedProgress([
    { questionId: "real-1" }, { questionId: "real-1" }, { questionId: "ai-1" }
  ], [{ id: "real-1" }, { id: "real-2" }]);
  assert.deepEqual(result, { completed: 1, total: 2, percentage: 50 });
});

test("sequenceProgress reports the selected practice range", () => {
  const result = sequenceProgress([{ questionId: "q1" }, { questionId: "q1" }], [{ id: "q1" }, { id: "q2" }, { id: "q3" }]);
  assert.deepEqual(result, { completed: 1, total: 3, remaining: 2 });
});

test("activitySummary separates authentic and generated history for today", () => {
  const attempts = [
    { questionId: "real-1", correct: true, createdAt: "2026-08-07T01:00:00.000Z", question: { source: "user_imported" } },
    { questionId: "real-1", correct: false, createdAt: "2026-08-07T02:00:00.000Z", question: { source: "user_imported" } },
    { questionId: "ai-1", correct: true, createdAt: "2026-08-07T03:00:00.000Z", question: { source: "ai_variation" } },
    { questionId: "ai-old", correct: true, createdAt: "2026-08-05T03:00:00.000Z", question: { source: "ai_supplement" } }
  ];
  const result = activitySummary(attempts, [{ id: "real-1" }, { id: "real-2" }], new Date("2026-08-07T04:00:00.000Z"), "Asia/Shanghai");
  assert.equal(result.historicAuthentic, 1); assert.equal(result.historicGenerated, 2);
  assert.equal(result.todayAuthentic, 1); assert.equal(result.todayGenerated, 1);
  assert.equal(result.todayTotal, 3); assert.equal(result.todayAccuracy, 67); assert.equal(result.authenticPercentage, 50);
});

test("activitySummary excludes removed authentic questions from current-bank progress", () => {
  const attempts = [
    { questionId: "kept-1", correct: true, createdAt: "2026-08-07T01:00:00.000Z", question: { source: "user_imported" } },
    { questionId: "removed-1", correct: true, createdAt: "2026-08-07T02:00:00.000Z", question: { source: "user_imported" } }
  ];
  const result = activitySummary(attempts, [{ id: "kept-1" }, { id: "kept-2" }], new Date("2026-08-07T04:00:00.000Z"), "Asia/Shanghai");
  assert.equal(result.historicAuthentic, 1);
  assert.equal(result.todayAuthentic, 1);
  assert.equal(result.authenticPercentage, 50);
  assert.equal(result.todayTotal, 2, "历史记录本身仍应保留");
});
