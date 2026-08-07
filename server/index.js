import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { questionBank } from "./question-bank.js";
import { loadImportedQuestions } from "./imported-questions.js";
import { addAttempt, importedProgress, readProgress, reviewQuestions, summarize } from "./store.js";
import { generateQuestions } from "./ai-generator.js";
import { buildAttemptAnalysis } from "./knowledge-base.js";
import { blueprintFor } from "./tcf-blueprint.js";
import { aiLookup, listVocabulary, localLookup, saveVocabulary, toggleMastered } from "./vocabulary-store.js";
import { getKnowledgeTopic, knowledgeTopics } from "./knowledge-topics.js";
import { categoriesFor, categoryFor } from "./question-taxonomy.js";

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
    .sort((a, b) => ({ A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 }[a.level] - ({ A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 }[b.level])));
}

function normalizedQuestion(question, source = question.source || "curated") {
  const levelDifficulty = { A1: 1, A2: 3, B1: 5, B2: 7, C1: 9, C2: 10 };
  return { source, ...question, category: categoryFor(question), difficulty: question.difficulty || levelDifficulty[question.level] || 5, answerVerified: question.answerVerified ?? question.answer !== null };
}

function responseText(payload) {
  return payload.output_text ?? payload.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
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
    if (req.method === "GET" && url.pathname === "/api/bank") {
      const imported = await loadImportedQuestions();
      const progress = await readProgress();
      const completedIds = new Set(progress.attempts.map((attempt) => attempt.questionId));
      const merged = [...imported.map((question) => normalizedQuestion(question, "user_imported")), ...questionBank.map((question) => normalizedQuestion(question, "curated"))];
      const type = url.searchParams.get("type") || "all";
      const level = url.searchParams.get("level") || "all";
      const source = url.searchParams.get("source") || "all";
      const status = url.searchParams.get("status") || "all";
      const category = url.searchParams.get("category") || "all";
      const priority = new Map(categoriesFor(type === "all" ? "grammar" : type).map((item, index) => [item.id, index]));
      const questions = merged.filter((question) =>
        (type === "all" || question.type === type) &&
        (level === "all" || question.level === level) &&
        (source === "all" || question.source === source) &&
        (category === "all" || question.category === category)
      ).sort((a, b) => (priority.get(a.category) ?? 99) - (priority.get(b.category) ?? 99) || a.difficulty - b.difficulty || a.order - b.order)
        .map((question, index) => ({ ...publicQuestion(question), number: index + 1, completed: completedIds.has(question.id) }))
        .filter((question) => status === "all" || (status === "completed" ? question.completed : !question.completed));
      return sendJson(res, 200, {
        questions,
        meta: { total: questions.length, allQuestions: merged.length, imported: imported.length, curated: questionBank.length, completed: questions.filter((question) => question.completed).length }
      });
    }
    if (req.method === "GET" && url.pathname === "/api/categories") {
      const type = ["grammar", "vocabulary", "reading", "listening"].includes(url.searchParams.get("type")) ? url.searchParams.get("type") : "grammar";
      const imported = await loadImportedQuestions(); const progress = await readProgress();
      const completedIds = new Set(progress.attempts.map((attempt) => attempt.questionId));
      const merged = [...imported.map((question) => normalizedQuestion(question, "user_imported")), ...questionBank.map((question) => normalizedQuestion(question, "curated"))];
      const categories = categoriesFor(type).map((category) => {
        const items = merged.filter((question) => question.type === type && question.category === category.id);
        const authentic = items.filter((question) => question.source === "user_imported");
        return { ...category, total: items.length, completed: items.filter((question) => completedIds.has(question.id)).length, readyTotal: items.filter((question) => question.answerVerified).length, pendingTotal: items.filter((question) => !question.answerVerified).length, authenticTotal: authentic.length, authenticCompleted: authentic.filter((question) => completedIds.has(question.id)).length };
      });
      return sendJson(res, 200, { type, categories });
    }
    if (req.method === "GET" && url.pathname === "/api/insights") {
      const imported = await loadImportedQuestions();
      const progress = await readProgress();
      const stats = summarize(progress.attempts);
      const covered = new Set(imported.map((question) => question.skill));
      const types = ["grammar", "vocabulary", "reading", "listening"];
      const gaps = types.flatMap((type) => blueprintFor(type, "B1").skills.map((skill) => ({ type, skill }))).filter((item) => !covered.has(item.skill));
      return sendJson(res, 200, { weakSkills: stats.weakSkills.slice(0, 5), coverageGaps: gaps.slice(0, 12), imported: importedProgress(progress.attempts, imported), recommendedToday: Math.max(10, Math.min(30, 10 + stats.pendingReview * 2)) });
    }
    if (req.method === "GET" && url.pathname === "/api/knowledge") {
      return sendJson(res, 200, { topics: knowledgeTopics.map(({ sections, examples, ...topic }) => topic) });
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/knowledge/")) {
      const topic = getKnowledgeTopic(decodeURIComponent(url.pathname.slice("/api/knowledge/".length)));
      return topic ? sendJson(res, 200, { topic }) : sendJson(res, 404, { error: "Knowledge topic not found" });
    }
    if (req.method === "POST" && url.pathname === "/api/knowledge/ask") {
      if (!process.env.OPENAI_API_KEY) return sendJson(res, 503, { error: "AI_KEY_REQUIRED" });
      const input = await body(req); const topic = getKnowledgeTopic(input.topicId);
      const question = typeof input.question === "string" ? input.question.trim().slice(0, 600) : "";
      if (!topic || !question) return sendJson(res, 400, { error: "Topic and question required" });
      const history = Array.isArray(input.history) ? input.history.slice(-8).map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: String(item.content || "").slice(0, 1000) })) : [];
      const aiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-5.6-sol",
          instructions: `你是一位严格、耐心的 TCF/TEF 法语教师。当前知识点为：${JSON.stringify(topic)}。必须用中文讲解，法语结构和例句保留法语。只讲与当前问题和该知识点有关的内容；先直接回答，再给对比例句，最后给一道不揭晓答案的快速检查题。如果学习者仍不理解，要换一种角度继续解释，而不是重复原话。`,
          input: [...history, { role: "user", content: question }]
        })
      });
      if (!aiResponse.ok) throw new Error(`OpenAI API error ${aiResponse.status}: ${await aiResponse.text()}`);
      const answer = responseText(await aiResponse.json());
      if (!answer) throw new Error("OpenAI did not return an explanation.");
      return sendJson(res, 200, { answer });
    }
    if (req.method === "POST" && url.pathname === "/api/knowledge/practice") {
      if (!process.env.OPENAI_API_KEY) return sendJson(res, 503, { error: "AI_KEY_REQUIRED" });
      const input = await body(req); const topic = getKnowledgeTopic(input.topicId);
      if (!topic) return sendJson(res, 404, { error: "Knowledge topic not found" });
      const level = ["A2", "B1"].includes(input.level) ? input.level : (topic.level.includes("B1") ? "B1" : "A2");
      const generated = await generateQuestions({ type: topic.type, level, count: 1, weakSkills: [topic.skill], variationRequest: `Évalue exclusivement le point « ${topic.title} » (${topic.skill}). La question doit être probable et fidèle au mode d'évaluation TCF/TEF.` });
      const question = { ...generated[0], source: "ai_knowledge", knowledgeTopicId: topic.id };
      sessions.set(question.id, question);
      return sendJson(res, 201, { question: publicQuestion(question) });
    }
    if (req.method === "GET" && url.pathname === "/api/vocabulary") return sendJson(res, 200, { entries: await listVocabulary() });
    if (req.method === "GET" && url.pathname === "/api/vocabulary/lookup") {
      const word = (url.searchParams.get("word") || "").trim().slice(0, 80);
      if (!word) return sendJson(res, 400, { error: "Word required" });
      const context = (url.searchParams.get("context") || "").slice(0, 500);
      const result = localLookup(word) || await aiLookup(word, context);
      return sendJson(res, 200, { word, result, aiAvailable: Boolean(process.env.OPENAI_API_KEY) });
    }
    if (req.method === "POST" && url.pathname === "/api/vocabulary") {
      const input = await body(req); const word = typeof input.word === "string" ? input.word.trim().slice(0, 80) : "";
      if (!word) return sendJson(res, 400, { error: "Word required" });
      return sendJson(res, 201, { entry: await saveVocabulary({ word, context: String(input.context || "").slice(0, 500), questionId: input.questionId }) });
    }
    if (req.method === "POST" && url.pathname === "/api/vocabulary/mastered") {
      const input = await body(req); const entry = await toggleMastered(input.id);
      return entry ? sendJson(res, 200, { entry }) : sendJson(res, 404, { error: "Entry not found" });
    }
    if (req.method === "POST" && url.pathname === "/api/questions") {
      const input = await body(req);
      const type = ["vocabulary", "grammar", "mixed", "reading", "listening", "review"].includes(input.type) ? input.type : "grammar";
      const exam = ["tcf", "tef"].includes(input.exam) ? input.exam : "tcf";
      const level = ["A1", "A2", "B1", "B2", "C1", "C2"].includes(input.level) ? input.level : "B1";
      const count = Math.min(Math.max(Number(input.count) || 5, 1), 10);
      const excludeIds = new Set(Array.isArray(input.excludeIds) ? input.excludeIds.slice(-20) : []);
      const category = typeof input.category === "string" ? input.category : "all";
      const progress = await readProgress();
      const imported = await loadImportedQuestions();
      const mergedBank = [...questionBank.map((question) => normalizedQuestion(question, "curated")), ...imported.map((question) => normalizedQuestion(question, "user_imported"))];
      const weakSkills = summarize(progress.attempts).weakSkills.slice(0, 3).map((item) => item.skill);
      let questions;
      let mode = "bank";
      let notice = "";
      if (type === "review") {
        questions = reviewQuestions(progress.attempts, count);
        mode = "review";
      } else if (input.useAI !== false && process.env.OPENAI_API_KEY && ["A2", "B1"].includes(level)) {
        try {
          questions = await generateQuestions({ type: type === "mixed" ? "grammar" : type, level, count, weakSkills });
          mode = "ai";
        } catch (error) {
          console.error("AI generation failed, using question bank:", error.message);
          const matching = mergedBank.filter((item) => item.answerVerified && (type === "mixed" ? ["grammar", "vocabulary"].includes(item.type) : item.type === type) && (category !== "all" || [level, "A2"].includes(item.level)) && (category === "all" || item.category === category));
          const unseen = matching.filter((item) => !excludeIds.has(item.id));
          questions = sample(unseen.length ? unseen : matching, count);
          notice = "AI 暂时不可用，已自动切换到精选题库。";
        }
      } else {
        const matching = mergedBank.filter((item) => item.answerVerified && (type === "mixed" ? ["grammar", "vocabulary"].includes(item.type) : item.type === type) && (category !== "all" || [level, "A2"].includes(item.level)) && (category === "all" || item.category === category));
        matching.sort((a, b) => a.difficulty - b.difficulty || a.order - b.order);
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
      const request = typeof input.request === "string" ? input.request.trim().slice(0, 300) : "";
      const generated = await generateQuestions({ type: reference.type, level: reference.level, count: 1, weakSkills: [reference.skill], referenceQuestion: reference, variationRequest: request });
      const variation = { ...generated[0], source: "ai_variation", parentQuestionId: reference.id };
      sessions.set(variation.id, variation);
      return sendJson(res, 201, { question: publicQuestion(variation) });
    }
    if (req.method === "POST" && url.pathname === "/api/smart-generation") {
      if (!process.env.OPENAI_API_KEY) return sendJson(res, 503, { error: "AI_KEY_REQUIRED" });
      const input = await body(req);
      const type = ["grammar", "vocabulary", "reading", "listening"].includes(input.type) ? input.type : "grammar";
      const level = ["A2", "B1"].includes(input.level) ? input.level : "B1";
      const imported = await loadImportedQuestions();
      const progress = await readProgress();
      const stats = summarize(progress.attempts);
      const covered = new Set(imported.filter((question) => question.type === type).map((question) => question.skill));
      const gap = blueprintFor(type, level).skills.find((skill) => !covered.has(skill));
      const weak = stats.weakSkills.find((item) => item.skill)?.skill || stats.weakSkills[0]?.skill;
      const targetSkill = input.mode === "weak" ? (weak || gap) : (gap || weak);
      const request = typeof input.request === "string" ? input.request.trim().slice(0, 300) : "";
      const generated = await generateQuestions({ type, level, count: 1, weakSkills: targetSkill ? [targetSkill] : [], variationRequest: request });
      const question = { ...generated[0], source: "ai_supplement", targetReason: input.mode === "weak" ? "重点考点强化" : "真题覆盖缺口" };
      sessions.set(question.id, question);
      return sendJson(res, 201, { question: publicQuestion(question), targetSkill, reason: question.targetReason });
    }
    if (req.method === "POST" && url.pathname === "/api/attempts") {
      const input = await body(req);
      const imported = await loadImportedQuestions();
      const question = sessions.get(input.questionId) || [...questionBank, ...imported].find((item) => item.id === input.questionId);
      if (!question || question.answer === null || question.answerVerified === false) return sendJson(res, 409, { error: "ANSWER_PENDING_REVIEW" });
      if (!Number.isInteger(input.selected) || input.selected < 0 || input.selected >= question.options.length) return sendJson(res, 400, { error: "Invalid attempt" });
      const correct = input.selected === question.answer;
      const analysis = buildAttemptAnalysis(question, input.selected);
      const attempt = {
        id: crypto.randomUUID(), questionId: question.id, type: question.type,
        exam: ["tcf", "tef"].includes(input.exam) ? input.exam : "tcf",
        skill: question.skill, selected: input.selected, correct, createdAt: new Date().toISOString(),
        question, analysis
      };
      await addAttempt(attempt);
      return sendJson(res, 201, { correct, answer: question.answer, analysis });
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
