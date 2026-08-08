import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const journalFile = path.resolve("server/data/knowledge-journal.json");

async function readJournal() {
  try { return JSON.parse(await readFile(journalFile, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return { entries: [] }; throw error; }
}

export async function listJournalEntries() {
  return (await readJournal()).entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addJournalEntry(entry) {
  const journal = await readJournal();
  const saved = {
    id: crypto.randomUUID(), kind: entry.kind === "mistake" ? "mistake" : "question",
    title: String(entry.title || "法语知识点").slice(0, 120),
    question: String(entry.question || "").slice(0, 1000),
    content: String(entry.content || "").slice(0, 5000),
    skill: String(entry.skill || "").slice(0, 100), questionId: entry.questionId || null,
    meta: entry.meta && typeof entry.meta === "object" ? { type: String(entry.meta.type || ""), level: String(entry.meta.level || ""), source: String(entry.meta.source || ""), category: String(entry.meta.category || "").slice(0, 120) } : null,
    createdAt: new Date().toISOString()
  };
  journal.entries.unshift(saved);
  await mkdir(path.dirname(journalFile), { recursive: true });
  await writeFile(journalFile, JSON.stringify(journal, null, 2));
  return saved;
}
