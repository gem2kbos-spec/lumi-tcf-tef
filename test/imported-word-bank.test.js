import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const questions = JSON.parse(await readFile(new URL("../server/imports/questions.json", import.meta.url), "utf8"));
const report = JSON.parse(await readFile(new URL("../server/imports/import-report.json", import.meta.url), "utf8"));

test("Word import preserves every structurally complete question with unique IDs", () => {
  assert.equal(questions.length, 700);
  assert.equal(new Set(questions.map((question) => question.id)).size, 700);
  assert.equal(questions.filter((question) => question.type === "grammar").length, 227);
  assert.equal(questions.filter((question) => question.type === "vocabulary").length, 244);
  assert.equal(questions.filter((question) => question.type === "reading").length, 229);
});

test("import separates verified answers from pending answer calibration", () => {
  assert.equal(questions.filter((question) => question.answerVerified).length, 227);
  assert.equal(questions.filter((question) => !question.answerVerified).length, 473);
  assert.ok(questions.every((question) => question.options.length >= 2 && question.options.length <= 5));
  assert.deepEqual(report.sourceAudit["TCFTEF阅读.docx"].incompleteSourceGroups, [64, 76, 77, 78]);
});

test("import uses six CEFR bands plus a ten-point internal difficulty", () => {
  assert.deepEqual(new Set(questions.map((question) => question.level)), new Set(["A1", "A2", "B1", "B2", "C1", "C2"]));
  assert.ok(questions.every((question) => question.difficulty >= 1 && question.difficulty <= 10));
  assert.ok(questions.every((question) => question.levelEstimated === true));
});
