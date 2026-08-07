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

export function summarize(attempts) {
  const total = attempts.length;
  const correct = attempts.filter((item) => item.correct).length;
  const wrongBySkill = {};
  for (const item of attempts.filter((entry) => !entry.correct)) {
    wrongBySkill[item.skill] = (wrongBySkill[item.skill] || 0) + 1;
  }
  const byType = Object.fromEntries(["grammar", "vocabulary", "reading", "listening"].map((type) => {
    const entries = attempts.filter((item) => item.type === type);
    const right = entries.filter((item) => item.correct).length;
    return [type, { total: entries.length, accuracy: entries.length ? Math.round(right / entries.length * 100) : 0 }];
  }));
  const days = [...new Set(attempts.map((item) => item.createdAt?.slice(0, 10)).filter(Boolean))].sort().reverse();
  let streak = 0;
  const cursor = new Date();
  for (let index = 0; index < days.length; index++) {
    const expected = new Date(cursor);
    expected.setDate(cursor.getDate() - index);
    const expectedDay = expected.toISOString().slice(0, 10);
    if (days[index] === expectedDay) streak++;
    else if (index === 0) {
      cursor.setDate(cursor.getDate() - 1);
      index--;
    } else break;
  }
  return {
    total,
    correct,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    wrongCount: total - correct,
    pendingReview: reviewQuestions(attempts, Number.MAX_SAFE_INTEGER).length,
    streak,
    byType,
    weakSkills: Object.entries(wrongBySkill)
      .sort((a, b) => b[1] - a[1])
      .map(([skill, count]) => ({ skill, count }))
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

export function importedProgress(attempts, importedQuestions) {
  const ids = new Set(importedQuestions.map((question) => question.id));
  const completed = new Set(attempts.filter((attempt) => ids.has(attempt.questionId)).map((attempt) => attempt.questionId));
  return {
    completed: completed.size,
    total: ids.size,
    percentage: ids.size ? Math.round(completed.size / ids.size * 100) : 0
  };
}
