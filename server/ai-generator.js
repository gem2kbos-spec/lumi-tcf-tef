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
        required: ["passage", "audioText", "prompt", "options", "answer", "explanation", "topic", "skill"],
        properties: {
          passage: { type: "string" },
          audioText: { type: "string" },
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

export async function generateQuestions({ type, level, count, weakSkills = [], referenceQuestion = null, variationRequest = "" }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-5.6-sol";
  const blueprint = blueprintFor(type, level);
  const section = type === "grammar" ? "maîtrise des structures" : type === "reading" ? "compréhension écrite" : type === "listening" ? "compréhension orale" : "lexique en contexte";
  const reference = referenceQuestion ? `Crée une variation du même point précis « ${referenceQuestion.skill} ». Reproduis le mécanisme d'évaluation et le niveau, mais change entièrement le contexte, les formulations, les exemples, les valeurs et l'ordre de la bonne réponse. Ne copie aucune phrase de la question de référence. Demande personnelle du candidat : ${variationRequest || "aucune contrainte supplémentaire"}. Respecte-la seulement si elle reste compatible avec le niveau et le format.` : "";
  const custom = !referenceQuestion && variationRequest ? `Contrainte personnelle du candidat : ${variationRequest}. Respecte-la si elle reste compatible avec le niveau et le format.` : "";
  const instructions = `Tu es un concepteur expert des tests de français TCF et TEF. Crée des QCM originaux de ${section}, niveau CECR ${level}. Respecte strictement ce référentiel public : ${JSON.stringify(blueprint)}. ${reference} ${custom} Imite le mode d'évaluation sans reproduire de question protégée. Une seule réponse doit être incontestablement correcte et directement justifiable. Les distracteurs doivent être plausibles, homogènes, de longueur comparable et sans ambiguïté. N'exige aucune connaissance extérieure au document. Rédige tout en français. Donne une explication pédagogique courte qui indique l'indice décisif. Pour la lecture, passage contient le document. Pour l'écoute, audioText contient un court document oral naturel et le candidat ne doit pas voir sa transcription. Pour les autres sections, ces champs sont des chaînes vides. Compétences faibles à renforcer : ${weakSkills.join(", ") || "aucune donnée"}.`;

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
    if (type === "listening" && question.audioText.trim().split(/\s+/).length < 8) throw new Error("AI listening script is too short.");
    if (type !== "listening" && question.audioText !== "") throw new Error("AI returned an unexpected audio script.");
  }
}
