import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve("server/data");
const progressFile = path.join(dataDir, "progress.json");
const emptyProgress = { attempts: [] };

export async function readProgress() {
  try {
    return JSON.parse(await readFile(progressFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return structuredClone(emptyProgress);
    throw error;
  }
}

export async function addAttempt(attempt) {
  const progress = await readProgress();
  progress.attempts.push(attempt);
  await mkdir(dataDir, { recursive: true });
  await writeFile(progressFile, JSON.stringify(progress, null, 2));
  return attempt;
}

export function summarize(attempts, now = new Date(), timeZone = "Asia/Shanghai") {
  const total = attempts.length;
  const correct = attempts.filter((item) => item.correct).length;
  const wrongBySkill = {};
  for (const item of attempts.filter((entry) => !entry.correct)) {
    const key = `${item.type || "unknown"}:${item.skill}`;
    wrongBySkill[key] ||= { type: item.type || "unknown", skill: item.skill, count: 0 };
    wrongBySkill[key].count++;
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
    weakSkills: Object.values(wrongBySkill).sort((a, b) => b.count - a.count)
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

export function activitySummary(attempts, importedQuestions, now = new Date(), timeZone = "Asia/Shanghai") {
  const authenticIds = new Set(importedQuestions.map((question) => question.id));
  const dateKey = (value) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  const todayKey = dateKey(now); const todayAttempts = attempts.filter((attempt) => attempt.createdAt && dateKey(attempt.createdAt) === todayKey);
  const uniqueIds = (entries, predicate) => new Set(entries.filter(predicate).map((attempt) => attempt.questionId)).size;
  const authentic = (attempt) => authenticIds.has(attempt.questionId) || attempt.question?.source === "user_imported";
  const generated = (attempt) => String(attempt.question?.source || "").startsWith("ai");
  const todayCorrect = todayAttempts.filter((attempt) => attempt.correct).length;
  const historicAuthentic = uniqueIds(attempts, authentic);
  return {
    historicAuthentic, historicGenerated: uniqueIds(attempts, generated),
    todayAuthentic: uniqueIds(todayAttempts, authentic), todayGenerated: uniqueIds(todayAttempts, generated),
    todayTotal: todayAttempts.length, todayAccuracy: todayAttempts.length ? Math.round(todayCorrect / todayAttempts.length * 100) : 0,
    authenticTotal: authenticIds.size, authenticPercentage: authenticIds.size ? Math.round(historicAuthentic / authenticIds.size * 100) : 0,
    lastActivityAt: attempts.length ? [...attempts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt : null
  };
}
