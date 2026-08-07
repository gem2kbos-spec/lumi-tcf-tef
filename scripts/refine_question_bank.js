import { readFile, writeFile } from "node:fs/promises";
import { completeAi, getAiConfig } from "../server/ai-client.js";

const bankUrl = new URL("../server/imports/questions.json", import.meta.url);
const checkpointUrl = new URL("../server/imports/.refinement-checkpoint.json", import.meta.url);
const reportUrl = new URL("../server/imports/refinement-report.json", import.meta.url);
const questions = JSON.parse(await readFile(bankUrl, "utf8"));
const config = getAiConfig();
if (!config.enabled) throw new Error("AI密钥未配置");

let checkpoint = { grammar: {}, levels: {} };
try { checkpoint = JSON.parse(await readFile(checkpointUrl, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
async function saveCheckpoint() { await writeFile(checkpointUrl, `${JSON.stringify(checkpoint, null, 2)}\n`); }

const grammarSchema = {
  type: "object", required: ["items"], properties: { items: { type: "array", items: { type: "object",
    required: ["id", "prompt", "options", "answer", "explanationZh", "explanationFr", "level", "difficulty", "confidence", "sourceIssue"],
    properties: { id: { type: "string" }, prompt: { type: "string" }, options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } }, answer: { type: "integer" }, explanationZh: { type: "string" }, explanationFr: { type: "string" }, level: { type: "string" }, difficulty: { type: "integer" }, confidence: { type: "string" }, sourceIssue: { type: "string" } }
  } } }
};
const levelSchema = {
  type: "object", required: ["items"], properties: { items: { type: "array", items: { type: "object",
    required: ["id", "level", "difficulty", "reason"], properties: { id: { type: "string" }, level: { type: "string" }, difficulty: { type: "integer" }, reason: { type: "string" } }
  } } }
};

function chunks(items, maxItems, maxChars) {
  const output = []; let current = []; let chars = 0;
  for (const item of items) { const size = JSON.stringify(item).length; if (current.length && (current.length >= maxItems || chars + size > maxChars)) { output.push(current); current = []; chars = 0; } current.push(item); chars += size; }
  if (current.length) output.push(current); return output;
}

async function askJson(instructions, items, schema, schemaName) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const parsed = JSON.parse(await completeAi({ instructions, input: `题目数据：${JSON.stringify(items)}\n必须返回 {"items":[...]}，只返回JSON。`, schema, schemaName, maxTokens: 7000 }));
      if (!Array.isArray(parsed.items)) throw new Error("AI结果缺少items数组");
      return parsed.items;
    }
    catch (error) { lastError = error; if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1200 * attempt)); }
  }
  throw lastError;
}

function normalizedOptions(question) {
  if (question.options.length === 5 && /je ne sais pas/i.test(question.options[4])) return question.options.slice(0, 4);
  return question.options;
}

const grammar = questions.filter((question) => question.type === "grammar");
const grammarQueue = grammar.filter((question) => !checkpoint.grammar[question.id]).map((question) => ({ id: question.id, prompt: question.prompt, options: normalizedOptions(question), currentAnswer: question.answer, category: question.category }));
const grammarBatches = chunks(grammarQueue, 8, 8500);
for (let index = 0; index < grammarBatches.length; index++) {
  const batch = grammarBatches[index];
  const results = await askJson("你是TCF/TEF语言结构题终审编辑。逐题独立解答并精修，但不得改变原考点或凭空改写成另一道题。修复明显丢失的填空符号，在应填位置统一使用半角下划线 _。每题必须恰好四个法语选项：删除 je ne sais pas；若源题只有三个选项，补一个同词性、同语境的可信干扰项。answer从0开始。中文解析说明决定性语法或搭配规则并简要排除干扰项；法语解析自然说明同一依据。按题目实际语言能力评估A1-C2和1-10难度，不能按题号顺序。发现源文档错误写入sourceIssue，无则为空。confidence只能是high、medium或low。", batch, grammarSchema, "grammar_refinement");
  for (const source of batch) {
    const result = results.find((item) => item.id === source.id);
    if (!result || result.options?.length !== 4 || !Number.isInteger(result.answer) || result.answer < 0 || result.answer > 3 || !["A1","A2","B1","B2","C1","C2"].includes(result.level) || result.difficulty < 1 || result.difficulty > 10) throw new Error(`语法精修结果无效：${source.id}`);
    checkpoint.grammar[source.id] = result;
  }
  await saveCheckpoint(); console.log(`语法精修 ${index + 1}/${grammarBatches.length}`);
}

