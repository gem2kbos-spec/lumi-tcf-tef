export const questionBank = [
  {
    id: "vocab-001", type: "vocabulary", level: "A2", topic: "vie quotidienne",
    prompt: "Dans la phrase « Le magasin ferme bientôt, il faut se dépêcher », que signifie « se dépêcher » ?",
    options: ["Attendre calmement", "Faire vite", "Changer d'avis", "Demander de l'aide"],
    answer: 1,
    explanation: "« Se dépêcher » signifie agir rapidement, faire vite.",
    skill: "sens_en_contexte"
  },
  {
    id: "vocab-002", type: "vocabulary", level: "B1", topic: "travail",
    prompt: "Quel mot complète le mieux la phrase ? « Malgré son manque d'expérience, elle a réussi à _____ le poste. »",
    options: ["obtenir", "subir", "quitter", "rendre"],
    answer: 0,
    explanation: "On « obtient un poste » lorsqu'on est choisi pour un emploi.",
    skill: "collocation"
  },
  {
    id: "vocab-003", type: "vocabulary", level: "B1", topic: "société",
    prompt: "Lequel est le synonyme le plus proche de « pourtant » ?",
    options: ["donc", "cependant", "puisque", "ensuite"],
    answer: 1,
    explanation: "« Pourtant » et « cependant » introduisent tous deux une opposition.",
    skill: "synonymes"
  },
  {
    id: "vocab-004", type: "vocabulary", level: "B1", topic: "environnement",
    prompt: "Que signifie « réduire les déchets » ?",
    options: ["Les trier par couleur", "En produire moins", "Les déplacer", "Les vendre"],
    answer: 1,
    explanation: "« Réduire » signifie diminuer la quantité.",
    skill: "sens_en_contexte"
  },
  {
    id: "grammar-001", type: "grammar", level: "B1", topic: "subjonctif",
    prompt: "Il faut que tu _____ plus attention.",
    options: ["fais", "fasses", "faire", "feras"],
    answer: 1,
    explanation: "« Il faut que » exige le subjonctif : que tu fasses.",
    skill: "subjonctif"
  },
  {
    id: "grammar-002", type: "grammar", level: "B1", topic: "temps du passé",
    prompt: "Quand je suis arrivé, le film _____ déjà commencé.",
    options: ["a", "avait", "est", "aurait"],
    answer: 1,
    explanation: "L'action avait commencé avant l'arrivée : on emploie le plus-que-parfait.",
    skill: "plus_que_parfait"
  },
  {
    id: "grammar-003", type: "grammar", level: "A2", topic: "pronoms",
    prompt: "Tu vas à la bibliothèque ? Oui, j'_____ vais maintenant.",
    options: ["en", "y", "la", "lui"],
    answer: 1,
    explanation: "Le pronom « y » remplace un lieu introduit par « à ».",
    skill: "pronom_y"
  },
  {
    id: "grammar-004", type: "grammar", level: "B1", topic: "conditionnel",
    prompt: "Si j'avais plus de temps, je _____ le français tous les jours.",
    options: ["pratique", "pratiquerai", "pratiquerais", "pratiquais"],
    answer: 2,
    explanation: "Avec « si + imparfait », la conséquence se met au conditionnel présent.",
    skill: "hypothese"
  },
  {
    id: "grammar-005", type: "grammar", level: "B1", topic: "pronoms relatifs",
    prompt: "C'est un sujet _____ nous parlons souvent.",
    options: ["que", "qui", "dont", "où"],
    answer: 2,
    explanation: "On dit « parler de » : « dont » remplace « de ce sujet ».",
    skill: "pronom_dont"
  },
  {
    id: "grammar-006", type: "grammar", level: "B1", topic: "concession",
    prompt: "_____ la pluie, ils ont décidé de sortir.",
    options: ["Grâce à", "Malgré", "À cause", "Pendant"], answer: 1,
    explanation: "« Malgré » est suivi d'un nom et exprime une opposition.", skill: "connecteurs"
  },
  {
    id: "grammar-007", type: "grammar", level: "A2", topic: "temps du passé",
    prompt: "Hier soir, nous _____ un film français.",
    options: ["regardons", "avons regardé", "regarderons", "regardions"], answer: 1,
    explanation: "Une action achevée hier se met au passé composé.", skill: "passe_compose"
  },
  {
    id: "grammar-008", type: "grammar", level: "B1", topic: "cause",
    prompt: "Elle a progressé _____ elle s'entraîne chaque jour.",
    options: ["bien que", "parce qu'", "afin qu'", "malgré"], answer: 1,
    explanation: "« Parce que » introduit la cause avec une proposition verbale.", skill: "connecteurs"
  },
  {
    id: "grammar-009", type: "grammar", level: "B1", topic: "pronoms",
    prompt: "Tu veux du café ? Non merci, je n'_____ veux plus.",
    options: ["y", "en", "le", "lui"], answer: 1,
    explanation: "« En » remplace une quantité introduite par « du ».", skill: "pronom_en"
  },
  {
    id: "grammar-010", type: "grammar", level: "B1", topic: "discours indirect",
    prompt: "Paul dit : « Je viendrai demain. » Paul dit qu'il _____ le lendemain.",
    options: ["viendra", "venait", "viendrait", "est venu"], answer: 0,
    explanation: "Avec un verbe introducteur au présent, le futur reste au futur.", skill: "discours_indirect"
  },
  {
    id: "vocab-005", type: "vocabulary", level: "A2", topic: "logement",
    prompt: "L'appartement est « lumineux ». Cela signifie qu'il _____.",
    options: ["coûte peu", "reçoit beaucoup de lumière", "est très petit", "se trouve loin"], answer: 1,
    explanation: "Un logement lumineux reçoit beaucoup de lumière naturelle.", skill: "sens_en_contexte"
  },
  {
    id: "vocab-006", type: "vocabulary", level: "B1", topic: "éducation",
    prompt: "Quel verbe complète la phrase ? « Cette formation permet d'_____ de nouvelles compétences. »",
    options: ["acquérir", "atteindre", "apporter", "assister"], answer: 0,
    explanation: "On « acquiert des compétences », c'est-à-dire qu'on les développe.", skill: "collocation"
  },
  {
    id: "vocab-007", type: "vocabulary", level: "B1", topic: "technologie",
    prompt: "Une application « fiable » est une application qui _____.",
    options: ["est gratuite", "fonctionne de manière sûre", "est récente", "utilise peu de couleurs"], answer: 1,
    explanation: "« Fiable » signifie digne de confiance et qui fonctionne correctement.", skill: "sens_en_contexte"
  },
  {
    id: "vocab-008", type: "vocabulary", level: "B1", topic: "santé",
    prompt: "Quel est le contraire de « améliorer » ?",
    options: ["augmenter", "prévenir", "aggraver", "soigner"], answer: 2,
    explanation: "« Aggraver » signifie rendre une situation plus mauvaise.", skill: "antonymes"
  },
  {
    id: "vocab-009", type: "vocabulary", level: "B1", topic: "travail",
    prompt: "Dans « respecter un délai », que signifie « délai » ?",
    options: ["Une réunion", "Une période accordée", "Un salaire", "Une responsabilité"], answer: 1,
    explanation: "Un délai est le temps accordé pour accomplir quelque chose.", skill: "sens_en_contexte"
  },
  {
    id: "vocab-010", type: "vocabulary", level: "B1", topic: "culture",
    prompt: "Le musée propose une exposition « temporaire ». Elle _____.",
    options: ["ne dure qu'un temps limité", "est toujours gratuite", "a lieu dehors", "est destinée aux enfants"], answer: 0,
    explanation: "« Temporaire » s'oppose à permanent : la durée est limitée.", skill: "sens_en_contexte"
  }
];
