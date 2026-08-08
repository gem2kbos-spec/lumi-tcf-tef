const clean = (value) => String(value || "").trim();
const normalized = (value) => clean(value).toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const skillNames = {
  subjonctif: "虚拟式的触发与变位", conditionnel: "条件式与假设关系", passe_compose: "复合过去时", imparfait: "未完成过去时",
  plus_que_parfait: "愈过去时", pronouns: "代词选择与指代", pronom_y: "代词 y：à + 地点或事物", pronom_en: "代词 en：de + 名词或数量",
  pronoms_y_en: "y / en 的介词判断", prepositions: "介词与时空关系", determiners: "冠词、限定词与数量", articles: "冠词选择",
  adjectives_adverbs: "形容词、副词与比较", verb_patterns: "动词后的介词或不定式", idioms: "惯用表达的整体意义", synonymes: "近义词的语境辨析"
};

function optionText(attempt) {
  const question = attempt.question || {};
  return clean(question.options?.[question.answer]);
}

function lexicalDiagnostic(attempt, text, answer) {
  const inPassage = Boolean(attempt.question?.passage);
  const phrase = answer || clean(attempt.question?.topic) || "语境中的正确词语";
  return {
    id: `lexical:${normalized(phrase) || attempt.skill || "context"}`,
    examAbility: `TCF · 词汇/语域与情境适切｜TEF · ${inPassage ? "篇章词汇" : "句子词汇"}`,
    title: `词义与惯用搭配：${phrase}`,
    errorType: "没有同时核对词义、搭配对象和句子语域",
    action: `把“${phrase}”放回完整语境，并与本题干扰项逐一对比`
  };
}

function grammarDiagnostic(attempt, text, answer) {
  const skill = attempt.skill || "grammar";
  if (/\bdepuis\b/.test(text)) return {
    id: "time:depuis-present-continuity", examAbility: "TCF · 根据语境选择正确表述｜TEF · 句子句法",
    title: "时间关系：depuis + 现在时表示持续到现在", errorType: "把仍在持续的动作误判成已经结束的过去事件",
    action: "对比 depuis / il y a / pendant / pour / en，并先判断动作是否持续到现在"
  };
  if (/\b(aller|vais|vas|va|allons|allez|vont)\b/.test(text) && /\b(infinitif|demain|bientot|ce soir|la semaine prochaine)\b/.test(text)) return {
    id: "tense:futur-proche", examAbility: "TCF · 正确语法表述｜TEF · 句子句法",
    title: "近期将来：aller（现在时）+ infinitif", errorType: "没有用时间标记判断近期计划，或把 aller 本身当作主要动作",
    action: "先圈出 demain / bientôt 等标记，再检查 aller 的人称变位和不定式原形"
  };
  if (skill === "collocation" || skill === "verb_patterns") return {
    ...lexicalDiagnostic(attempt, text, answer), id: `verb-pattern:${normalized(answer) || normalized(attempt.question?.topic) || "context"}`,
    examAbility: "TCF · 词汇/语域错误与正确表述｜TEF · 句子词汇",
    title: `动词搭配与固定结构：${answer || clean(attempt.question?.topic) || "按语境选结构"}`,
    errorType: "记住了单词中文意思，但没有连同介词、补语或固定结构一起判断",
    action: "以“动词 + 介词/补语”的完整词块重记，并造一个同结构新句"
  };
  if (skill === "connectors" || skill === "connecteurs") return {
    id: `connector:${normalized(answer) || "logic"}`, examAbility: `TCF · 等义表达与正确表述｜TEF · ${attempt.question?.passage ? "篇章衔接" : "句子句法"}`,
    title: `逻辑关系：${answer || "根据上下文选择连接形式"}`, errorType: "只看连接词中文意思，没有先判断前后分句的逻辑关系",
    action: "先标出原因、结果、让步、对立或目的，再检查连接词后的句法形式"
  };
  const title = skillNames[skill] || clean(attempt.analysis?.knowledge?.title) || clean(attempt.question?.topic) || skill.replaceAll("_", " ");
  return {
    id: `grammar:${skill}:${normalized(title)}`, examAbility: "TCF · 正确语法表述｜TEF · 句子句法",
    title, errorType: clean(attempt.analysis?.errorReasonZh) || "没有把句中形式与触发条件、时态线索或句法位置对应起来",
    action: `复习“${title}”的判断步骤，再做同考点由易到难练习`
  };
}

function comprehensionDiagnostic(attempt) {
  const type = attempt.type === "listening" ? "听力" : "阅读";
  const skill = attempt.skill || "comprehension";
  const map = {
    information_explicite: ["明确事实与条件定位", "回到原文定位人、时间、地点、条件和否定词，不凭印象作答"],
    information_detaillee: ["细节信息定位与同义改写", "把选项关键词与原文同义表达逐项对应"],
    idee_principale: ["文本主旨与核心信息", "区分全文核心与只在局部出现的细节"],
    but_du_message: ["交际目的：作者为什么写这段话", "先判断文本类型和对象，再概括作者希望读者做什么"],
    intention_auteur: ["作者意图与立场", "依据评价词、语气和结论判断态度，不加入常识"],
    inference: ["有证据的推断", "找出支持推断的原文依据，排除合理但文中无证据的选项"],
    cause_consequence: ["因果链与逻辑关系", "分别圈出原因、结果及转折标记，再核对方向"]
  };
  const [title, action] = map[skill] || [`${type}中的${clean(attempt.question?.topic) || "信息理解"}`, "先定位原文或音频证据，再判断选项是否完整且没有扩大含义"];
  return {
    id: `${attempt.type}:${skill}:${normalized(attempt.question?.topic) || "general"}`,
    examAbility: `TCF / TEF · ${type}理解`, title,
    errorType: clean(attempt.analysis?.errorReasonZh) || "答案缺少文本或音频中的直接证据，或被局部关键词干扰",
    action
  };
}

export function examDiagnostic(attempt) {
  const answer = optionText(attempt);
  const question = attempt.question || {};
  const text = normalized([question.prompt, question.passage, question.audioText, question.topic, answer, ...(question.options || [])].join(" "));
  const base = attempt.type === "reading" || attempt.type === "listening"
    ? comprehensionDiagnostic(attempt)
    : attempt.type === "vocabulary" ? lexicalDiagnostic(attempt, text, answer) : grammarDiagnostic(attempt, text, answer);
  return { ...base, category: question.category || null };
}