const nonGrammar = questions.filter((question) => question.type !== "grammar");
const levelQueue = nonGrammar.filter((question) => !checkpoint.levels[question.id]).map((question) => ({ id: question.id, type: question.type, passage: question.passage || "", prompt: question.prompt, options: question.options }));
const levelBatches = chunks(levelQueue, 12, 10000);
for (let index = 0; index < levelBatches.length; index++) {
  const batch = levelBatches[index];
  const results = await askJson("你是CEFR与TCF/TEF难度评估专家。只评估每道题实际要求的语言能力，不修改题目和答案。综合词汇频率、句法复杂度、文本长度、推断深度和干扰项细微程度，给出A1-C2以及1-10难度。不要按题号或输入顺序机械递增。reason用一句中文说明。", batch, levelSchema, "question_levels");
  for (const source of batch) {
    const result = results.find((item) => item.id === source.id);
    if (!result || !["A1","A2","B1","B2","C1","C2"].includes(result.level) || !Number.isInteger(result.difficulty) || result.difficulty < 1 || result.difficulty > 10) throw new Error(`等级结果无效：${source.id}`);
    checkpoint.levels[source.id] = result;
  }
  await saveCheckpoint(); console.log(`难度评估 ${index + 1}/${levelBatches.length}`);
}

const sourceIssues = [];
for (const question of questions) {
  if (question.type === "grammar") {
    const refined = checkpoint.grammar[question.id];
    question.prompt = refined.prompt.trim(); question.options = refined.options.map((option) => option.trim()); question.answer = refined.answer;
    question.explanation = `中文解析：${refined.explanationZh.trim()}\n\nExplication française : ${refined.explanationFr.trim()}`;
    question.level = refined.level; question.difficulty = refined.difficulty; question.levelEstimated = false;
    question.refinement = { provider: config.provider, model: config.model, confidence: refined.confidence, sourceIssue: refined.sourceIssue?.trim() || "" };
    if (question.refinement.sourceIssue) sourceIssues.push({ id: question.id, note: question.refinement.sourceIssue });
  } else {
    const assessed = checkpoint.levels[question.id]; question.level = assessed.level; question.difficulty = assessed.difficulty; question.levelEstimated = false;
    question.levelAssessment = { provider: config.provider, model: config.model, reason: assessed.reason };
  }
}

// 源文档第97题混入前一题内容；恢复同组中完整的新闻阅读题。
const brokenReading = questions.find((question) => question.id === "auth-reading-095");
if (brokenReading) {
  brokenReading.passage = "À n'en pas douter, les pompiers de Loire-Atlantique se souviendront avec émotion de ce jeudi 4 février 2020. Un couple se dirigeait en voiture vers le CHU pour un accouchement imminent mais le travail était tellement avancé qu'il a dû s'arrêter sur le parking de l'Intermarché de Port-Saint-Père. Les pompiers ainsi qu'une équipe du service mobile d'urgence et de réanimation (SMUR) sont rapidement arrivés en soutien. Le bébé est né quelques minutes plus tard dans le véhicule du service départemental d'incendie et de secours. Lui et sa maman sont en bonne santé.";
  brokenReading.prompt = "Dans un journal, cet article devrait figurer dans la rubrique de :";
  brokenReading.options = ["santé", "maternité", "actualités", "faits divers"];
  brokenReading.answer = 3; brokenReading.level = "B1"; brokenReading.difficulty = 4;
  brokenReading.explanation = "中文解析：文章报道了一起发生在公共场所、由消防员参与处理的意外分娩事件，属于社会新闻中的“faits divers（社会杂闻）”，而不是提供医疗知识的健康栏目。\n\nExplication française : Le texte raconte un événement ponctuel et insolite survenu dans un lieu public, avec l'intervention des pompiers. Il relève donc de la rubrique « faits divers », et non d'une rubrique de conseils de santé.";
  brokenReading.calibration.ambiguity = "源文档第97题混入另一道银行题文字；已依据同组完整文章和四个选项恢复。"; brokenReading.calibration.confidence = "high"; brokenReading.calibration.arbitrated = true;
}

