const CATEGORY_COVERAGE = {
  articles: ["determiners"], prépositions: ["prepositions", "verb-patterns"],
  "pronoms COD/COI simples": ["pronouns"], comparaison: ["adjectives-adverbs", "sentence-structure"], négation: ["sentence-structure"],
  "pronoms y et en": ["pronouns"], "pronoms relatifs": ["relative-pronouns"], "connecteurs logiques": ["connectors"],
  "repérer une information explicite": ["reading-explicit"], "comprendre une consigne": ["reading-explicit"],
  "identifier le but d'un message": ["reading-purpose"], "comprendre une correspondance simple": ["reading-explicit"],
  "identifier l'idée principale": ["reading-purpose"], "relier des informations": ["reading-inference"],
  "comprendre une cause ou une conséquence": ["reading-inference"], "inférer une intention": ["reading-purpose", "reading-inference"],
  "comprendre un point de vue clairement exprimé": ["reading-purpose"], "déduire le sens d'un mot en contexte": ["reading-inference", "meaning-context"]
};

const SKILL_ALIASES = {
  présent: ["présent", "现在时"], "passé composé": ["passé composé", "复合过去时"], "futur proche": ["futur proche", "近期将来"],
  "imparfait et passé composé": ["imparfait", "未完成过去时"], "plus-que-parfait": ["plus-que-parfait", "愈过去时"],
  futur: ["futur", "将来时"], "conditionnel présent": ["conditionnel", "条件式"], "subjonctif fréquent": ["subjonctif", "虚拟式"],
  "pronoms relatifs": ["pronom relatif", "关系代词", "dont", "lequel", "laquelle"],
  "hypothèse avec si": ["si +", "hypothèse", "条件句"], "discours indirect simple": ["discours indirect", "间接引语"]
};

function searchable(question) {
  return [question.prompt, question.passage, question.topic, question.skill, question.category, question.explanation, ...(question.options || [])]
    .join(" ").toLocaleLowerCase("fr");
}

export function questionCoversSkill(question, skill) {
  if (question.skill === skill) return true;
  if ((CATEGORY_COVERAGE[skill] || []).includes(question.category)) return true;
  const text = searchable(question);
  return (SKILL_ALIASES[skill] || [skill]).some((alias) => text.includes(alias.toLocaleLowerCase("fr")));
}

export function coverageGaps(questions, type, skills) {
  const relevant = questions.filter((question) => question.type === type);
  return skills.filter((skill) => !relevant.some((question) => questionCoversSkill(question, skill)));
}
