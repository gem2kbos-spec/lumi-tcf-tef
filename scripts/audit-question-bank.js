import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const bankPath = path.resolve("server/imports/questions.json");
const reportPath = path.resolve("server/imports/quality-audit-report.json");
const apply = process.argv.includes("--apply");
const normalize = (value) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’‘`´]/g, "'").replace(/\b[a-d][.)]?\s+/g, "").replace(/[^\p{L}\p{N}_]+/gu, " ").trim().replace(/\s+/g, " ");

// Manually adjudicated after the structural pass: these have no unique,
// source-supported answer and must not reach practice mode.
const unreliableIds = new Map([
  ["auth-grammar-016", "语境同时支持‘正在下雨’和‘刚下过雨’，答案不唯一"],
  ["auth-grammar-092", "puisque、car 和 parce que 在现有语境中均可成立"],
  ["auth-grammar-179", "题干已经含 C'est，正确选项会形成 C'est C'est incroyable"],
  ["auth-vocab-048", "se résigner à 和 s'obliger à 在现有语境中均可成立"],
  ["auth-vocab-077", "garer 和 stationner 均可与 voiture 搭配"],
  ["auth-vocab-080", "四个形容词均可合法修饰 pull，缺少唯一判据"],
  ["auth-vocab-083", "多个形容词均可合法修饰 pantalon，缺少唯一判据"],
  ["auth-vocab-101", "题干明确标注选项缺失，现有选项无法补成规范句子"],
  ["auth-vocab-175", "应填 minci，但选项中没有正确答案"],
  ["auth-reading-067", "原图表缺失，无法根据占位文字判断正确图表"],
  ["auth-reading-120", "原文没有说明课程免费，正确选项缺乏文本依据"],
  ["auth-reading-226", "原文未说明人物是记者，正确选项缺乏文本依据"]
]);
const redundantIds = new Map([
  ["auth-vocab-177", "auth-vocab-107"],
  ["auth-reading-218", "auth-reading-169"],
  ["auth-reading-219", "auth-reading-170"]
]);

function incompleteReason(question) {
  if (question.type !== "reading") return null;
  if (/^\(ABCD中只有一个选项最符合此处语境\)$/i.test(question.prompt)) return "文章含多个 Question 标记，但题干没有标明当前插入位置";
  if (!/^Quelle est la bonne réponse selon le document \?$/i.test(question.prompt)) return null;
  const passage = question.passage ?? "";
  if (/\(\d+\)|_\s*\(\d+\)\s*_/u.test(passage)) return "完形文章含多个空，但题干没有标明当前作答空位";
  if (/^\s*\d+\./m.test(passage) && question.options.every((option) => /\d/.test(option))) return "排序题没有说明需要重排句子";
  if (/^\s*\d+\./m.test(passage)) return "题干缺少同义改写任务说明";
  return null;
}

const questions = JSON.parse(await readFile(bankPath, "utf8"));
const seen = new Map();
const removals = [];
const kept = [];
for (const question of questions) {
  const exactKey = `${normalize(question.prompt)}||${question.options.map(normalize).join("|")}`;
  const readingKey = question.type === "reading" ? `${normalize(question.passage)}||${normalize(question.prompt)}` : null;
  const duplicateOf = seen.get(readingKey || exactKey) || seen.get(exactKey);
  const incomplete = incompleteReason(question);
  const unreliable = unreliableIds.get(question.id);
  if (duplicateOf || redundantIds.has(question.id)) removals.push({ id: question.id, type: question.type, reason: "duplicate", detail: `与 ${duplicateOf || redundantIds.get(question.id)} 重复` });
  else if (incomplete) removals.push({ id: question.id, type: question.type, reason: "incomplete", detail: incomplete });
  else if (unreliable) removals.push({ id: question.id, type: question.type, reason: "unreliable", detail: unreliable });
  else {
    kept.push(question);
    seen.set(exactKey, question.id);
    if (readingKey) seen.set(readingKey, question.id);
  }
}

let previous = null;
try { previous = JSON.parse(await readFile(reportPath, "utf8")); } catch {}
const previousRemovals = apply && previous?.after === questions.length ? previous.removals : [];
const allRemovals = [...previousRemovals, ...removals];
const byReason = Object.fromEntries(["duplicate", "incomplete", "unreliable"].map((reason) => [reason, allRemovals.filter((item) => item.reason === reason).length]));
const remainingByType = Object.fromEntries(["grammar", "vocabulary", "reading", "listening"].map((type) => [type, kept.filter((item) => item.type === type).length]));
const report = { generatedAt: new Date().toISOString(), before: previousRemovals.length ? previous.before : questions.length, after: kept.length, removed: allRemovals.length, byReason, remainingByType, removals: allRemovals };
if (apply) {
  await writeFile(bankPath, `${JSON.stringify(kept, null, 2)}\n`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
