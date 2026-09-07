import { writeFile } from "node:fs/promises";
import { generateQuestions } from "../server/ai-generator.js";

const batches = [["A2", 10], ["A2", 10], ["A2", 10], ["B1", 10], ["B1", 10], ["B1", 10], ["B1", 10], ["B1", 7]];
const result = [];
let sequence = 1;

for (const [level, count] of batches) {
  const questions = await generateQuestions({
    type: "vocabulary",
    level,
    count,
    variationRequest: "Couvre de façon équilibrée le sens en contexte, les synonymes et antonymes, les collocations, les verbes précis, les expressions courantes et le registre. Chaque prompt doit obligatoirement être une question explicite avec un point d'interrogation, ou une phrase à compléter contenant exactement un blanc _____. Ne donne jamais une simple phrase déclarative comme prompt. Varie les thèmes du français général utiles au TCF et au TEF. Évite les connaissances spécialisées, les phrases artificielles, les réponses discutables et toute question déjà connue."
  });
  result.push(...questions.map((question) => ({
    ...question,
    id: `mock-vocabulary-001-${String(sequence++).padStart(3, "0")}`,
    source: "mock",
    exam: sequence % 4 === 0 ? "tef" : "tcf",
    difficulty: level === "A2" ? 3 + Math.floor((sequence % 3) / 2) : 5 + Math.floor((sequence % 4) / 2)
  })));
  console.log(`${level}: ${result.length}/77 questions validées`);
}

const normalized = (value) => value.trim().toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
if (result.length !== 77) throw new Error(`Expected 77 questions, received ${result.length}`);
if (new Set(result.map((question) => normalized(question.prompt))).size !== result.length) throw new Error("Duplicate prompts generated");
if (result.some((question) => question.type !== "vocabulary" || question.passage || question.audioText || question.options.length !== 4 || !Number.isInteger(question.answer) || !/[?？]|_{2,}|…{2,}|\.{3,}/.test(question.prompt))) throw new Error("Invalid vocabulary question structure");
result.forEach((question, index) => {
  const correct = question.options[question.answer]; const distractors = question.options.filter((_, optionIndex) => optionIndex !== question.answer);
  const target = index % 4; question.options = [...distractors.slice(0, target), correct, ...distractors.slice(target)]; question.answer = target;
  const skill = normalized(question.skill);
  question.skill = skill.includes("colloc") || skill.includes("expression") ? "collocation" : skill.includes("antonyme") ? "antonymes" : skill.includes("synonyme") ? "synonymes" : "sens_en_contexte";
  question.topic = question.topic.trim().toLocaleLowerCase("fr");
});
await writeFile(new URL("../server/mock-vocabulary-batch-001.json", import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
