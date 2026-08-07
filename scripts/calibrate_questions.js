import { readFile, writeFile } from "node:fs/promises";
import { completeAi, getAiConfig } from "../server/ai-client.js";

const questionsPath = new URL("../server/imports/questions.json", import.meta.url);
const reportPath = new URL("../server/imports/calibration-report.json", import.meta.url);
const importReportPath = new URL("../server/imports/import-report.json", import.meta.url);
const checkpointPath = new URL("../server/imports/.calibration-checkpoint.json", import.meta.url);
const questions = JSON.parse(await readFile(questionsPath, "utf8"));
const pending = questions.filter((question) => !question.answerVerified);
const config = getAiConfig();
if (!config.enabled) throw new Error("请先配置 AI 密钥。");

let checkpoint = { firstPass: {}, reviews: {}, arbitrated: {} };
try { checkpoint = JSON.parse(await readFile(checkpointPath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
async function saveCheckpoint() { await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`); }

const answerSchema = {
  type: "object",
  required: ["answers"],
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "answer", "explanationZh", "explanationFr", "confidence", "ambiguity"],
        properties: {
          id: { type: "string" }, answer: { type: "integer" },
          explanationZh: { type: "string" }, explanationFr: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] }, ambiguity: { type: "string" }
        }
      }
    }
  }
};

function compact(question, proposed = null) {
  return {
    id: question.id, type: question.type, passage: question.passage || "",
    prompt: question.prompt, options: question.options,
    ...(proposed ? { proposedAnswer: proposed.answer, proposedExplanationZh: proposed.explanationZh, proposedExplanationFr: proposed.explanationFr } : {})
  };
}

function batches(items, maxItems = 10, maxChars = 9000) {
  const result = []; let current = []; let chars = 0;
  for (const item of items) {
    const size = JSON.stringify(item).length;
    if (current.length && (current.length >= maxItems || chars + size > maxChars)) { result.push(current); current = []; chars = 0; }
    current.push(item); chars += size;
  }
  if (current.length) result.push(current);
  return result;
}

async function requestJson({ instructions, items, schemaName }) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const output = await completeAi({ instructions, input: `Analyse ces questions et réponds uniquement en JSON :\n${JSON.stringify(items)}`, schema: answerSchema, schemaName, maxTokens: 7000 });
      const parsed = JSON.parse(output);
      if (!Array.isArray(parsed.answers)) throw new Error("answers absent");
      return parsed.answers;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
    }
  }
  throw lastError;
}

function validateAnswer(source, answer) {
  return answer && answer.id === source.id && Number.isInteger(answer.answer) && answer.answer >= 0 && answer.answer < source.options.length &&
    answer.explanationZh?.trim().length >= 12 && answer.explanationFr?.trim().length >= 12;
}

const firstPass = new Map(Object.entries(checkpoint.firstPass || {}));
const firstBatches = batches(pending.filter((question) => !firstPass.has(question.id)).map((question) => compact(question)));
for (let index = 0; index < firstBatches.length; index += 1) {
  const batch = firstBatches[index];
  const answers = await requestJson({
    schemaName: "question_calibration",
    instructions: "你是TCF/TEF法语考试题目校准专家。逐题独立判断唯一最佳答案。阅读题只能依据文章；词汇题依据标准法语搭配和语境。answer使用从0开始的选项索引。中文解析必须指出决定性依据并简要排除最强干扰项；法语解析必须自然、准确地说明同一依据。若源题确有歧义，仍选最符合标准考试逻辑的答案，并在ambiguity中具体说明；无歧义填空字符串。不要依赖题号规律。"
    , items: batch
  });
  for (const source of batch) {
    const answer = answers.find((item) => item.id === source.id);
    if (!validateAnswer(questions.find((item) => item.id === source.id), answer)) throw new Error(`首轮结果无效：${source.id}`);
    firstPass.set(source.id, answer);
    checkpoint.firstPass[source.id] = answer;
  }
  await saveCheckpoint();
  console.log(`首轮 ${index + 1}/${firstBatches.length}，已完成 ${firstPass.size}/${pending.length}`);
}

const reviews = new Map(Object.entries(checkpoint.reviews || {}));
const reviewItems = pending.filter((question) => !reviews.has(question.id)).map((question) => compact(question, firstPass.get(question.id)));
const reviewBatches = batches(reviewItems, 8, 9000);
for (let index = 0; index < reviewBatches.length; index += 1) {
  const batch = reviewBatches[index];
  const answers = await requestJson({
    schemaName: "question_review",
    instructions: "你是第二位独立的TCF/TEF审题专家。重新解题，再核对 proposedAnswer。不能因为已有答案就默认同意。answer使用从0开始的选项索引。中文和法语解析都必须写出文本或语言结构中的决定性证据；发现原结论错误就直接纠正。confidence反映你对最终答案的把握。ambiguity只记录真实歧义，否则为空字符串。"
    , items: batch
  });
  for (const source of batch) {
    const original = questions.find((item) => item.id === source.id);
    const answer = answers.find((item) => item.id === source.id);
    if (!validateAnswer(original, answer)) throw new Error(`复核结果无效：${source.id}`);
    reviews.set(source.id, answer);
    checkpoint.reviews[source.id] = answer;
  }
  await saveCheckpoint();
  console.log(`复核 ${index + 1}/${reviewBatches.length}，已完成 ${reviews.size}/${pending.length}`);
}

const disagreements = pending.filter((question) => firstPass.get(question.id).answer !== reviews.get(question.id).answer || reviews.get(question.id).confidence === "low");
const arbitrated = new Map(Object.entries(checkpoint.arbitrated || {}));
const arbitrationQueue = disagreements.filter((question) => !arbitrated.has(question.id));
for (let index = 0; index < arbitrationQueue.length; index += 1) {
  const question = arbitrationQueue[index]; const first = firstPass.get(question.id); const review = reviews.get(question.id);
  const answers = await requestJson({
    schemaName: "question_arbitration",
    instructions: "你是TCF/TEF终审专家。两位审题者有分歧或低置信度。请从原文和标准法语出发亲自解题，选择唯一最合理答案。answer从0开始。中法解析必须明确引用决定性线索并说明为何另一候选答案不成立。若题目存在轻微表述问题，也要按标准考试最优答案处理并记录ambiguity。",
    items: [{ ...compact(question), firstProposal: first, secondProposal: review }]
  });
  if (!validateAnswer(question, answers[0])) throw new Error(`仲裁结果无效：${question.id}`);
  arbitrated.set(question.id, answers[0]);
  checkpoint.arbitrated[question.id] = answers[0]; await saveCheckpoint();
  console.log(`仲裁 ${index + 1}/${arbitrationQueue.length}：${question.id}`);
}

for (const question of pending) {
  const answer = arbitrated.get(question.id) || reviews.get(question.id);
  question.answer = answer.answer;
  question.answerVerified = true;
  question.explanation = `中文解析：${answer.explanationZh.trim()}\n\nExplication française : ${answer.explanationFr.trim()}`;
  question.calibration = {
    provider: config.provider, model: config.model, reviewed: true,
    firstAnswer: firstPass.get(question.id).answer, reviewAnswer: reviews.get(question.id).answer,
    arbitrated: arbitrated.has(question.id), confidence: answer.confidence,
    ambiguity: answer.ambiguity?.trim() || ""
  };
}

const calibratedIds = new Set(pending.map((question) => question.id));
const invalid = questions.filter((question) => !question.answerVerified || !Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length || (calibratedIds.has(question.id) && (!question.explanation?.includes("中文") || !question.explanation?.includes("française"))));
if (invalid.length) throw new Error(`最终一致性检查失败：${invalid.map((item) => item.id).join(", ")}`);

await writeFile(questionsPath, `${JSON.stringify(questions, null, 2)}\n`);
const calibrationReport = {
  calibratedAt: new Date().toISOString(), provider: config.provider, model: config.model,
  totalQuestions: questions.length, calibratedThisRun: pending.length,
  firstReviewAgreements: pending.length - disagreements.length,
  arbitrationCount: disagreements.length,
  ambiguities: pending.filter((question) => question.calibration?.ambiguity).map((question) => ({ id: question.id, note: question.calibration.ambiguity }))
};
await writeFile(reportPath, `${JSON.stringify(calibrationReport, null, 2)}\n`);
const importReport = JSON.parse(await readFile(importReportPath, "utf8"));
importReport.summary = { grammar_ready: questions.filter((q) => q.type === "grammar").length, vocabulary_ready: questions.filter((q) => q.type === "vocabulary").length, reading_ready: questions.filter((q) => q.type === "reading").length };
importReport.answerCalibration = calibrationReport;
await writeFile(importReportPath, `${JSON.stringify(importReport, null, 2)}\n`);
console.log(JSON.stringify(calibrationReport, null, 2));
