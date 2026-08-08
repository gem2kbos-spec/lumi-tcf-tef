import { randomUUID } from "node:crypto";
import { blueprintFor } from "./tcf-blueprint.js";
import { aiEnabled, completeAi } from "./ai-client.js";

const questionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["passage", "audioText", "prompt", "options", "answer", "explanation", "topic", "skill"],
  properties: {
    passage: { type: "string" }, audioText: { type: "string" }, prompt: { type: "string" },
    options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
    answer: { type: "integer", minimum: 0, maximum: 3 }, explanation: { type: "string" }, topic: { type: "string" }, skill: { type: "string" }
  }
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: questionSchema
    }
  }
};

export async function generateQuestions({ type, level, count, weakSkills = [], referenceQuestion = null, variationRequest = "" }) {
  if (!aiEnabled()) return null;
  const blueprint = blueprintFor(type, level);
  const section = type === "grammar" ? "maîtrise des structures" : type === "reading" ? "compréhension écrite" : type === "listening" ? "compréhension orale" : "lexique en contexte";
  const reference = referenceQuestion ? `Crée une variation du même point précis « ${referenceQuestion.skill} ». Reproduis le mécanisme d'évaluation et le niveau, mais change entièrement le contexte, les formulations, les exemples, les valeurs et l'ordre de la bonne réponse. Ne copie aucune phrase de la question de référence. Demande personnelle du candidat : ${variationRequest || "aucune contrainte supplémentaire"}. Respecte-la seulement si elle reste compatible avec le niveau et le format.` : "";
  const custom = !referenceQuestion && variationRequest ? `Contrainte personnelle du candidat : ${variationRequest}. Respecte-la si elle reste compatible avec le niveau et le format.` : "";
  const instructions = `Tu es un concepteur expert des tests de français TCF et TEF. Crée des QCM originaux de ${section}, niveau CECR ${level}. Respecte strictement ce référentiel public : ${JSON.stringify(blueprint)}. ${reference} ${custom} Imite le mode d'évaluation sans reproduire de question protégée. Une seule réponse doit être incontestablement correcte et directement justifiable. Avant de répondre, remplace mentalement le blanc par CHACUNE des quatre options et vérifie que la position du blanc est syntaxiquement correcte. Pour les pronoms compléments, respecte impérativement leur place avant le verbe conjugué ou avant l'auxiliaire : écris « je l'ai vu », jamais « j'ai vu le/l' ». Une option avec apostrophe doit être suivie d'une voyelle ou d'un h muet. Les distracteurs doivent être plausibles, homogènes et sans ambiguïté. N'exige aucune connaissance extérieure au document. Rédige tout en français. Donne une explication pédagogique qui justifie la phrase complète correcte. Pour la lecture, passage contient le document. Pour l'écoute, audioText contient un court document oral naturel et le candidat ne doit pas voir sa transcription. Pour les autres sections, ces champs sont des chaînes vides. Compétences faibles à renforcer : ${weakSkills.join(", ") || "aucune donnée"}.`;

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const outputText = await completeAi({ instructions, input: `Génère exactement ${count} questions de type ${type}, niveau ${level}. Réponds uniquement en JSON.`, schema, schemaName: "tcf_questions" });
      const draft = JSON.parse(outputText).questions;
      const auditText = await completeAi({
        instructions: "Tu es le réviseur final d'une banque TCF/TEF. Corrige toute faute de français, tout blanc mal placé, toute mauvaise position de pronom, toute élision impossible, toute ambiguïté et toute réponse erronée. Insère mentalement chacune des quatre options dans la phrase. La bonne option doit produire une phrase française complète et naturelle; les trois autres doivent être clairement fausses pour une raison précise. Ne conserve jamais une question seulement parce que son explication affirme une réponse. Retourne les questions entièrement corrigées dans le même ordre et le même format JSON.",
        input: JSON.stringify({ type, level, questions: draft }), schema, schemaName: "audited_tcf_questions", maxTokens: 5000
      });
      const questions = JSON.parse(auditText).questions;
      validateGeneratedQuestions(questions, { type, level, count });
      return questions.map((question) => ({ ...question, id: `ai-${randomUUID()}`, type, level, source: "ai" }));
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error("AI question quality review failed.");
}

export function validateBlankPlacement(question) {
  const match = question.prompt.match(/(_{2,}|…{2,}|\.{3,})/); if (!match) return;
  const before = question.prompt.slice(0, match.index).trim(); const after = question.prompt.slice(match.index + match[0].length).trim();
  const correct = question.options[question.answer].trim().toLocaleLowerCase("fr");
  const clitics = new Set(["le", "la", "les", "l'", "l’", "lui", "leur", "y", "en"]);
  const compoundPastBeforeBlank = /\b(?:ai|as|a|avons|avez|ont|suis|es|est|sommes|êtes|sont)\s+[a-zà-ÿœ'-]+(?:é|ée|és|ées|i|ie|is|ies|u|ue|us|ues|t|te|ts|tes)\s*$/i.test(before);
  if (compoundPastBeforeBlank && clitics.has(correct)) throw new Error("AI placed a French object pronoun after a past participle.");
  if (question.options.some((option) => /['’]$/.test(option.trim())) && after && !/^[aeiouyàâäéèêëîïôöùûüh]/i.test(after)) throw new Error("AI offered an impossible elision before a consonant.");
}

export function validateGeneratedQuestions(questions, { type, level, count }) {
  if (!Array.isArray(questions) || questions.length !== count) throw new Error("AI returned an unexpected question count.");
  const blueprint = blueprintFor(type, level);
  for (const question of questions) {
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length) throw new Error("AI returned an invalid answer index.");
    if (!question.prompt.trim() || !question.explanation.trim()) throw new Error("AI returned an incomplete question.");
    if (new Set(question.options.map((option) => option.trim().toLowerCase())).size !== 4) throw new Error("AI returned duplicate answer choices.");
    validateBlankPlacement(question);
    if (type === "reading") {
      const words = question.passage.trim().split(/\s+/).filter(Boolean).length;
      if (words < blueprint.wordRange[0] || words > blueprint.wordRange[1]) throw new Error("AI reading passage is outside the target length.");
    } else if (question.passage !== "") throw new Error("AI returned an unexpected passage.");
    if (type === "listening" && question.audioText.trim().split(/\s+/).length < 8) throw new Error("AI listening script is too short.");
    if (type !== "listening" && question.audioText !== "") throw new Error("AI returned an unexpected audio script.");
  }
}
