import path from "node:path";
import { examDiagnostic } from "./exam-diagnostics.js";
import { readDocument, writeDocument } from "./persistence.js";

const dataDir = path.resolve("server/data");
const emptyProgress = { attempts: [] };

function progressFile(storageKey = "legacy") {
  return storageKey === "legacy" ? path.join(dataDir, "progress.json") : path.join(dataDir, "users", String(storageKey).replace(/[^a-z0-9-]/gi, ""), "progress.json");
}

export async function readProgress(storageKey = "legacy") {
  return readDocument(`progress:${storageKey}`, emptyProgress, progressFile(storageKey));
}

export async function addAttempt(attempt, storageKey = "legacy") {
  const progress = await readProgress(storageKey);
  progress.attempts.push(attempt);
  await writeDocument(`progress:${storageKey}`, progress, progressFile(storageKey));
  return attempt;
}

export async function attachAttemptAnalysis(attemptId, analysis, storageKey = "legacy") {
  const progress = await readProgress(storageKey);
  const attempt = progress.attempts.find((item) => item.id === attemptId);
  if (!attempt) return null;
  attempt.analysis = analysis; attempt.analysisVersion = 2;
  await writeDocument(`progress:${storageKey}`, progress, progressFile(storageKey));
  return attempt;
}

export function summarize(attempts, now = new Date(), timeZone = "Asia/Shanghai") {
  const total = attempts.length;
  const correct = attempts.filter((item) => item.correct).length;
  const wrongBySkill = {};
  for (const item of attempts) {
    const diagnostic = examDiagnostic(item);
    const key = `${item.type || "unknown"}:${diagnostic.id}`;
    wrongBySkill[key] ||= { type: item.type || "unknown", skill: item.skill, diagnosticId: diagnostic.id, category: diagnostic.category, examAbility: diagnostic.examAbility, title: diagnostic.title, errorType: diagnostic.errorType, action: diagnostic.action, count: 0, total: 0, latestReason: "" };
    wrongBySkill[key].total++;
    if (!item.correct) { wrongBySkill[key].count++; wrongBySkill[key].latestReason = item.analysis?.errorReasonZh || wrongBySkill[key].latestReason; wrongBySkill[key].errorType = diagnostic.errorType; wrongBySkill[key].action = diagnostic.action; }
  }
  const byType = Object.fromEntries(["grammar", "vocabulary", "reading", "listening"].map((type) => {
    const entries = attempts.filter((item) => item.type === type);
    const right = entries.filter((item) => item.correct).length;
    return [type, { total: entries.length, accuracy: entries.length ? Math.round(right / entries.length * 100) : 0 }];
  }));
  const dateKey = (value) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  const days = [...new Set(attempts.map((item) => item.createdAt).filter(Boolean).map(dateKey))].sort().reverse();
  let streak = 0;
  let offset = 0;
  const today = dateKey(now);
  if (days[0] !== today) offset = 1;
  for (let index = 0; index < days.length; index++) {
    const expectedDay = dateKey(new Date(now.getTime() - (index + offset) * 86400000));
    if (days[index] === expectedDay) streak++;
    else break;
  }
  return {
    total,
    correct,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    wrongCount: total - correct,
    pendingReview: reviewQuestions(attempts, Number.MAX_SAFE_INTEGER).length,
    streak,
    byType,
    weakSkills: Object.values(wrongBySkill).filter((item) => item.count > 0).map((item) => ({ ...item, errorRate: Math.round(item.count / item.total * 100) })).sort((a, b) => b.count - a.count || b.errorRate - a.errorRate)
  };
}

export function reviewQuestions(attempts, count = 10) {
  const latestByQuestion = new Map();
  for (const attempt of attempts) latestByQuestion.set(attempt.questionId, attempt);
  return [...latestByQuestion.values()]
    .filter((attempt) => !attempt.correct && attempt.question)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, count)
    .map((attempt) => attempt.question);
}

export function weakSkillForType(weakSkills, type) {
  return weakSkills.find((item) => item.type === type)?.skill || null;
}

export function importedProgress(attempts, importedQuestions) {
  const ids = new Set(importedQuestions.map((question) => question.id));
  const completed = new Set(attempts.filter((attempt) => ids.has(attempt.questionId)).map((attempt) => attempt.questionId));
  return {
    completed: completed.size,
    total: ids.size,
    percentage: ids.size ? Math.round(completed.size / ids.size * 100) : 0
  };
}

export function sequenceProgress(attempts, questions) {
  const completedIds = new Set(attempts.map((attempt) => attempt.questionId));
  const completed = questions.filter((question) => completedIds.has(question.id)).length;
  return { completed, total: questions.length, remaining: Math.max(0, questions.length - completed) };
}

export function activitySummary(attempts, importedQuestions, now = new Date(), timeZone = "Asia/Shanghai", bankQuestions = importedQuestions) {
  const authenticIds = new Set(importedQuestions.map((question) => question.id));
  const bankIds = new Set(bankQuestions.map((question) => question.id));
  const dateKey = (value) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  const todayKey = dateKey(now); const todayAttempts = attempts.filter((attempt) => attempt.createdAt && dateKey(attempt.createdAt) === todayKey);
  const uniqueIds = (entries, predicate) => new Set(entries.filter(predicate).map((attempt) => attempt.questionId)).size;
  // Progress is defined against the current cleaned bank. Historical attempts
  // for questions removed during quality audits remain in history, but must not
  // inflate the current-bank completion numerator.
  const authentic = (attempt) => authenticIds.has(attempt.questionId);
  const generated = (attempt) => String(attempt.question?.source || "").startsWith("ai");
  const todayCorrect = todayAttempts.filter((attempt) => attempt.correct).length;
  const historicAuthentic = uniqueIds(attempts, authentic);
  const inBank = (attempt) => bankIds.has(attempt.questionId);
  const historicBank = uniqueIds(attempts, inBank);
  return {
    historicAuthentic, historicGenerated: uniqueIds(attempts, generated),
    todayAuthentic: uniqueIds(todayAttempts, authentic), todayGenerated: uniqueIds(todayAttempts, generated),
    todayTotal: todayAttempts.length, todayAccuracy: todayAttempts.length ? Math.round(todayCorrect / todayAttempts.length * 100) : 0,
    authenticTotal: authenticIds.size, authenticPercentage: authenticIds.size ? Math.round(historicAuthentic / authenticIds.size * 100) : 0,
    historicBank, todayBank: uniqueIds(todayAttempts, inBank), bankTotal: bankIds.size,
    bankPercentage: bankIds.size ? Math.round(historicBank / bankIds.size * 100) : 0,
    lastActivityAt: attempts.length ? [...attempts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt : null
  };
}
