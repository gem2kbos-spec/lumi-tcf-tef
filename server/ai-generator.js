import { randomUUID } from "node:crypto";
import { blueprintFor } from "./tcf-blueprint.js";

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
        required: ["passage", "prompt", "options", "answer", "explanation", "topic", "skill"],
        properties: {
          passage: { type: "string" },
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
  const blueprint = blueprintFor(type, level);
  const section = type === "grammar" ? "maîtrise des structures" : type === "reading" ? "compréhension écrite" : "lexique en contexte";
  const instructions = `Tu es un concepteur expert du TCF Tout Public. Crée des QCM originaux de ${section}, niveau CECR ${level}. Respecte strictement ce référentiel public : ${JSON.stringify(blueprint)}. Imite le mode d'évaluation du TCF sans reproduire de question protégée. Une seule réponse doit être incontestablement correcte et directement justifiable. Les distracteurs doivent être plausibles, homogènes, de longueur comparable et sans ambiguïté. N'exige aucune connaissance extérieure au document. Rédige tout en français. Donne une explication pédagogique courte qui indique l'indice décisif. Pour la lecture, passage contient le document et prompt contient une seule question. Pour les autres sections, passage est une chaîne vide. Compétences faibles à renforcer : ${weakSkills.join(", ") || "aucune donnée"}.`;

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
  const questions = JSON.parse(outputText).questions;
  validateGeneratedQuestions(questions, { type, level, count });
  return questions.map((question) => ({
    ...question, id: `ai-${randomUUID()}`, type, level, source: "ai"
  }));
}

export function validateGeneratedQuestions(questions, { type, level, count }) {
  if (!Array.isArray(questions) || questions.length !== count) throw new Error("AI returned an unexpected question count.");
  const blueprint = blueprintFor(type, level);
  for (const question of questions) {
    if (new Set(question.options.map((option) => option.trim().toLowerCase())).size !== 4) throw new Error("AI returned duplicate answer choices.");
    if (type === "reading") {
      const words = question.passage.trim().split(/\s+/).filter(Boolean).length;
      if (words < blueprint.wordRange[0] || words > blueprint.wordRange[1]) throw new Error("AI reading passage is outside the target length.");
    } else if (question.passage !== "") throw new Error("AI returned an unexpected passage.");
  }
}
