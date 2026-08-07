import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { questionBank } from "./question-bank.js";
import { loadImportedQuestions } from "./imported-questions.js";
import { addAttempt, importedProgress, readProgress, reviewQuestions, summarize } from "./store.js";
import { generateQuestions } from "./ai-generator.js";

const port = Number(process.env.PORT || 3000);
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const sessions = new Map();

function sendJson(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function publicQuestion(question) {
  const { answer, explanation, ...safe } = question;
  return safe;
}

function sample(items, count) {
  return [...items].sort(() => Math.random() - 0.5).slice(0, count)
    .sort((a, b) => ({ A2: 0, B1: 1 }[a.level] - ({ A2: 0, B1: 1 }[b.level])));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, aiEnabled: Boolean(process.env.OPENAI_API_KEY) });
    }
    if (req.method === "GET" && url.pathname === "/api/stats") {
      const progress = await readProgress();
      const imported = await loadImportedQuestions();
      return sendJson(res, 200, { ...summarize(progress.attempts), imported: importedProgress(progress.attempts, imported) });
    }
    if (req.method === "POST" && url.pathname === "/api/questions") {
      const input = await body(req);
      const type = ["vocabulary", "grammar", "mixed", "reading", "listening", "review"].includes(input.type) ? input.type : "grammar";
      const exam = ["tcf", "tef"].includes(input.exam) ? input.exam : "tcf";
      const level = ["A2", "B1"].includes(input.level) ? input.level : "B1";
      const count = Math.min(Math.max(Number(input.count) || 5, 1), 10);
      const excludeIds = new Set(Array.isArray(input.excludeIds) ? input.excludeIds.slice(-20) : []);
      const progress = await readProgress();
      const imported = await loadImportedQuestions();
      const mergedBank = [...questionBank.map((question) => ({ source: "curated", ...question })), ...imported];
      const weakSkills = summarize(progress.attempts).weakSkills.slice(0, 3).map((item) => item.skill);
      let questions;
      let mode = "bank";
      let notice = "";
      if (type === "review") {
        questions = reviewQuestions(progress.attempts, count);
        mode = "review";
      } else if (input.useAI !== false && process.env.OPENAI_API_KEY) {
        try {
          questions = await generateQuestions({ type: type === "mixed" ? "grammar" : type, level, count, weakSkills });
          mode = "ai";
        } catch (error) {
          console.error("AI generation failed, using question bank:", error.message);
          const matching = mergedBank.filter((item) => (type === "mixed" ? ["grammar", "vocabulary"].includes(item.type) : item.type === type) && [level, "A2"].includes(item.level));
          const unseen = matching.filter((item) => !excludeIds.has(item.id));
          questions = sample(unseen.length ? unseen : matching, count);
          notice = "AI 暂时不可用，已自动切换到精选题库。";
        }
      } else {
        const matching = mergedBank.filter((item) => (type === "mixed" ? ["grammar", "vocabulary"].includes(item.type) : item.type === type) && [level, "A2"].includes(item.level));
        const completedIds = new Set(progress.attempts.map((attempt) => attempt.questionId));
        const nextImported = matching.filter((item) => item.source === "user_imported" && !completedIds.has(item.id)).sort((a, b) => a.order - b.order);
        const unseen = matching.filter((item) => !excludeIds.has(item.id));
        questions = nextImported.length ? nextImported.slice(0, count) : sample(unseen.length ? unseen : matching, count);
      }
      for (const question of questions) sessions.set(question.id, question);
      return sendJson(res, 200, { mode, notice, questions: questions.map(publicQuestion) });
    }
    if (req.method === "POST" && url.pathname === "/api/variations") {
      if (!process.env.OPENAI_API_KEY) return sendJson(res, 503, { error: "AI_KEY_REQUIRED" });
      const input = await body(req);
      const imported = await loadImportedQuestions();
      const reference = sessions.get(input.questionId) || [...questionBank, ...imported].find((item) => item.id === input.questionId);
      if (!reference) return sendJson(res, 404, { error: "Question not found" });
      const generated = await generateQuestions({ type: reference.type, level: reference.level, count: 1, weakSkills: [reference.skill], referenceQuestion: reference });
      const variation = { ...generated[0], source: "ai_variation", parentQuestionId: reference.id };
      sessions.set(variation.id, variation);
      return sendJson(res, 201, { question: publicQuestion(variation) });
    }
    if (req.method === "POST" && url.pathname === "/api/attempts") {
      const input = await body(req);
      const imported = await loadImportedQuestions();
      const question = sessions.get(input.questionId) || [...questionBank, ...imported].find((item) => item.id === input.questionId);
      if (!question || !Number.isInteger(input.selected) || input.selected < 0 || input.selected > 3) return sendJson(res, 400, { error: "Invalid attempt" });
      const correct = input.selected === question.answer;
      const attempt = {
        id: crypto.randomUUID(), questionId: question.id, type: question.type,
        exam: ["tcf", "tef"].includes(input.exam) ? input.exam : "tcf",
        skill: question.skill, selected: input.selected, correct, createdAt: new Date().toISOString(),
        question
      };
      await addAttempt(attempt);
      return sendJson(res, 201, { correct, answer: question.answer, explanation: question.explanation });
    }
    const requested = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.join(publicDir, requested);
    if (!filePath.startsWith(publicDir)) return sendJson(res, 403, { error: "Forbidden" });
    const content = await readFile(filePath);
    const contentType = filePath.endsWith(".css") ? "text/css" : filePath.endsWith(".js") ? "text/javascript" : "text/html";
    res.writeHead(200, { "Content-Type": `${contentType}; charset=utf-8` });
    res.end(content);
  } catch (error) {
    if (error.code === "ENOENT") return sendJson(res, 404, { error: "Not found" });
    console.error(error);
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, () => console.log(`Lumi TCF is ready at http://localhost:${port}`));
