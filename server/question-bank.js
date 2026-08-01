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
  },
  {
    id: "reading-001", type: "reading", level: "A2", topic: "annonce",
    passage: "Bibliothèque municipale\nFermeture exceptionnelle mardi matin pour travaux. Réouverture mardi à 14 h. Les livres à rendre peuvent être déposés dans la boîte située à l'entrée.",
    prompt: "Quand peut-on de nouveau entrer dans la bibliothèque ?",
    options: ["Lundi soir", "Mardi matin", "Mardi après-midi", "Mercredi matin"], answer: 2,
    explanation: "Le document indique une réouverture mardi à 14 h, donc l'après-midi.", skill: "information_explicite"
  },
  {
    id: "reading-002", type: "reading", level: "A2", topic: "message personnel",
    passage: "Salut Nina, je serai en retard ce soir. Ne m'attends pas pour dîner : ma réunion finit à 20 h. J'ai laissé les clés chez la voisine. À tout à l'heure ! Marc",
    prompt: "Pourquoi Marc écrit-il à Nina ?",
    options: ["Pour annuler une réunion", "Pour expliquer son retard", "Pour inviter la voisine", "Pour demander ses clés"], answer: 1,
    explanation: "Marc annonce qu'il sera en retard et en donne la raison.", skill: "but_du_message"
  },
  {
    id: "reading-003", type: "reading", level: "A2", topic: "service",
    passage: "Votre colis est arrivé au point relais des Lilas. Vous pouvez le retirer jusqu'au 12 septembre, sur présentation d'une pièce d'identité. Le point relais est fermé le dimanche.",
    prompt: "Que faut-il apporter pour récupérer le colis ?",
    options: ["Une photo", "Une facture", "Une pièce d'identité", "Une carte bancaire"], answer: 2,
    explanation: "Le retrait se fait « sur présentation d'une pièce d'identité ».", skill: "consigne"
  },
  {
    id: "reading-004", type: "reading", level: "A2", topic: "logement",
    passage: "Studio meublé près de la gare, disponible dès le 1er juin. 620 euros par mois, charges comprises. Visites uniquement le samedi sur rendez-vous. Contact par courriel.",
    prompt: "Quelle affirmation est correcte ?",
    options: ["Le logement est vide", "Les visites sont libres", "Les charges sont incluses", "Il faut téléphoner"], answer: 2,
    explanation: "L'annonce précise « charges comprises », donc elles sont incluses dans le prix.", skill: "information_explicite"
  },
  {
    id: "reading-005", type: "reading", level: "B1", topic: "travail",
    passage: "Depuis janvier, notre entreprise autorise deux jours de télétravail par semaine. Au début, certains responsables craignaient une baisse de la coopération. Après six mois, les équipes déclarent pourtant mieux organiser leur temps et les réunions sont devenues plus courtes. La direction souhaite donc maintenir ce fonctionnement, tout en proposant une journée commune au bureau pour chaque service.",
    prompt: "Quelle décision la direction a-t-elle prise ?",
    options: ["Supprimer le travail à distance", "Réduire le nombre de réunions", "Conserver le dispositif en l'adaptant", "Laisser chaque salarié travailler toujours chez lui"], answer: 2,
    explanation: "La direction maintient le télétravail mais ajoute une journée commune : elle conserve et adapte le dispositif.", skill: "idee_principale"
  },
  {
    id: "reading-006", type: "reading", level: "B1", topic: "environnement",
    passage: "La ville vient d'installer des fontaines à eau dans plusieurs parcs. L'objectif n'est pas seulement d'aider les habitants pendant les fortes chaleurs. La mairie espère surtout diminuer l'achat de bouteilles en plastique. Pour accompagner cette mesure, des gourdes seront distribuées lors de la fête du quartier. Un premier bilan sera publié à la fin de l'été.",
    prompt: "Quel est le principal objectif de cette initiative ?",
    options: ["Attirer davantage de touristes", "Réduire les déchets en plastique", "Organiser une fête municipale", "Mesurer la température des parcs"], answer: 1,
    explanation: "Le texte précise que la mairie espère « surtout » diminuer l'achat de bouteilles en plastique.", skill: "idee_principale"
  },
  {
    id: "reading-007", type: "reading", level: "B1", topic: "éducation",
    passage: "Je suivais des cours du soir depuis plusieurs mois, mais je progressais peu à l'oral. Mon professeur m'a conseillé de rejoindre un groupe de conversation. J'hésitais, car j'avais peur de faire des erreurs devant les autres. Finalement, l'ambiance bienveillante m'a rassurée. Je parle aujourd'hui avec plus de facilité, même si mon français n'est pas parfait.",
    prompt: "Qu'est-ce qui a permis à cette personne de progresser ?",
    options: ["Des exercices écrits supplémentaires", "Un changement de professeur", "Des échanges dans un cadre rassurant", "Un séjour dans un pays francophone"], answer: 2,
    explanation: "Le groupe de conversation et son ambiance bienveillante lui ont permis de parler plus facilement.", skill: "cause_consequence"
  },
  {
    id: "reading-008", type: "reading", level: "B1", topic: "consommation",
    passage: "Les ateliers de réparation rencontrent un succès croissant. On y apporte un grille-pain, un vélo ou un vêtement abîmé, puis des bénévoles montrent comment lui donner une seconde vie. Les visiteurs viennent d'abord pour économiser, mais beaucoup apprécient aussi d'apprendre un savoir-faire. Ces ateliers ne remplacent pas les professionnels : ils interviennent surtout pour les petites réparations et orientent les participants lorsque le problème est complexe.",
    prompt: "Que souligne le texte à propos de ces ateliers ?",
    options: ["Ils réparent uniquement des appareils électriques", "Ils permettent aussi d'acquérir des compétences", "Ils font concurrence aux réparateurs professionnels", "Ils sont réservés aux personnes bénévoles"], answer: 1,
    explanation: "Au-delà de l'économie, les visiteurs apprécient d'y apprendre un savoir-faire.", skill: "information_detaillee"
  },
  {
    id: "reading-009", type: "reading", level: "B1", topic: "mobilité",
    passage: "Pour aller travailler, Léa utilisait sa voiture, même si son bureau n'était qu'à cinq kilomètres. Lorsque des pistes cyclables ont été aménagées dans son quartier, elle a essayé le vélo. Le trajet lui prend à peine plus de temps et elle n'a plus à chercher une place de stationnement. Elle garde néanmoins sa voiture les jours de forte pluie.",
    prompt: "Pourquoi Léa utilise-t-elle désormais souvent son vélo ?",
    options: ["Son bureau a déménagé", "Elle ne possède plus de voiture", "Le trajet est devenu plus pratique", "Les transports publics ont été supprimés"], answer: 2,
    explanation: "Les pistes cyclables et l'absence de recherche de stationnement rendent le trajet plus pratique.", skill: "inference"
  },
  {
    id: "reading-010", type: "reading", level: "B1", topic: "médias",
    passage: "De nombreuses personnes consultent les actualités sur leur téléphone dès le réveil. Cette habitude permet de s'informer rapidement, mais elle favorise parfois une lecture trop rapide des titres. Or un titre cherche souvent à attirer l'attention et ne résume pas toute l'information. Avant de partager un article, il est donc utile de le lire entièrement et d'en vérifier la source.",
    prompt: "Quel conseil l'auteur donne-t-il ?",
    options: ["Lire uniquement les titres les plus courts", "Éviter toute information sur téléphone", "Contrôler le contenu avant de le diffuser", "Partager rapidement les nouvelles importantes"], answer: 2,
    explanation: "L'auteur recommande de lire l'article et de vérifier sa source avant de le partager.", skill: "intention_auteur"
  }
];
