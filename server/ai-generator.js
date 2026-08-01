import { randomUUID } from "node:crypto";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["prompt", "options", "answer", "explanation", "topic", "skill"],
        properties: {
          prompt: { type: "string" },
          options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
          answer: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string" },
          topic: { type: "string" },
          skill: { type: "string" }
        }
      }
    }
  }
};

export async function generateQuestions({ type, level, count, weakSkills = [] }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-5.6-sol";
  const instructions = `Tu es un concepteur expert du TCF Tout Public. Crée des QCM originaux de ${type === "grammar" ? "maîtrise des structures" : "lexique en contexte"}, niveau CECR ${level}. Imite le mode d'évaluation du TCF sans reproduire de question protégée. Une seule réponse doit être incontestablement correcte. Les distracteurs doivent être plausibles, homogènes et sans ambiguïté. Rédige tout en français. Donne une explication pédagogique courte. Compétences faibles à renforcer : ${weakSkills.join(", ") || "aucune donnée"}.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      instructions,
      input: `Génère exactement ${count} questions de type ${type}, niveau ${level}.`,
      text: { format: { type: "json_schema", name: "tcf_questions", strict: true, schema } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const outputText = payload.output_text ?? payload.output
    ?.flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text")?.text;
  if (!outputText) throw new Error("OpenAI did not return structured question data.");
  return JSON.parse(outputText).questions.map((question) => ({
    ...question, id: `ai-${randomUUID()}`, type, level, source: "ai"
  }));
}
