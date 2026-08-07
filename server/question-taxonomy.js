export const QUESTION_CATEGORIES = [
  { id: "verb-patterns", type: "grammar", label: "动词搭配与固定结构", description: "动词后接介词、不定式、虚拟式及固定表达", skills: ["collocation", "subjonctif", "discours_indirect"] },
  { id: "determiners", type: "grammar", label: "冠词与限定词（含数量、tout）", description: "冠词、部分冠词、数量表达、tout及其他限定词", skills: ["articles", "determinants", "quantite", "tout"] },
  { id: "verb-tenses", type: "grammar", label: "动词时态与语式", description: "现在、过去、将来、条件式及虚拟式的时态判断", skills: ["passe_compose", "plus_que_parfait", "imparfait", "futur", "conditionnel", "hypothese"] },
  { id: "pronouns", type: "grammar", label: "代词与指代", description: "人称代词、y、en、COD/COI及代词位置", skills: ["pronom_y", "pronom_en", "pronoms_y_en", "cod", "coi"] },
  { id: "relative-pronouns", type: "grammar", label: "关系代词", description: "qui、que、dont、où及复合关系代词", skills: ["pronom_dont", "pronoms_relatifs"] },
  { id: "connectors", type: "grammar", label: "逻辑连接词与从句", description: "原因、结果、目的、让步、对立及句间逻辑", skills: ["connecteurs", "cause", "consequence", "but", "concession"] },
  { id: "prepositions", type: "grammar", label: "介词与空间时间关系", description: "地点、时间、动词后介词及介词短语", skills: ["prepositions"] },
  { id: "sentence-structure", type: "grammar", label: "句子结构、否定与比较", description: "语序、否定、比较、疑问及一致关系", skills: ["negation", "comparaison", "accord", "ordre_des_mots"] },
  { id: "meaning-context", type: "vocabulary", label: "语境词义", description: "根据上下文判断词语和表达含义", skills: ["sens_en_contexte"] },
  { id: "lexical-relations", type: "vocabulary", label: "同义词、反义词与词族", description: "近义替换、反义关系和构词", skills: ["synonymes", "antonymes", "famille_de_mots"] },
  { id: "collocations", type: "vocabulary", label: "词语搭配与固定表达", description: "高频动宾搭配和习惯表达", skills: ["collocation"] },
  { id: "reading-explicit", type: "reading", label: "信息定位与指令", description: "定位明确事实、时间、条件和操作要求", skills: ["information_explicite", "consigne", "information_detaillee"] },
  { id: "reading-purpose", type: "reading", label: "主旨、目的与作者意图", description: "识别文本核心、交际目的和作者立场", skills: ["idee_principale", "but_du_message", "intention_auteur"] },
  { id: "reading-inference", type: "reading", label: "推断与逻辑关系", description: "推断隐含信息、原因、结果和态度", skills: ["inference", "cause_consequence"] },
  { id: "listening-explicit", type: "listening", label: "听力信息定位", description: "抓取时间、地点、人物、指令和具体信息", skills: ["information_orale", "information_detaillee_orale", "consigne_orale"] },
  { id: "listening-purpose", type: "listening", label: "听力主旨、意图与观点", description: "判断说话目的、中心意思和态度", skills: ["intention_orale", "idee_principale_orale", "point_de_vue_oral", "cause_orale"] }
];

export function categoryFor(question) {
  if (question.category && QUESTION_CATEGORIES.some((item) => item.id === question.category && item.type === question.type)) return question.category;
  return QUESTION_CATEGORIES.find((item) => item.type === question.type && item.skills.includes(question.skill))?.id || `${question.type}-other`;
}

export function categoriesFor(type) {
  return QUESTION_CATEGORIES.filter((item) => item.type === type);
}
