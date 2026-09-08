import { readFile, writeFile } from "node:fs/promises";
import { generateQuestions, validateGeneratedQuestions } from "../server/ai-generator.js";
import { questionBank } from "../server/question-bank.js";

const normalize = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/\s+/g, " ").trim();
const plans = {
  grammar: [
    ["A2", ["présent", "passé composé", "futur proche", "articles", "prépositions", "pronoms COD/COI simples", "comparaison", "négation"]],
    ["B1", ["imparfait et passé composé", "plus-que-parfait", "futur", "conditionnel présent", "subjonctif fréquent", "pronoms y et en", "pronoms relatifs", "hypothèse avec si", "connecteurs logiques", "discours indirect simple"]]
  ],
  reading: [
    ["A2", ["repérer une information explicite", "comprendre une consigne", "identifier le but d'un message", "comprendre une correspondance simple"]],
    ["B1", ["identifier l'idée principale", "relier des informations", "comprendre une cause ou une conséquence", "inférer une intention", "comprendre un point de vue clairement exprimé", "déduire le sens d'un mot en contexte"]]
  ]
};

async function build(type) {
  const result = [];
  for (const [level, skills] of plans[type]) {
    for (let group = 0; group < 5; group++) {
      const questions = await generateQuestions({ type, level, count: 5, weakSkills: skills.slice(group * 2, group * 2 + 3) });
      result.push(...questions);
      console.log(`${type} ${level}: ${result.length}/${type === "grammar" ? 50 : 50}`);
    }
  }
  return result;
}

function finalize(items, type, prefix) {
  const existing = new Set(questionBank.filter((item) => item.type === type).map((item) => normalize(type === "reading" ? `${item.passage}\n${item.prompt}` : item.prompt)));
  const own = new Set();
  return items.map((item, index) => {
    const signature = normalize(type === "reading" ? `${item.passage}\n${item.prompt}` : item.prompt);
    if (existing.has(signature) || own.has(signature)) throw new Error(`Duplicate ${type} question at ${index + 1}`);
    own.add(signature);
    const levelIndex = index < 25 ? 0 : 1;
    const withinLevel = index % 25;
    const difficulty = levelIndex ? 5 + Math.floor(withinLevel / 5) : 1 + Math.floor(withinLevel / 6);
    const correct = item.options[item.answer];
    const options = item.options.filter((_, optionIndex) => optionIndex !== item.answer);
    const answer = index % 4;
    options.splice(answer, 0, correct);
    return { ...item, options, answer, id: `${prefix}-${String(index + 151).padStart(3, "0")}`, type, level: index < 25 ? "A2" : "B1", difficulty, exam: "tcf", source: "mock", batch: 4, answerVerified: true, order: index + 151 };
  });
}

const grammar = finalize(await build("grammar"), "grammar", "mock-msl");
const reading = finalize(await build("reading"), "reading", "mock-reading");
validateGeneratedQuestions(grammar.slice(0, 25), { type: "grammar", level: "A2", count: 25 });
validateGeneratedQuestions(grammar.slice(25), { type: "grammar", level: "B1", count: 25 });
validateGeneratedQuestions(reading.slice(0, 25), { type: "reading", level: "A2", count: 25 });
validateGeneratedQuestions(reading.slice(25), { type: "reading", level: "B1", count: 25 });

await writeFile(new URL("../server/mock-grammar-batch-004.json", import.meta.url), `${JSON.stringify(grammar, null, 2)}\n`);
await writeFile(new URL("../server/mock-reading-batch-004.json", import.meta.url), `${JSON.stringify(reading, null, 2)}\n`);
console.log("Batch 004 written: 50 grammar + 50 reading");
