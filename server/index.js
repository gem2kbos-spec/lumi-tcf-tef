import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { questionBank } from "./question-bank.js";
import { loadImportedQuestions } from "./imported-questions.js";
import { activitySummary, addAttempt, importedProgress, readProgress, reviewQuestions, sequenceProgress, summarize, weakSkillForType } from "./store.js";
import { generateQuestions } from "./ai-generator.js";
import { buildAttemptAnalysis } from "./knowledge-base.js";
import { buildDetailedAttemptAnalysis } from "./detailed-analysis.js";
import { blueprintFor } from "./tcf-blueprint.js";
import { aiLookup, listVocabulary, localLookup, resolveFrenchLemma, saveVocabulary, toggleMastered } from "./vocabulary-store.js";
import { getKnowledgeTopic, knowledgeTopics } from "./knowledge-topics.js";
import { categoriesFor, categoryFor, QUESTION_CATEGORIES } from "./question-taxonomy.js";
import { aiEnabled, completeAi, getAiConfig } from "./ai-client.js";
import { coverageGaps } from "./coverage.js";
import { addJournalEntry, listJournalEntries } from "./journal-store.js";

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

function categoryLabelFor(question) {
  const id = categoryFor(question);
  return QUESTION_CATEGORIES.find((item) => item.id === id)?.label || question.topic || "综合考点";
}

function tutorJournalTitle(question, current) {
  if (current) return `lili答疑：${categoryLabelFor(current)}`;
  if (/时间.*(引导词|介词)|depuis|il y a/i.test(question)) return "lili答疑：时间引导词与时态";
  if (/\by\b.*\ben\b|\ben\b.*\by\b/i.test(question)) return "lili答疑：代词 y 与 en";
  if (/虚拟式|subjonctif/i.test(question)) return "lili答疑：虚拟式触发结构";
  if (/阅读|主旨|推断/.test(question)) return "lili答疑：阅读理解方法";
  return "lili答疑：法语知识解析";
}

function sample(items, count) {
  return [...items].sort(() => Math.random() - 0.5).slice(0, count)
    .sort((a, b) => ({ A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 }[a.level] - ({ A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 }[b.level])));
}

function normalizedQuestion(question, source = question.source || "curated") {
  const levelDifficulty = { A1: 1, A2: 3, B1: 5, B2: 7, C1: 9, C2: 10 };
  const category = categoryFor(question);
  return { source, ...question, category, categoryLabel: QUESTION_CATEGORIES.find((item) => item.id === category)?.label || question.skill?.replaceAll("_", " ") || category, difficulty: question.difficulty || levelDifficulty[question.level] || 5, answerVerified: question.answerVerified ?? question.answer !== null };
}