const brokenVocabulary8 = questions.find((question) => question.id === "auth-vocab-008");
if (brokenVocabulary8) {
  brokenVocabulary8.options = ["encouragée", "félicitée", "conseillée", "proposée"];
  brokenVocabulary8.answer = 0;
  brokenVocabulary8.explanation = "中文解析：encourager quelqu’un à faire quelque chose 表示“鼓励某人做某事”，与后面的 à le passer 完整搭配。féliciter 通常接 de/pour，conseiller 和 proposer 在这里通常接 de + 不定式。\n\nExplication française : La construction correcte est « encourager quelqu’un à faire quelque chose ». « Féliciter » se construit avec de ou pour, tandis que « conseiller » et « proposer » appellent normalement de devant l’infinitif dans cette phrase.";
}
const brokenVocabulary18 = questions.find((question) => question.id === "auth-vocab-018");
if (brokenVocabulary18) {
  brokenVocabulary18.prompt = "Il a _ l'allure de peur de glisser sur les rochers.";
  brokenVocabulary18.options = ["ralenti", "accéléré", "repris", "maintenu"];
  brokenVocabulary18.answer = 0;
  brokenVocabulary18.explanation = "中文解析：因为害怕在岩石上滑倒，他会“放慢速度”，固定表达为 ralentir l’allure。accélérer 是加速，reprendre 和 maintenir 都不符合因害怕滑倒而采取的动作。\n\nExplication française : La peur de glisser conduit logiquement à ralentir. L'expression usuelle est « ralentir l'allure » ; accélérer exprime le contraire, et reprendre ou maintenir ne correspond pas à la conséquence indiquée.";
}

