import { mkdir, readFile, writeFile } from "node:fs/promises";
import { questionBank } from "../server/question-bank.js";
import { loadImportedQuestions } from "../server/imported-questions.js";
import { completeAi, getAiConfig } from "../server/ai-client.js";

const outputDir = new URL("../server/audits/", import.meta.url);
const checkpointUrl = new URL("../server/audits/tcf-compliance-checkpoint.json", import.meta.url);
const reportUrl = new URL("../server/audits/tcf-compliance-report.json", import.meta.url);
const all = [...questionBank, ...await loadImportedQuestions()];
const config = getAiConfig();
if (!config.enabled) throw new Error("AI key required for the content audit");
await mkdir(outputDir, { recursive: true });

let reviewed = {};
try { reviewed = JSON.parse(await readFile(checkpointUrl, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }

const schema = {
  type: "object",
  required: ["reviews"],
  properties: {
    reviews: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "verdict", "answer", "issue", "reason"],
        properties: {
          id: { type: "string" },
          verdict: { type: "string", enum: ["pass", "revise", "remove"] },
          answer: { type: "integer" },
          issue: { type: "string" },
          reason: { type: "string" }
        }
      }
    }
  }
};

function compact(question) {
  return {
    id: question.id,
    type: question.type,
    level: question.level,
    passage: question.passage || "",
    prompt: question.prompt,
    options: question.options,
    proposedAnswer: question.answer,
    explanation: question.explanation
  };
}

function makeBatches(items, maxItems = 10, maxChars = 12000) {
  const result = []; let current = []; let size = 0;
  for (const item of items) {
    const itemSize = JSON.stringify(item).length;
    if (current.length && (current.length >= maxItems || size + itemSize > maxChars)) { result.push(current); current = []; size = 0; }
    current.push(item); size += itemSize;
  }
  if (current.length) result.push(current);
  return result;
}

async function save() { await writeFile(checkpointUrl, `${JSON.stringify(reviewed, null, 2)}\n`); }

const pending = all.filter((question) => !reviewed[question.id]).map(compact);
const batches = makeBatches(pending);
for (let index = 0; index < batches.length; index += 1) {
  const items = batches[index]; let output; let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      output = await completeAi({
        instructions: `你是严谨的TCF Tout Public审题专家。逐题亲自解答并判断是否可用于正式TCF风格训练。pass仅限：标准法语自然；四个选项只有一个答案；题干信息足以确定答案；阅读答案能由原文推出；难度与标注大致匹配；不依赖专业知识。revise用于可通过改写修复的问题，remove用于材料残缺、多个答案或严重偏离。词汇专项并非TCF独立科目，但若能作为语言结构中的词汇、语域或固定搭配辨析题，仍可pass。不能因为已有答案或answerVerified而默认正确。answer从0开始；issue用简短中文写具体问题，无问题留空；reason必须说明决定性依据。`,
        input: JSON.stringify(items), schema, schemaName: "tcf_compliance", maxTokens: 6500
      });
      const parsed = JSON.parse(output); if (!Array.isArray(parsed.reviews)) throw new Error("reviews missing");
      for (const item of items) {
        const review = parsed.reviews.find((entry) => entry.id === item.id);
        if (!review || !Number.isInteger(review.answer) || review.answer < 0 || review.answer > 3) throw new Error(`invalid review ${item.id}`);
        reviewed[item.id] = review;
      }
      await save(); lastError = null; break;
    } catch (error) { lastError = error; if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1200)); }
  }
  if (lastError) throw lastError;
  console.log(`TCF audit ${Object.keys(reviewed).length}/${all.length}`);
}

const results = all.map((question) => ({ ...reviewed[question.id], currentAnswer: question.answer, type: question.type, level: question.level, source: question.source || "curated" }));
const counts = Object.fromEntries(["pass", "revise", "remove"].map((verdict) => [verdict, results.filter((item) => item.verdict === verdict).length]));
const answerDisagreements = results.filter((item) => item.answer !== item.currentAnswer).length;
const report = { auditedAt: new Date().toISOString(), provider: config.provider, model: config.model, total: all.length, counts, answerDisagreements, results };
await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ total: all.length, counts, answerDisagreements }, null, 2));
