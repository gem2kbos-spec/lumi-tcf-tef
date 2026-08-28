import path from "node:path";
import { readDocument, writeDocument } from "./persistence.js";

const localFile = path.resolve("server/data/analysis-cache.json");
const emptyCache = { version: 2, entries: {} };

export async function readCachedAnalysis(questionId, selected) {
  const cache = await readDocument("analysis-cache:v2", emptyCache, localFile);
  return cache.entries?.[`${questionId}:${selected}`] || null;
}

export async function cacheAnalysis(questionId, selected, analysis) {
  const cache = await readDocument("analysis-cache:v2", emptyCache, localFile);
  cache.version = 2; cache.entries ||= {};
  cache.entries[`${questionId}:${selected}`] = { analysis, updatedAt: new Date().toISOString() };
  await writeDocument("analysis-cache:v2", cache, localFile);
  return analysis;
}