function localTutorAnswer(question) {
  const text = question.toLocaleLowerCase("fr");
  const aliases = [
    ["y-en-prepositions", [" y ", " en ", "代词", "介词"]], ["past-timeline", ["过去时", "passé composé", "imparfait", "愈过去"]],
    ["reading-main-idea", ["主旨", "阅读", "idée principale"]], ["connectors-structure", ["连接词", "malgré", "bien que", "parce que"]],
    ["listening-distractors", ["听力", "录音", "干扰项"]], ["si-condition", [" si ", "条件句", "conditionnel"]]
  ];
  const match = aliases.map(([id, words]) => ({ topic: getKnowledgeTopic(id), score: words.filter((word) => ` ${text} `.includes(word)).length })).sort((a, b) => b.score - a.score)[0];
  if (!match?.score) return "我现在处于本地知识库模式。你可以问 y/en、过去时、连接词、si 条件句、阅读主旨题或听力干扰项。要回答任意自由问题，需要配置 DeepSeek 密钥。";
  const topic = match.topic;
  return `先记住：${topic.title}。\n\n${topic.summary}\n\n${topic.sections.slice(0, 3).map(([title, content]) => `${title}\n${content}`).join("\n\n")}\n\n如果你告诉我具体卡在哪一句，我可以继续按这个知识点解释。`;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/api/health") {
      const ai = getAiConfig();
      return sendJson(res, 200, { ok: true, aiEnabled: ai.enabled, aiProvider: ai.provider, aiModel: ai.model });
    }
    if (req.method === "GET" && url.pathname === "/api/stats") {
      const progress = await readProgress();
      const imported = await loadImportedQuestions();
      return sendJson(res, 200, { ...summarize(progress.attempts), imported: importedProgress(progress.attempts, imported) });
    }
    if (req.method === "GET" && url.pathname === "/api/activity") {
      const progress = await readProgress(); const imported = await loadImportedQuestions();
      return sendJson(res, 200, activitySummary(progress.attempts, imported));
    }
    if (req.method === "GET" && url.pathname === "/api/history") {
      const progress = await readProgress(); const type = url.searchParams.get("type") || "all"; const result = url.searchParams.get("result") || "all"; const source = url.searchParams.get("source") || "all"; const level = url.searchParams.get("level") || "all";
      const attempts = [...progress.attempts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter((attempt) =>
        (type === "all" || attempt.type === type) && (result === "all" || (result === "correct" ? attempt.correct : !attempt.correct)) &&
        (source === "all" || (source === "authentic" ? attempt.question?.source === "user_imported" : String(attempt.question?.source || "").startsWith("ai"))) &&
        (level === "all" || attempt.question?.level === level)
      ).slice(0, 500).map((attempt) => ({ id: attempt.id, questionId: attempt.questionId, createdAt: attempt.createdAt, correct: attempt.correct, selected: attempt.selected, selectedOption: attempt.question?.options?.[attempt.selected] || "", correctOption: attempt.question?.options?.[attempt.question?.answer] || "", question: publicQuestion(normalizedQuestion(attempt.question, attempt.question?.source)), analysis: attempt.analysis?.detailedZh ? attempt.analysis : buildAttemptAnalysis(attempt.question, attempt.selected) }));
      return sendJson(res, 200, { attempts, total: attempts.length });
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
      const answerStatus = url.searchParams.get("answerStatus") || "all";
      const query = (url.searchParams.get("q") || "").trim().toLocaleLowerCase("fr").slice(0, 100);
      const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0); const limit = Math.min(100, Math.max(20, Number(url.searchParams.get("limit")) || 50));
      const priority = new Map(categoriesFor(type === "all" ? "grammar" : type).map((item, index) => [item.id, index]));
      const filtered = merged.filter((question) =>
        (type === "all" || question.type === type) &&
        (level === "all" || question.level === level) &&
        (source === "all" || question.source === source) &&
        (category === "all" || question.category === category) &&
        (answerStatus === "all" || (answerStatus === "ready" ? question.answerVerified : !question.answerVerified)) &&
        (!query || [question.prompt, question.passage, question.topic, question.categoryLabel].some((value) => String(value || "").toLocaleLowerCase("fr").includes(query)))
      ).sort((a, b) => (priority.get(a.category) ?? 99) - (priority.get(b.category) ?? 99) || a.difficulty - b.difficulty || a.order - b.order)
        .map((question, index) => ({ ...publicQuestion(question), number: index + 1, completed: completedIds.has(question.id) }))
        .filter((question) => status === "all" || (status === "completed" ? question.completed : !question.completed));
      const questions = filtered.slice(offset, offset + limit);
      return sendJson(res, 200, {
        questions,
        meta: { total: filtered.length, returned: questions.length, offset, hasMore: offset + questions.length < filtered.length, allQuestions: merged.length, imported: imported.length, curated: questionBank.length, completed: filtered.filter((question) => question.completed).length }
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
      const types = ["grammar", "vocabulary", "reading", "listening"];
      const gaps = types.flatMap((type) => coverageGaps(imported, type, blueprintFor(type, "B1").skills).map((skill) => ({ type, skill })));
      return sendJson(res, 200, { weakSkills: stats.weakSkills.slice(0, 5), coverageGaps: gaps.slice(0, 12), imported: importedProgress(progress.attempts, imported), recommendedToday: Math.max(10, Math.min(30, 10 + stats.pendingReview * 2)) });
    }
    if (req.method === "GET" && url.pathname === "/api/knowledge") {
      return sendJson(res, 200, { topics: knowledgeTopics.map(({ sections, examples, ...topic }) => topic) });
    }
    if (req.method === "GET" && url.pathname === "/api/journal") {
      return sendJson(res, 200, { entries: await listJournalEntries() });
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/knowledge/")) {
      const topic = getKnowledgeTopic(decodeURIComponent(url.pathname.slice("/api/knowledge/".length)));
      return topic ? sendJson(res, 200, { topic }) : sendJson(res, 404, { error: "Knowledge topic not found" });
    }
    if (req.method === "POST" && url.pathname === "/api/knowledge/ask") {
      if (!aiEnabled()) return sendJson(res, 503, { error: "AI_KEY_REQUIRED" });
      const input = await body(req); const topic = getKnowledgeTopic(input.topicId);
      const question = typeof input.question === "string" ? input.question.trim().slice(0, 600) : "";
      if (!topic || !question) return sendJson(res, 400, { error: "Topic and question required" });
      const history = Array.isArray(input.history) ? input.history.slice(-8).map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: String(item.content || "").slice(0, 1000) })) : [];
      const answer = await completeAi({ instructions: `你是一位严格、耐心的 TCF/TEF 法语教师。当前知识点为：${JSON.stringify(topic)}。必须用中文讲解，法语结构和例句保留法语。只讲与当前问题和该知识点有关的内容；先直接回答，再给对比例句，最后给一道不揭晓答案的快速检查题。如果学习者仍不理解，要换一种角度继续解释，而不是重复原话。`, input: question, history, maxTokens: 2500 });
      await addJournalEntry({ kind: "question", title: topic.title, question, content: answer, skill: topic.skill });
      return sendJson(res, 200, { answer });
    }
    if (req.method === "POST" && url.pathname === "/api/knowledge/practice") {
      if (!aiEnabled()) return sendJson(res, 503, { error: "AI_KEY_REQUIRED" });
      const input = await body(req); const topic = getKnowledgeTopic(input.topicId);
      if (!topic) return sendJson(res, 404, { error: "Knowledge topic not found" });
      const level = ["A2", "B1"].includes(input.level) ? input.level : (topic.level.includes("B1") ? "B1" : "A2");
      const generated = await generateQuestions({ type: topic.type, level, count: 1, weakSkills: [topic.skill], variationRequest: `Évalue exclusivement le point « ${topic.title} » (${topic.skill}). La question doit être probable et fidèle au mode d'évaluation TCF/TEF.` });
      const question = { ...generated[0], source: "ai_knowledge", knowledgeTopicId: topic.id };
      sessions.set(question.id, question);
      return sendJson(res, 201, { question: publicQuestion(question) });
    }
    if (req.method === "POST" && url.pathname === "/api/tutor/ask") {
      const input = await body(req); const question = typeof input.question === "string" ? input.question.trim().slice(0, 800) : "";
      if (!question) return sendJson(res, 400, { error: "Question required" });
      if (!aiEnabled()) {
        const answer = localTutorAnswer(question); await addJournalEntry({ kind: "question", title: "AI老师提问", question, content: answer });
        return sendJson(res, 200, { answer, mode: "local", provider: "local" });
      }
      const imported = await loadImportedQuestions(); const current = sessions.get(input.questionId) || [...questionBank, ...imported].find((item) => item.id === input.questionId);
      const history = Array.isArray(input.history) ? input.history.slice(-10).map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: String(item.content || "").slice(0, 1200) })) : [];
      const context = current ? `当前练习题：${JSON.stringify({ type: current.type, level: current.level, passage: current.passage || "", prompt: current.prompt, options: current.options, correctAnswer: current.options[current.answer], explanation: current.explanation })}` : "当前没有打开练习题。";
      const answer = await completeAi({ instructions: `你是 lili老师，专门辅导 TCF/TEF。用中文清楚解释，法语结构和例句保留法语。优先直接回答，再解释原因；涉及当前题时逐项说明，不要泄漏任何与问题无关的题库答案。用户要求速查表、对比表或整理表时，必须输出标准 Markdown 表格，表头简短、单元格内容完整，不要用纯文本模拟表格。${context}`, input: question, history, maxTokens: 2500 });
      await addJournalEntry({ kind: "question", title: tutorJournalTitle(question, current), question, content: answer, skill: current?.skill, questionId: current?.id, meta: current ? { type: current.type, level: current.level, source: current.source, category: categoryLabelFor(current) } : null });
      return sendJson(res, 200, { answer, mode: "ai", provider: getAiConfig().provider });
    }
    if (req.method === "GET" && url.pathname === "/api/vocabulary") return sendJson(res, 200, { entries: await listVocabulary() });
    if (req.method === "GET" && url.pathname === "/api/vocabulary/lookup") {
      const word = (url.searchParams.get("word") || "").trim().slice(0, 80);
      if (!word) return sendJson(res, 400, { error: "Word required" });
      const context = (url.searchParams.get("context") || "").slice(0, 500);
      const result = localLookup(word) || await aiLookup(word, context);
      return sendJson(res, 200, { word, result, aiAvailable: aiEnabled() });
    }
    if (req.method === "POST" && url.pathname === "/api/vocabulary") {
      const input = await body(req); const word = typeof input.word === "string" ? input.word.trim().slice(0, 80) : "";
      if (!word) return sendJson(res, 400, { error: "Word required" });
      const context = String(input.context || "").slice(0, 500); const lemma = await resolveFrenchLemma(word, context);
      return sendJson(res, 201, { entry: await saveVocabulary({ word: lemma || word, context, questionId: input.questionId }), selectedForm: word, lemma: lemma || word });
    }
    if (req.method === "POST" && url.pathname === "/api/vocabulary/mastered") {
      const input = await body(req); const entry = await toggleMastered(input.id);
      return entry ? sendJson(res, 200, { entry }) : sendJson(res, 404, { error: "Entry not found" });
    }
    if (req.method === "POST" && url.pathname === "/api/questions") {
      const input = await body(req);
      const type = ["vocabulary", "grammar", "mixed", "reading", "listening", "review"].includes(input.type) ? input.type : "grammar";
      const exam = ["tcf", "tef"].includes(input.exam) ? input.exam : "tcf";
      const level = ["all", "A1", "A2", "B1", "B2", "C1", "C2"].includes(input.level) ? input.level : "all";
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
      let sequence = null;
      if (type === "review") {
        questions = reviewQuestions(progress.attempts, count);
        mode = "review";
      } else if (input.useAI !== false && aiEnabled() && ["A2", "B1"].includes(level)) {
        try {
          questions = await generateQuestions({ type: type === "mixed" ? "grammar" : type, level, count, weakSkills });
          mode = "ai";
        } catch (error) {
          console.error("AI generation failed, using question bank:", error.message);
          const matching = mergedBank.filter((item) => item.answerVerified && (type === "mixed" ? ["grammar", "vocabulary"].includes(item.type) : item.type === type) && (level === "all" || item.level === level) && (category === "all" || item.category === category));
          const unseen = matching.filter((item) => !excludeIds.has(item.id));
          questions = sample(unseen.length ? unseen : matching, count);
          notice = "AI 暂时不可用，已自动切换到精选题库。";
        }
      } else {
        const matching = mergedBank.filter((item) => item.answerVerified && (type === "mixed" ? ["grammar", "vocabulary"].includes(item.type) : item.type === type) && (level === "all" || item.level === level) && (category === "all" || item.category === category));
        matching.sort((a, b) => a.difficulty - b.difficulty || a.order - b.order);
        const completedIds = new Set(progress.attempts.map((attempt) => attempt.questionId));
        const importedMatching = matching.filter((item) => item.source === "user_imported");
        const nextImported = importedMatching.filter((item) => !completedIds.has(item.id));
        const unseen = matching.filter((item) => !excludeIds.has(item.id));
        questions = nextImported.length ? nextImported.slice(0, count) : (unseen.length ? unseen : matching).slice(0, count);
        sequence = sequenceProgress(progress.attempts, importedMatching);
      }
      for (const question of questions) sessions.set(question.id, question);
      return sendJson(res, 200, { mode, notice, sequence, questions: questions.map(publicQuestion) });
    }
    if (req.method === "POST" && url.pathname === "/api/variations") {
      if (!aiEnabled()) return sendJson(res, 503, { error: "AI_KEY_REQUIRED" });
      const input = await body(req);
      const imported = await loadImportedQuestions();
      const progress = await readProgress();
      const reference = sessions.get(input.questionId) || [...questionBank, ...imported].find((item) => item.id === input.questionId) || [...progress.attempts].reverse().find((attempt) => attempt.questionId === input.questionId)?.question;
      if (!reference) return sendJson(res, 404, { error: "Question not found" });
      const request = typeof input.request === "string" ? input.request.trim().slice(0, 300) : "";
      const generated = await generateQuestions({ type: reference.type, level: reference.level, count: 1, weakSkills: [reference.skill], referenceQuestion: reference, variationRequest: request });
      const variation = { ...generated[0], source: "ai_variation", parentQuestionId: reference.id };
      sessions.set(variation.id, variation);
      return sendJson(res, 201, { question: publicQuestion(variation) });
    }
    if (req.method === "POST" && url.pathname === "/api/smart-generation") {
      if (!aiEnabled()) return sendJson(res, 503, { error: "AI_KEY_REQUIRED" });
      const input = await body(req);
      const type = ["grammar", "vocabulary", "reading", "listening"].includes(input.type) ? input.type : "grammar";
      const level = ["A2", "B1"].includes(input.level) ? input.level : "B1";
      const imported = await loadImportedQuestions();
      const progress = await readProgress();
      const stats = summarize(progress.attempts);
      const gap = coverageGaps(imported, type, blueprintFor(type, level).skills)[0];
      const weak = weakSkillForType(stats.weakSkills, type);
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
      const analysis = await buildDetailedAttemptAnalysis(question, input.selected);
      const attempt = {
        id: crypto.randomUUID(), questionId: question.id, type: question.type,
        exam: ["tcf", "tef"].includes(input.exam) ? input.exam : "tcf",
        skill: question.skill, selected: input.selected, correct, createdAt: new Date().toISOString(),
        question, analysis
      };
      await addAttempt(attempt);
      if (!correct) await addJournalEntry({ kind: "mistake", title: analysis.knowledge.title, question: question.prompt, content: analysis.detailedZh, skill: question.skill, questionId: question.id, meta: { type: question.type, level: question.level, source: question.source, category: categoryLabelFor(question) } });
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
