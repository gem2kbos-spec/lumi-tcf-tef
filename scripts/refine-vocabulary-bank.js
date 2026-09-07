import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../server/mock-vocabulary-batch-001.json", import.meta.url);
const questions = JSON.parse(await readFile(file, "utf8"));
const fixes = {
  5: ["Contrairement à sa sœur très bavarde, Léa est plutôt _____.", ["discrète", "pressée", "souple", "curieuse"], "Discret décrit une personne qui parle peu et ne cherche pas à attirer l'attention; c'est l'opposition précise à bavarde dans ce contexte."],
  11: ["Après une semaine épuisante, j'ai surtout besoin de _____.", ["changer", "partager", "me reposer", "prévoir"], "Après une période épuisante, avoir besoin de se reposer signifie récupérer; les autres verbes n'expriment pas cette nécessité."],
  14: ["Le pharmacien m'a conseillé de _____ ce comprimé avec un grand verre d'eau.", ["manger", "prendre", "boire", "cuisiner"], "On prend un comprimé ou un médicament. Boire s'applique ici au verre d'eau, pas au comprimé."],
  15: ["Le propriétaire a décidé d'_____ le loyer de cinquante euros à partir de janvier.", ["rembourser", "offrir", "augmenter", "supprimer"], "Augmenter le loyer signifie en relever le montant; la précision de cinquante euros confirme cette hausse."],
  22: ["Ce trajet comporte trois correspondances; cherchons un itinéraire plus _____.", ["matinal", "direct", "bruyant", "fragile"], "Un itinéraire direct comporte peu ou pas de correspondances. Les autres adjectifs ne répondent pas au problème indiqué."],
  23: ["Selon l'ordonnance, je dois _____ ce médicament pendant cinq jours.", ["éviter", "offrir", "prendre", "ranger"], "Prendre un médicament est la collocation employée pour suivre un traitement prescrit."],
  29: ["Ma sœur est très _____ : elle arrive toujours exactement à l'heure à ses rendez-vous.", ["ponctuelle", "distraite", "maladroite", "bavarde"], "Une personne ponctuelle respecte les horaires; l'indice décisif est qu'elle arrive toujours à l'heure."],
  32: ["La ville veut _____ la quantité de déchets envoyés à la décharge.", ["célébrer", "conserver", "ignorer", "réduire"], "Réduire une quantité signifie la rendre moins importante. Les autres verbes contredisent l'objectif environnemental."],
  33: ["Elle a posé sa candidature au _____ de responsable commercial.", ["poste", "salaire", "bureau", "diplôme"], "Poser sa candidature à un poste est la collocation exacte pour désigner une fonction précise à pourvoir."],
  34: ["Le prix affiché _____ déjà les frais de livraison; vous n'aurez rien à ajouter.", ["cache", "comprend", "refuse", "retire"], "Comprendre des frais signifie les inclure dans le montant annoncé; la suite confirme qu'aucun supplément n'est dû."],
  35: ["Avant de publier l'article, la journaliste doit _____ l'exactitude de chaque chiffre.", ["inventer", "résumer", "vérifier", "annoncer"], "Vérifier l'exactitude signifie contrôler qu'une information est correcte avant publication."],
  37: ["Grâce à la nouvelle rampe, ce bâtiment est _____ aux personnes en fauteuil roulant.", ["accessible", "secret", "interdit", "réservé"], "Accessible à quelqu'un signifie qu'il peut entrer ou utiliser le lieu; la rampe constitue l'indice décisif."],
  39: ["Après l'incident, l'entreprise a _____ une enquête interne.", ["interdit", "perdu", "ouvert", "fermé"], "Ouvrir une enquête est l'expression consacrée pour commencer officiellement des recherches."],
  40: ["Après plusieurs semaines de négociation, les deux parties ont finalement _____ les termes du contrat.", ["annulé", "oublié", "contesté", "accepté"], "Accepter les termes d'un contrat marque l'accord qui met fin à la négociation."],
  42: ["Le soleil et le vent sont des sources d'énergie _____.", ["fossiles", "renouvelables", "souterraines", "épuisées"], "Le solaire et l'éolien sont des énergies renouvelables, contrairement aux sources fossiles et épuisables."],
  43: ["Avant de réserver mon voyage, je dois _____ la date d'expiration de mon passeport.", ["raconter", "observer", "vérifier", "dessiner"], "Vérifier une date signifie contrôler qu'elle convient; cette action est nécessaire avant une réservation internationale."],
  44: ["Après dix heures de route sans pause, le conducteur s'est presque _____ au volant.", ["trompé", "levé", "enfui", "endormi"], "S'endormir au volant est la conséquence précise d'une conduite prolongée sans pause."],
  48: ["Après plusieurs jours de ciel gris, le soleil est enfin _____ ce matin.", ["tombé", "fermé", "rangé", "revenu"], "Le soleil est revenu signifie qu'il est réapparu après une période où il n'était pas visible."],
  50: ["Cette marque de luxe vend ses produits à des prix particulièrement _____.", ["doux", "élevés", "bas", "légers"], "Des prix élevés sont des prix importants. Doux, bas et légers expriment l'idée contraire ou ne s'appliquent pas ici."],
  52: ["Pour connaître toutes vos obligations, veuillez _____ attentivement le règlement.", ["signer", "ranger", "imprimer", "lire"], "Lire un règlement permet d'en connaître le contenu; attentivement confirme l'action de lecture."],
  60: ["Avant de servir la soupe, il faut la _____ dans les bols.", ["couper", "battre", "râper", "verser"], "Verser un liquide signifie le faire couler dans un récipient; les autres verbes ne conviennent pas à une soupe servie dans des bols."],
  64: ["Sans ce code, il est impossible d'accéder au compte : il est donc _____.", ["facultatif", "temporaire", "décoratif", "indispensable"], "Indispensable signifie absolument nécessaire; l'impossibilité d'accéder au compte sans le code le prouve."],
  71: ["Face à des horaires qui changent chaque semaine, ce poste exige beaucoup de _____.", ["discrétion", "autorité", "flexibilité", "solitude"], "La flexibilité est la capacité à s'adapter facilement aux changements, ici aux variations d'horaires."],
  72: ["Avant d'envoyer le formulaire, pensez à _____ que toutes les cases obligatoires sont remplies.", ["annoncer", "supposer", "imaginer", "vérifier"], "Vérifier que les cases sont remplies signifie effectuer le contrôle nécessaire avant l'envoi."],
  74: ["J'ai reçu un article qui n'est pas le bon; je vais le _____ au magasin pour être remboursé.", ["réparer", "rapporter", "conserver", "utiliser"], "Rapporter un article au magasin signifie l'y ramener; la demande de remboursement confirme cette action."],
  75: ["À l'annonce de la mort du personnage principal, plusieurs spectateurs ont _____.", ["souri", "discuté", "pleuré", "dansé"], "Pleurer est la réaction cohérente à l'annonce triste de la mort du personnage; les autres réactions contredisent ce contexte."],
  76: ["Ce dossier présente les données, les causes, les conséquences et les solutions; il offre un aperçu _____.", ["partial", "vague", "bref", "complet"], "Complet signifie qui couvre tous les aspects essentiels, comme l'énumération détaillée l'indique."]
};

for (const [number, [prompt, options, explanation]] of Object.entries(fixes)) {
  const question = questions[Number(number) - 1]; question.prompt = prompt; question.options = options; question.explanation = explanation;
}

await writeFile(file, `${JSON.stringify(questions, null, 2)}\n`);
console.log(`${Object.keys(fixes).length} questions ambiguës réécrites`);
