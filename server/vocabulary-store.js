import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { aiEnabled, completeAi } from "./ai-client.js";

const file = path.resolve("server/data/vocabulary.json");

const lexicon = {
  pourtant: { meaningZh: "然而、可是", partOfSpeech: "连接副词", usageFr: "Introduit une opposition avec ce qui précède.", usageZh: "表示与前文相反或出乎预料的情况，常可与 cependant 对照学习。", examples: ["Il était fatigué. Pourtant, il a continué.", "Ce projet est difficile, pourtant il est utile."], collocations: ["et pourtant", "pourtant bien"] },
  malgré: { meaningZh: "尽管、不顾", partOfSpeech: "介词", usageFr: "Se place devant un nom ou un pronom pour exprimer la concession.", usageZh: "后接名词或代词；如果后面是完整从句，通常使用 bien que。", examples: ["Malgré la pluie, nous sommes sortis.", "Elle a réussi malgré les difficultés."], collocations: ["malgré tout", "malgré les difficultés"] },
  cependant: { meaningZh: "然而、不过", partOfSpeech: "连接副词", usageFr: "Marque une opposition dans un registre plutôt neutre ou soutenu.", usageZh: "用于引出转折，语体比 mais 稍正式，可位于句首或句中。", examples: ["La solution est simple. Cependant, elle coûte cher.", "Il est jeune, cependant il a beaucoup d'expérience."], collocations: ["cependant que", "et cependant"] },
  obtenir: { meaningZh: "获得、取得", partOfSpeech: "动词", usageFr: "Verbe transitif : recevoir ou parvenir à avoir quelque chose.", usageZh: "常和 poste、résultat、autorisation、diplôme 等名词搭配。", examples: ["Elle a obtenu un poste à Lyon.", "Vous devez obtenir une autorisation."], collocations: ["obtenir un résultat", "obtenir un poste", "obtenir l'autorisation"] },
  fiable: { meaningZh: "可靠的、可信赖的", partOfSpeech: "形容词", usageFr: "Qualifie une personne, une source ou un objet auquel on peut faire confiance.", usageZh: "可以形容人、信息来源、设备或方法；阴阳性形式相同。", examples: ["Cette source est fiable.", "Nous cherchons une méthode fiable."], collocations: ["source fiable", "méthode fiable", "personne fiable"] },
  délai: { meaningZh: "期限、规定时间", partOfSpeech: "阳性名词", usageFr: "Période accordée pour accomplir une action.", usageZh: "常见于行政、工作和服务场景；注意 respecter un délai 是“遵守期限”。", examples: ["Le délai est de quinze jours.", "Nous devons respecter ce délai."], collocations: ["dans un délai de", "respecter un délai", "délai supplémentaire"] },
  acquérir: { meaningZh: "获得、习得", partOfSpeech: "动词", usageFr: "Obtenir progressivement un savoir, une compétence ou un bien.", usageZh: "用于逐渐获得知识、能力或财产，常搭配 compétences、expérience、connaissances。", examples: ["Cette formation permet d'acquérir de nouvelles compétences.", "Il a acquis beaucoup d'expérience."], collocations: ["acquérir une compétence", "acquérir de l'expérience", "acquérir des connaissances"] },
  temporaire: { meaningZh: "临时的、暂时的", partOfSpeech: "形容词", usageFr: "Qui ne dure que pendant une période limitée.", usageZh: "与 permanent 相对；可形容工作、展览、措施或住所。", examples: ["Il cherche un logement temporaire.", "Cette mesure est temporaire."], collocations: ["emploi temporaire", "mesure temporaire", "exposition temporaire"] }
};

async function readNotebook() {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return { entries: [] }; throw error; }
}

export async function listVocabulary() { return (await readNotebook()).entries; }

export async function saveVocabulary(entry) {
  const notebook = await readNotebook();
  const normalized = entry.word.toLocaleLowerCase("fr").trim();
  const existing = notebook.entries.find((item) => item.normalized === normalized);
  if (existing) {
    existing.contexts = [...new Set([...existing.contexts, entry.context].filter(Boolean))].slice(-5);
    existing.updatedAt = new Date().toISOString();
  } else notebook.entries.unshift({ id: crypto.randomUUID(), normalized, word: entry.word.trim(), contexts: [entry.context].filter(Boolean), questionId: entry.questionId || null, mastered: false, createdAt: new Date().toISOString() });
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(notebook, null, 2));
  return notebook.entries.find((item) => item.normalized === normalized);
}

export async function toggleMastered(id) {
  const notebook = await readNotebook(); const entry = notebook.entries.find((item) => item.id === id);
  if (!entry) return null; entry.mastered = !entry.mastered; entry.updatedAt = new Date().toISOString();
  await writeFile(file, JSON.stringify(notebook, null, 2)); return entry;
}

export function localLookup(word) { return lexicon[word.toLocaleLowerCase("fr").trim()] || null; }

export async function aiLookup(word, context = "") {
  if (!aiEnabled()) return null;
  const schema = { type: "object", additionalProperties: false, required: ["meaningZh", "partOfSpeech", "usageFr", "usageZh", "examples", "collocations"], properties: { meaningZh: { type: "string" }, partOfSpeech: { type: "string" }, usageFr: { type: "string" }, usageZh: { type: "string" }, examples: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } }, collocations: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } } } };
  const output = await completeAi({ instructions: "Tu es un lexicographe français-chinois précis. Explique le mot dans son contexte, au niveau A2-B1. Les exemples doivent être naturels, courts et utiles pour le TCF/TEF.", input: `Mot ou expression : ${word}\nContexte : ${context || "non fourni"}\nRéponds uniquement en JSON.`, schema, schemaName: "vocabulary_usage" });
  return output ? JSON.parse(output) : null;
}
