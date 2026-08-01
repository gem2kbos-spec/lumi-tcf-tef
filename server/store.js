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
  return {
    total,
    correct,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    wrongCount: total - correct,
    weakSkills: Object.entries(wrongBySkill)
      .sort((a, b) => b[1] - a[1])
      .map(([skill, count]) => ({ skill, count }))
  };
}
