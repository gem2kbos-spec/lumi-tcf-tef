import test from "node:test";
import assert from "node:assert/strict";
import { examDiagnostic } from "../server/exam-diagnostics.js";

test("maps sentence vocabulary to the official TCF and TEF ability layers", () => {
  const result = examDiagnostic({ type: "vocabulary", skill: "collocation", question: { prompt: "Il faut ___ une décision.", options: ["prendre", "faire"], answer: 0 } });
  assert.match(result.examAbility, /TCF/); assert.match(result.examAbility, /TEF · 句子词汇/); assert.match(result.title, /prendre/);
});

test("reading inference gets an evidence-based remediation", () => {
  const result = examDiagnostic({ type: "reading", skill: "inference", question: { topic: "article", passage: "..." } });
  assert.equal(result.title, "有证据的推断"); assert.match(result.action, /原文依据/);
});
