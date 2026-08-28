import path from "node:path";
import { readDocument, writeDocument } from "./persistence.js";

const localFile = path.resolve("server/data/analysis-cache.json");
const cacheKey = "analysis-cache:v3";
const emptyCache = { version: 3, entries: {} };

export async function readCachedAnalysis(questionId, selected) {
  const cache = await readDocument(cacheKey, emptyCache, localFile);
  return cache.entries?.[`${questionId}:${selected}`] || null;
}

export async function cacheAnalysis(questionId, selected, analysis) {
  const cache = await readDocument(cacheKey, emptyCache, localFile);
  cache.version = 3; cache.entries ||= {};
  cache.entries[`${questionId}:${selected}`] = { analysis, updatedAt: new Date().toISOString() };
  await writeDocument(cacheKey, cache, localFile);
  return analysis;
}