const grammarCorrections = {
  "auth-grammar-002": { prompt: "Paul, il fait froid dehors, _ ton blouson.", options: ["mettez", "mets", "mettent", "met"], answer: 1, zh: "这是对 Paul 的直接命令，使用 mettre 的命令式第二人称单数 mets。mettez 对应 vous，mettent 对应 ils/elles，met 是第三人称单数。", fr: "On s'adresse directement à Paul avec tu : l'impératif de mettre à la deuxième personne du singulier est « mets ». « Mettez » correspond à vous, « mettent » à ils/elles et « met » à il/elle." },
  "auth-grammar-003": { prompt: "En général, vous _ à quelle heure ?", options: ["couchez", "couchez-vous", "vous couchez", "couches"], answer: 0, zh: "主语 vous 已经写在空格前，代动词 se coucher 只需补充 couchez，组成 vous couchez。若选 couchez-vous 或 vous couchez，就会重复主语或代词。", fr: "Le sujet « vous » est déjà placé avant le blanc. Il faut donc compléter par « couchez » pour former « vous couchez ». Les autres formes répètent le sujet ou ne s'accordent pas." },
  "auth-grammar-004": { prompt: "Elle _ souvent à la mer avec ses copains quand elle faisait ses études en France.", options: ["allait", "est allée", "va", "ira"], answer: 0, zh: "quand elle faisait ses études 描述过去持续的背景，souvent 表示过去的习惯，因此使用未完成过去时 allait。", fr: "La proposition « quand elle faisait ses études » situe une habitude passée, renforcée par « souvent ». On emploie donc l'imparfait « allait »." },
  "auth-grammar-053": { prompt: "Si vous _ à l'examen, vous serez admis.", options: ["réussissez", "réussissiez", "réussiriez", "réussirez"], answer: 0, zh: "表示将来可能实现的条件时，结构是 si + 直陈式现在时，主句用简单将来时，因此选 réussissez。si 后不能在这里直接使用将来时或条件式。", fr: "Pour une condition réalisable dans l'avenir, on emploie si + présent, puis le futur simple dans la principale : « Si vous réussissez, vous serez admis. »" },
  "auth-grammar-089": { prompt: "Il fait beau à Lyon, _ il est gris et pluvieux à Paris.", options: ["tandis qu'", "donc", "car", "puisqu'"], answer: 0, zh: "两个城市的天气形成同时对比，tandis que 用于表达这种对照。donc 表结果，car 和 puisque 表原因。", fr: "Les deux situations météorologiques sont mises en contraste. « Tandis que » exprime cette opposition, contrairement à donc, car et puisque." },
  "auth-grammar-095": { prompt: "_ certains s'en réjouissent, d'autres n'appuient pas cette décision.", options: ["Si", "Parce que", "Afin que", "Dès que"], answer: 0, zh: "si 可在这里构成对照结构“如果说有些人对此高兴，另一些人却不支持”。其余选项分别表达原因、目的或时间，不符合句间逻辑。", fr: "« Si » introduit ici une concession opposant deux groupes : si certains s'en réjouissent, d'autres refusent la décision. Les autres connecteurs expriment la cause, le but ou le temps." },
  "auth-grammar-132": { prompt: "Mes amis ont besoin de mon avis, je _ leur donne directement.", options: ["le", "la", "leur", "les"], answer: 0, zh: "mon avis 是阳性单数直接宾语，用 le 代替；leur 已经表示“给朋友们”。完整结构是 je le leur donne。", fr: "« Mon avis » est un COD masculin singulier, repris par « le ». Le pronom « leur » représente déjà les amis : « je le leur donne »." },
  "auth-grammar-133": { prompt: "Nos collègues attendent notre avis. Nous allons _ donner.", options: ["le lui", "le leur", "les lui", "les leur"], answer: 1, zh: "avis 是阳性单数直接宾语，用 le 代替；à nos collègues 是复数间接宾语，用 leur 代替。两个代词顺序为 le leur。", fr: "« L'avis » est repris par le pronom COD masculin singulier « le », et « à nos collègues » par le COI pluriel « leur ». L'ordre correct est donc « le leur donner »." },
  "auth-grammar-170": { prompt: "J'hésite entre les deux chemises noires, _ est-ce que tu préfères ?", options: ["laquelle", "lequel", "lesquelles", "quelle"], answer: 0, zh: "题目是在两件阴性单数事物中询问“你更喜欢哪一件”，使用代词 laquelle。lequel 为阳性，lesquelles 为复数，quelle 后面通常还要接名词。", fr: "On choisit une chemise parmi deux : le pronom interrogatif féminin singulier est « laquelle ». « Lequel » est masculin, « lesquelles » pluriel et « quelle » accompagne normalement un nom." },
  "auth-grammar-176": { prompt: "Je suis dentiste et j'aime beaucoup _ métier.", options: ["ce", "cet", "cette", "ces"], answer: 0, zh: "métier 是以辅音开头的阳性单数名词，指示限定词使用 ce。cet 用在元音或哑音 h 开头的阳性单数名词前，cette 为阴性，ces 为复数。", fr: "« Métier » est masculin singulier et commence par une consonne : on emploie « ce métier ». « Cet » précède une voyelle ou un h muet, « cette » est féminin et « ces » pluriel." },
  "auth-grammar-188": { prompt: "Je n'irai _ part.", options: ["nulle", "aucune", "quelque", "chaque"], answer: 0, zh: "固定否定表达 nulle part 表示“哪里也不”，与 ne 连用构成 Je n'irai nulle part。其他限定词不能组成该固定表达。", fr: "La locution négative correcte est « ne… nulle part » : « Je n'irai nulle part. » Les autres déterminants ne forment pas cette expression." },
  "auth-grammar-195": { prompt: "Pour rejoindre le deuxième étage, il faut _ par l'escalier car l'ascenseur est en panne.", options: ["monter", "traverser", "entrer", "sortir"], answer: 0, zh: "到达二楼需要“上楼”，使用 monter par l'escalier。traverser 表示穿过，entrer 和 sortir 表示进入或出去，都不能表达向上到达楼层。", fr: "Pour atteindre le deuxième étage, il faut « monter par l'escalier ». Traverser, entrer et sortir n'expriment pas le déplacement vers un étage supérieur." },
  "auth-grammar-200": { prompt: "Elle a perdu la voix _ crier pendant toute la soirée.", options: ["en dépit de", "à force de", "au lieu de", "à cause de"], answer: 1, zh: "à force de + 不定式表示反复或持续做某事导致的结果：她整晚一直喊，因此失声。其他结构不能准确表达这种累积原因。", fr: "« À force de » suivi de l'infinitif exprime une action répétée ou prolongée qui entraîne un résultat : elle a perdu la voix à force de crier." },
  "auth-grammar-221": { prompt: "J'ai attendu Marie pendant deux heures, mais elle ne m'a pas prévenu qu'elle ne viendrait pas. Elle m'a _.", options: ["posé un lapin", "donné un coup", "fait signe", "rendu visite"], answer: 0, zh: "poser un lapin à quelqu’un 表示约好后不出现、让对方空等。这里间接宾语 à moi 已由 m' 表示，所以正确形式是 Elle m'a posé un lapin。", fr: "« Poser un lapin à quelqu'un » signifie ne pas venir à un rendez-vous sans prévenir. Le pronom « m' » reprend « à moi » : « Elle m'a posé un lapin. »" }
  ,"auth-grammar-224": { prompt: "Plusieurs universités proposent des cours à distance aux étudiants éloignés. Cela leur permet _ de connaissances.", options: ["d'étancher leur soif", "de remplir leur soif", "d'achever leur soif", "de terminer leur soif"], answer: 0, zh: "固定搭配 étancher sa soif de connaissances 表示“满足求知欲”。其余动词不能与 soif de connaissances 形成自然搭配。", fr: "L'expression idiomatique est « étancher sa soif de connaissances ». Remplir, achever et terminer ne se construisent pas naturellement avec « soif » dans ce sens." }
};
for (const [id, correction] of Object.entries(grammarCorrections)) {
  const question = questions.find((item) => item.id === id); if (!question) continue;
  question.prompt = correction.prompt; question.options = correction.options; question.answer = correction.answer;
  question.explanation = `中文解析：${correction.zh}\n\nExplication française : ${correction.fr}`;
  question.refinement.sourceIssue = `${question.refinement.sourceIssue || "源题存在格式或唯一答案问题。"} 已人工规则修正。`;
}

