import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const questions = JSON.parse(await readFile(new URL("../server/imports/questions.json", import.meta.url), "utf8"));
const report = JSON.parse(await readFile(new URL("../server/imports/import-report.json", import.meta.url), "utf8"));

test("cleaned import preserves every reliable question with unique IDs", () => {
  assert.equal(questions.length, 575);
  assert.equal(new Set(questions.map((question) => question.id)).size, questions.length);
  assert.equal(questions.filter((question) => question.type === "grammar").length, 211);
  assert.equal(questions.filter((question) => question.type === "vocabulary").length, 215);
  assert.equal(questions.filter((question) => question.type === "reading").length, 149);
});

test("all cleaned imported questions have calibrated answers", () => {
  assert.equal(questions.filter((question) => question.answerVerified).length, questions.length);
  assert.equal(questions.filter((question) => !question.answerVerified).length, 0);
  assert.equal(questions.filter((question) => question.calibration).length, 364);
  assert.ok(questions.filter((question) => question.calibration).every((question) => question.explanation.includes("中文解析：") && question.explanation.includes("Explication française")));
  assert.ok(questions.every((question) => question.options.length >= 2 && question.options.length <= 5));
  assert.deepEqual(report.sourceAudit["TCFTEF阅读.docx"].incompleteSourceGroups, [64, 76, 77, 78]);
});

test("cleaned import has no exact duplicate or incomplete generic task", () => {
  const normalize = (value) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’‘`´]/g, "'").replace(/\b[a-d][.)]?\s+/g, "").replace(/[^\p{L}\p{N}_]+/gu, " ").trim().replace(/\s+/g, " ");
  const signatures = questions.map((question) => `${normalize(question.prompt)}||${question.options.map(normalize).join("|")}`);
  assert.equal(new Set(signatures).size, signatures.length);
  assert.ok(questions.every((question) => question.prompt !== "(ABCD中只有一个选项最符合此处语境)"));
  assert.ok(questions.every((question) => !/选项缺失/.test(question.prompt)));
});

test("identical imported questions never contradict each other", () => {
  const answersByContent = new Map();
  for (const question of questions) {
    const key = `${question.prompt}\u0000${question.options.join("\u0000")}`;
    if (answersByContent.has(key)) assert.equal(question.answer, answersByContent.get(key), `Conflicting answer for ${question.id}`);
    else answersByContent.set(key, question.answer);
  }
});

test("import uses content-assessed CEFR bands plus a ten-point internal difficulty", () => {
  assert.deepEqual(new Set(questions.map((question) => question.level)), new Set(["A1", "A2", "B1", "B2", "C1", "C2"]));
  assert.ok(questions.every((question) => question.difficulty >= 1 && question.difficulty <= 10));
  assert.ok(questions.every((question) => question.levelEstimated === false));
  assert.ok(questions.every((question) => question.options.length === 4));
  assert.ok(questions.every((question) => question.explanation.includes("中文解析：") && question.explanation.includes("Explication française")));
});
