export const TCF_BLUEPRINT = {
  exam: "TCF Tout Public",
  principles: [
    "QCM à quatre choix avec une seule réponse exacte",
    "français général, sans connaissance culturelle spécialisée requise",
    "difficulté progressive et distracteurs plausibles",
    "documents et questions originaux, jamais copiés d'une épreuve officielle"
  ],
  levels: {
    A2: {
      readingWords: [25, 90],
      reading: ["repérer une information explicite", "comprendre une consigne", "identifier le but d'un message", "comprendre une correspondance simple"],
      grammar: ["présent", "passé composé", "futur proche", "articles", "prépositions", "pronoms COD/COI simples", "comparaison", "négation"],
      vocabulary: ["vie quotidienne", "logement", "achats", "transport", "santé", "travail", "loisirs", "services"]
    },
    B1: {
      readingWords: [70, 180],
      reading: ["identifier l'idée principale", "relier des informations", "comprendre une cause ou une conséquence", "inférer une intention", "comprendre un point de vue clairement exprimé", "déduire le sens d'un mot en contexte"],
      grammar: ["imparfait et passé composé", "plus-que-parfait", "futur", "conditionnel présent", "subjonctif fréquent", "pronoms y et en", "pronoms relatifs", "hypothèse avec si", "connecteurs logiques", "discours indirect simple"],
      vocabulary: ["travail", "éducation", "environnement", "technologie", "culture", "médias", "société", "relations", "mobilité", "consommation"]
    }
  },
  readingDocuments: ["annonce", "affiche", "courriel", "message administratif", "témoignage", "article informatif", "texte d'opinion accessible"]
};

export function blueprintFor(type, level) {
  const selected = TCF_BLUEPRINT.levels[level] || TCF_BLUEPRINT.levels.B1;
  return {
    principles: TCF_BLUEPRINT.principles,
    skills: selected[type] || [],
    ...(type === "reading" ? { wordRange: selected.readingWords, documents: TCF_BLUEPRINT.readingDocuments } : {})
  };
}