const brokenReading73 = questions.find((question) => question.id === "auth-reading-073");
if (brokenReading73) {
  brokenReading73.prompt = "Quelle évolution correspond au commentaire suivant ? « Malgré la stagnation observée ces dernières années, on peut être optimiste et s'attendre à une recrudescence du nombre de visiteurs. »";
  brokenReading73.options = ["Une stabilité récente suivie d'une hausse attendue", "Une baisse continue qui devrait se poursuivre", "Une hausse récente suivie d'une chute annoncée", "Des variations régulières sans tendance prévisible"];
  brokenReading73.answer = 0;
  brokenReading73.explanation = "中文解析：stagnation observée ces dernières années 表示最近保持稳定，s'attendre à une recrudescence 表示预计之后会重新增长。因此应选择“近期稳定、随后预计上升”。\n\nExplication française : « La stagnation observée ces dernières années » décrit une stabilité récente, tandis que « s'attendre à une recrudescence » annonce une hausse future. La première évolution reformule exactement ces deux étapes.";
  brokenReading73.calibration.ambiguity = "源文档缺少图表且选项重复；已改为考查同一趋势理解的自足文字选项。"; brokenReading73.calibration.confidence = "high";
}

// 非语法题中，多出的第五项属于源资料附加选项；保留正确答案所在的四项并删除最弱干扰项。
for (const question of questions.filter((item) => item.type !== "grammar" && item.options.length === 5)) {
  let removeIndex = question.options.findIndex((option) => /je ne sais pas/i.test(option));
  if (removeIndex < 0) removeIndex = question.options.length - 1;
  if (removeIndex === question.answer) removeIndex = question.options.findIndex((_, index) => index !== question.answer);
  question.options.splice(removeIndex, 1); if (removeIndex < question.answer) question.answer--;
}

const invalid = questions.filter((question) => question.options.length !== 4 || !Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3 || !question.explanation.includes("中文解析：") || !question.explanation.includes("Explication française"));
if (invalid.length) throw new Error(`仍需人工修复：${invalid.map((question) => question.id).join(",")}`);
await writeFile(bankUrl, `${JSON.stringify(questions, null, 2)}\n`);
const report = { refinedAt: new Date().toISOString(), provider: config.provider, model: config.model, total: questions.length, grammarRefined: grammar.length, levelsReassessed: questions.length, allFourOptions: true, allBilingual: true, sourceIssues };
await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
