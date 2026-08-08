import test from "node:test";
import assert from "node:assert/strict";
import { questionBank } from "../server/question-bank.js";
import { blueprintFor } from "../server/tcf-blueprint.js";
import { validateBlankPlacement, validateGeneratedQuestions } from "../server/ai-generator.js";
import { validateImportedQuestions } from "../server/imported-questions.js";
import { buildAttemptAnalysis, formatAiAnalysis } from "../server/knowledge-base.js";

test("all bank questions have one valid answer among four options", () => {
  for (const question of questionBank) {
    assert.equal(question.options.length, 4, question.id);
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4, question.id);
    assert.ok(question.explanation.length > 10, question.id);
  }
});

test("reading bank covers both target levels and always includes a document", () => {
  const reading = questionBank.filter((question) => question.type === "reading");
  assert.equal(reading.length, 10);
  assert.deepEqual(new Set(reading.map((question) => question.level)), new Set(["A2", "B1"]));
  assert.ok(reading.every((question) => question.passage && question.passage.split(/\s+/).length >= 20));
});

test("listening bank has playable scripts and exam coverage", () => {
  const listening = questionBank.filter((question) => question.type === "listening");
  assert.ok(listening.length >= 8);
  assert.ok(listening.every((question) => question.audioText.split(/\s+/).length >= 10));
  assert.ok(listening.some((question) => question.exam === "tcf"));
  assert.ok(listening.some((question) => question.exam === "tef"));
});

test("blueprint defines bounded reading skills and length for each level", () => {
  for (const level of ["A2", "B1"]) {
    const blueprint = blueprintFor("reading", level);
    assert.equal(blueprint.wordRange.length, 2);
    assert.ok(blueprint.skills.length >= 4);
    assert.ok(blueprint.documents.length >= 5);
  }
});

test("AI validator rejects reading passages outside the target range", () => {
  const question = { passage: "Texte trop court.", audioText: "", prompt: "Quelle est l'idée principale ?", options: ["A", "B", "C", "D"], answer: 0, explanation: "A est la réponse correcte." };
  assert.throws(() => validateGeneratedQuestions([question], { type: "reading", level: "B1", count: 1 }), /target length/);
});

test("AI validator rejects an object pronoun blank after the past participle", () => {
  assert.throws(() => validateBlankPlacement({ prompt: "Je n'ai pas trouvé mon téléphone, mais j'ai vu ____ sur le canapé.", options: ["le", "la", "les", "l'"], answer: 0 }), /object pronoun/);
});

test("AI validator rejects impossible apostrophe elision", () => {
  assert.throws(() => validateBlankPlacement({ prompt: "Il regarde ____ sur le canapé.", options: ["le", "la", "les", "l'"], answer: 0 }), /elision/);
});

test("import validator preserves supported authentic question structure", () => {
  assert.equal(validateImportedQuestions([{
    id: "source-1", type: "grammar", level: "B1", topic: "temps", skill: "imparfait",
    passage: "", audioText: "", prompt: "Il ___.", options: ["A", "B", "C", "D"], answer: 0,
    explanation: "Une explication suffisamment claire."
  }]), true);
});

test("attempt analysis provides a detailed Chinese explanation", () => {
  const question = questionBank.find((item) => item.id === "grammar-001");
  const analysis = buildAttemptAnalysis(question, 0);
  assert.match(analysis.detailedZh, /题干理解/);
  assert.match(analysis.detailedZh, /选项逐项分析/);
  assert.match(analysis.detailedZh, /正确答案/);
  assert.equal(analysis.knowledge.label, "虚拟式");
  assert.match(analysis.knowledge.title, /^虚拟式：/);
});

test("il se peut que analysis explains every distractor in Chinese", () => {
  const analysis = buildAttemptAnalysis({ type: "grammar", skill: "subjonctif", topic: "subjonctif", prompt: "Il se peut _ il pleuve demain.", options: ["pour", "que", "si", "de"], answer: 1, explanation: "" }, 0);
  assert.match(analysis.detailedZh, /pour 后面通常/);
  assert.match(analysis.detailedZh, /si 用于条件句/);
  assert.match(analysis.detailedZh, /il est possible de/);
  assert.doesNotMatch(analysis.detailedZh, /还不稳定/);
});

test("preposition distractors have concrete local usage instead of filler", () => {
  const analysis = buildAttemptAnalysis({ type: "grammar", skill: "prepositions", topic: "lieu", prompt: "Elle habite _ Paris.", options: ["à", "dans", "en", "sur"], answer: 0, explanation: "" }, 1);
  assert.match(analysis.detailedZh, /dans la salle/);
  assert.match(analysis.detailedZh, /en France/);
  assert.match(analysis.detailedZh, /sur la table/);
  assert.doesNotMatch(analysis.detailedZh, /不能填入本题位置；需要检查/);
});

test("AI analysis is rejected when distractor explanations are filler", () => {
  const question = { type: "grammar", skill: "prepositions", topic: "lieu", prompt: "Elle habite _ Paris.", options: ["à", "dans"], answer: 0, explanation: "" };
  const result = formatAiAnalysis(question, 1, { summary: "地点介词", rule: "城市前用 à。", steps: ["看地点"], correctReason: "Paris 是城市。", trap: "不要直译。", options: [{ option: "à", usage: "用于城市名称之前表示地点或方向。", reasonInQuestion: "Paris 是城市名称，因此本题使用 à。", example: "Elle vit à Lyon." }, { option: "dans", usage: "表示位于具有明确边界的空间内部。", reasonInQuestion: "不合适", example: "Elle est dans la salle." }] });
  assert.doesNotMatch(result.detailedZh, /常见用法：/);
});
