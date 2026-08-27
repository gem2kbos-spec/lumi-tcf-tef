import path from "node:path";
import { readDocument, writeDocument } from "./persistence.js";

const dataDir = path.resolve("server/data");
const journalFile = (storageKey = "legacy") => storageKey === "legacy" ? path.join(dataDir, "knowledge-journal.json") : path.join(dataDir, "users", String(storageKey).replace(/[^a-z0-9-]/gi, ""), "knowledge-journal.json");

async function readJournal(storageKey = "legacy") {
  return readDocument(`journal:${storageKey}`, { entries: [] }, journalFile(storageKey));
}

export async function listJournalEntries(storageKey = "legacy") {
  return (await readJournal(storageKey)).entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addJournalEntry(entry, storageKey = "legacy") {
  const journal = await readJournal(storageKey);
  const saved = {
    id: crypto.randomUUID(), kind: entry.kind === "mistake" ? "mistake" : "question",
    title: String(entry.title || "法语知识点").slice(0, 120),
    question: String(entry.question || "").slice(0, 1000),
    content: String(entry.content || "").slice(0, 5000),
    skill: String(entry.skill || "").slice(0, 100), questionId: entry.questionId || null,
    subtype: entry.kind !== "mistake" && /\|\s*:?-{3,}/.test(String(entry.content || "")) ? "quick-reference" : "explanation",
    meta: entry.meta && typeof entry.meta === "object" ? { type: String(entry.meta.type || ""), level: String(entry.meta.level || ""), source: String(entry.meta.source || ""), category: String(entry.meta.category || "").slice(0, 120) } : null,
    createdAt: new Date().toISOString()
  };
  journal.entries.unshift(saved);
  await writeDocument(`journal:${storageKey}`, journal, journalFile(storageKey));
  return saved;
}
