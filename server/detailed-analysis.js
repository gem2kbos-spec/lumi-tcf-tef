import { aiEnabled, completeAi } from "./ai-client.js";
import { buildAttemptAnalysis, formatAiAnalysis } from "./knowledge-base.js";

const schema = {
  type: "object", additionalProperties: false,
  required: ["summary", "rule", "steps", "correctReason", "options", "trap"],
  properties: {
    summary: { type: "string" }, rule: { type: "string" }, correctReason: { type: "string" }, trap: { type: "string" },
    steps: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
    options: { type: "array", minItems: 2, maxItems: 6, items: { type: "object", additionalProperties: false, required: ["option", "usage", "reasonInQuestion", "example"], properties: { option: { type: "string" }, usage: { type: "string" }, reasonInQuestion: { type: "string" }, example: { type: "string" } } } }
  }
};

export async function buildDetailedAttemptAnalysis(question, selected) {
  const base = buildAttemptAnalysis(question, selected); if (!aiEnabled()) return base;
  try {
    const output = await completeAi({
      instructions: "你是TCF/TEF法语考试中文精讲老师。必须针对当前题逐项分析，禁止使用‘不合适’‘不符合语境’‘需要检查’等空话。每个选项必须说明该词或结构的真实常见用法、本题中为何成立或不成立，并给一个法语正确例句。所有说明使用详细、准确、易懂的中文；法语只出现在原句、术语和例句中。不得修改题目或正确答案。",
      input: `题型：${question.type}\n等级：${question.level}\n题干：${question.prompt}\n${question.passage ? `原文：${question.passage}\n` : ""}选项：${JSON.stringify(question.options)}\n正确选项下标：${question.answer}\n用户选择下标：${selected}\n题源已有说明：${question.explanation || "无"}`,
      schema, schemaName: "detailed_chinese_analysis", maxTokens: 2600
    });
    return formatAiAnalysis(question, selected, JSON.parse(output), base);
  } catch { return base; }
}
