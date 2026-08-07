import { readFile } from "node:fs/promises";
import path from "node:path";
import { categoryFor } from "./question-taxonomy.js";

const importsFile = path.resolve("server/imports/questions.json");

export async function loadImportedQuestions() {
  try {
    const questions = JSON.parse(await readFile(importsFile, "utf8"));
    if (!Array.isArray(questions)) throw new Error("Imported question file must contain an array.");
    validateImportedQuestions(questions);
    return questions.map((question, index) => ({
      ...question,
      id: question.id || `imported-${index + 1}`,
      source: "user_imported",
      category: categoryFor(question),
      order: Number.isFinite(question.order) ? question.order : index + 1
    }));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export function validateImportedQuestions(questions) {
  const allowedTypes = new Set(["vocabulary", "grammar", "reading", "listening"]);
  const ids = new Set();
  for (const [index, question] of questions.entries()) {
    const label = question.id || `第 ${index + 1} 题`;
    if (!allowedTypes.has(question.type)) throw new Error(`${label}: unsupported type`);
    if (!question.skill || !question.prompt || !question.explanation) throw new Error(`${label}: missing required text`);
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 5) throw new Error(`${label}: two to five options required`);
    if (question.answer !== null && (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length)) throw new Error(`${label}: invalid answer index`);
    if (question.id && ids.has(question.id)) throw new Error(`${label}: duplicate id`);
    if (question.id) ids.add(question.id);
    if (question.type === "reading" && !question.passage) throw new Error(`${label}: reading passage required`);
    if (question.type === "listening" && !question.audioText) throw new Error(`${label}: audioText required`);
  }
  return true;
}
