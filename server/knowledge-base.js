const KNOWLEDGE = {
  subjonctif: ["虚拟式", "表示必要、愿望、情感或不确定性的结构后常用虚拟式。先识别触发结构，再检查主语对应的变位。"],
  plus_que_parfait: ["愈过去时", "表示在另一个过去动作之前已经完成的动作：avoir/être 的未完成过去时 + 过去分词。"],
  passe_compose: ["复合过去时", "用于已经完成、边界明确的过去动作；注意助动词和过去分词配合。"],
  pronom_y: ["代词 y", "y 通常替代 à + 地点或 à + 事物，不能替代有生命的人。"],
  pronom_en: ["代词 en", "en 通常替代 de + 名词或不定数量；数量词一般需要保留。"],
  pronom_dont: ["关系代词 dont", "先看后面的动词或结构是否要求 de；dont 替代 de + 先行词。"],
  hypothese: ["假设句", "si + 未完成过去时搭配条件式现在时，表达现在或将来不真实、可能性较低的假设。"],
  connecteurs: ["逻辑连接词", "先判断句间逻辑是原因、结果、转折还是让步，再检查连接词后接名词还是完整从句。"],
  discours_indirect: ["间接引语", "注意引述动词的时态以及时间、地点指示词的变化；现在时引述通常不发生时态后移。"],
  collocation: ["固定搭配", "法语词汇题经常考动词与名词的惯用组合，不能只根据中文逐词翻译。"],
  synonymes: ["近义词辨析", "比较词语在当前语境中的逻辑功能、语域和搭配限制，而不只是中文释义。"],
  antonymes: ["反义关系", "先确定原词在句中的具体含义，再选择语义方向真正相反且词性一致的选项。"],
  sens_en_contexte: ["语境词义", "用前后文、搭配和句子功能推断词义，不要只依赖最常见的中文翻译。"],
  information_explicite: ["明确信息定位", "答案可以在原文直接找到。核对时间、人物、条件和否定词，避免被复用原文词汇的干扰项吸引。"],
  information_detaillee: ["细节理解", "把题干关键词与原文对应句对齐，同时检查限定词，不能把局部信息扩大成全文结论。"],
  idee_principale: ["主旨理解", "选择能覆盖全文目的的选项；只描述一个例子或细节的选项通常不是主旨。"],
  but_du_message: ["交际目的", "判断作者为什么写这段话，而不只是文中发生了什么。注意请求、通知、解释、邀请等功能。"],
  cause_consequence: ["因果关系", "区分事情发生的原因与产生的结果，重点关注 parce que、donc、grâce à、c'est pourquoi 等信号。"],
  inference: ["推断", "推断必须由文中至少两个线索共同支持，不能加入常识上可能但原文没有依据的信息。"],
  intention_auteur: ["作者意图", "结合建议、评价和结论性表达判断作者想让读者相信或采取什么行动。"],
  consigne: ["指令理解", "找出必须执行的动作、截止时间和条件；建议与强制要求要分开。"],
  information_orale: ["听力信息定位", "优先抓人物、时间、地点、数字和动作变化；听到相同词不等于选项正确。"],
  intention_orale: ["听力交际意图", "判断说话人打电话或发言的目的，而不是只复述谈话主题。"],
  idee_principale_orale: ["听力主旨", "关注开头提出的问题和结尾的决定，选择覆盖整段意思的选项。"],
  point_de_vue_oral: ["听力观点", "区分说话人自己的立场与其转述的他人观点，注意 pourtant、mais 等转折。"],
  information_detaillee_orale: ["听力细节", "答案常由限定条件决定。数字、时间或否定信息只播放一次，需要避免凭印象作答。"],
  cause_orale: ["听力因果", "找出真正促成变化的原因，不要把背景信息或结果当作原因。"],
  consigne_orale: ["口头指令", "确定对方要求完成的具体动作、方式和时限。"]
};

const OPTION_USAGE = {
  dans: "dans 是介词，核心是进入或位于有边界的内部，也可表示‘从现在起多久以后’：dans la salle、dans deux jours。它后接名词性成分，不能仅因中文可译成‘在’就替代 à、en 或 sur。",
  en: "en 常用于阴性国家/地区、交通方式、材料、状态或完成动作所需时间：en France、en voiture、en bois、en deux heures。它是否成立取决于后面名词的类别和固定搭配。",
  sur: "sur 表示在表面上、关于某主题或比例关系：sur la table、un livre sur Paris、trois sur dix。若题目不表达表面接触、主题或比例，就不能使用 sur。",
  à: "à 可表示地点、方向、时间，也由许多动词固定支配：à Paris、à huit heures、penser à。具体是否使用要看地点类型或前面动词的固定介词。",
  de: "de 可表示来源、所属、内容或由动词/形容词固定支配：venir de Paris、le livre de Paul、parler de。接完整从句时通常还需要 que，不能把 de 单独当连接词。",
  pour: "pour 表示目的、受益对象、用途、预定时段等，通常接名词或不定式：pour Marie、pour apprendre、pour deux semaines；接完整从句应使用 pour que。",
  chez: "chez 后接人、职业群体或机构名称，表示‘在某人家/某类人那里’：chez Paul、chez le médecin。它一般不直接用于普通地点名词。"
};

function localOptionReason(option, correct, selected) {
  const usage = OPTION_USAGE[String(option).toLocaleLowerCase("fr")] || `“${option}”有自己的固定搭配、支配形式和语义范围，必须根据完整句法而不是中文直译选择。`;
  if (correct) return `✓ ${option}：${usage} 本题中它与前后成分构成正确结构，且句意完整。`;
  return `✗ ${option}${selected ? "（你的选择）" : ""}：${usage} 本题所需关系与上述适用条件不一致，所以即使中文表面上似乎通顺，也不能填入。`;
}

export function buildAttemptAnalysis(question, selected) {
  const correctOption = question.options[question.answer];
  const selectedOption = question.options[selected];
  const [label, note] = KNOWLEDGE[question.skill] || [question.topic || "本题考点", "回到题干或原文，确认决定正确答案的唯一证据，并比较其余选项为什么不成立。"];
  const correct = selected === question.answer;
  const bilingual = question.explanation?.match(/^中文解析：([\s\S]*?)\n\nExplication française\s*:\s*([\s\S]+)$/);
  const sourceZh = bilingual ? bilingual[1].trim() : "";
  let errorReasonZh = "本题作答正确。建议仍然确认决定答案的关键线索，避免只是猜对。";
  if (!correct && question.type === "reading") errorReasonZh = `你选择了“${selectedOption}”，但这个选项没有被原文完整支持。你的错误更接近“${label}”环节：可能抓到了局部相似词，却没有核对题干要求和决定性限定条件。`;
  else if (!correct && question.type === "listening") errorReasonZh = `你选择了“${selectedOption}”。这个干扰项可能复用了录音中的词，但没有准确表达说话人的完整意思。需要加强“${label}”。`;
  else if (!correct) errorReasonZh = `你选择了“${selectedOption}”，说明“${label}”还不稳定。不要只看单词是否眼熟，应先判断句法位置、固定搭配或逻辑关系，再排除干扰项。`;
  const optionAnalysis = question.options.map((option, index) => {
    if (/il se peut\s+_+/i.test(question.prompt)) {
      if (/^que$/i.test(option)) return `✓ ${option}：正确。“il se peut que + 从句”是固定的无人称结构，表示“可能……”。que 引出从句；从句表达尚未确认的可能性，因此使用虚拟式。本题后面已有虚拟式 pleuve，前面必须填 que。`;
      if (/^pour$/i.test(option)) return `✗ ${option}：pour 后面通常直接接名词或不定式，如 pour demain、pour partir；如果要接完整从句，必须使用 pour que，不能只用 pour。`;
      if (/^si$/i.test(option)) return `✗ ${option}：si 用于条件句或间接疑问，如 si j'ai le temps、je ne sais pas s'il vient；它不能组成“il se peut si”这一结构。`;
      if (/^de$/i.test(option)) return `✗ ${option}：de 可以出现在“il est possible de + 不定式”中，但不能在这里直接连接“il pleuve”这个有主语、有变位动词的完整从句。`;
    }
    return localOptionReason(option, index === question.answer, index === selected);
  });
  const detailedZh = [
    `【题干理解】${question.prompt}`,
    `【核心考点】${label}。${note}`,
    "【判断步骤】① 看空格在句中的作用；② 找固定结构、动词形式或逻辑标记；③ 把选项代回完整句子；④ 检查语法和含义是否同时成立。",
    `【正确答案】${correctOption}${correct ? "。你本题选择正确，但仍建议按步骤确认，不要只凭语感。" : `。你选择的是“${selectedOption}”，关键区别见下面逐项分析。`}`,
    `【选项逐项分析】\n${optionAnalysis.join("\n")}`,
    `【易错提醒】${/il se peut\s+_+/i.test(question.prompt) ? "看到虚拟式 pleuve 后，要向前寻找触发它的完整结构 il se peut que；不要把中文似乎能译通的介词或连词直接代入。" : "不要只比较选项的中文意思。结构题必须同时核对前后接续形式、固定搭配、时态语式和语境含义。"}`
  ].join("\n\n");
  return {
    explanationFr: bilingual ? bilingual[2].trim() : question.explanation,
    explanationZh: bilingual ? bilingual[1].trim() : `正确答案是“${correctOption}”。本题考查【${label}】。${note}`,
    detailedZh,
    errorReasonZh,
    knowledge: { label, note, title: `${label}：${String(correctOption).slice(0, 70)}` },
    selectedOption,
    correctOption
  };
}

export function formatAiAnalysis(question, selected, payload, base = buildAttemptAnalysis(question, selected)) {
  if (!payload || !Array.isArray(payload.options) || payload.options.length !== question.options.length) return base;
  const forbidden = /不能填入本题位置|需要检查|不符合语境|不合适|不正确[。；]?$/;
  const valid = payload.options.every((item, index) => item && item.option === question.options[index] && item.usage?.trim().length >= 8 && item.reasonInQuestion?.trim().length >= 10 && item.example?.trim().length >= 5 && !forbidden.test(item.reasonInQuestion.trim()));
  if (!valid || !payload.summary?.trim() || !payload.rule?.trim() || !payload.correctReason?.trim() || !payload.trap?.trim()) return base;
  const suppliedSteps = Array.isArray(payload.steps) ? payload.steps.filter((step) => typeof step === "string" && step.trim().length >= 4) : [];
  const steps = suppliedSteps.length >= 2 ? suppliedSteps : question.type === "reading"
    ? ["先确认题干问的是主旨、细节、目的还是推断。", "回到原文定位决定答案的完整句，并核对否定、时间和范围限制。", "逐项比较：只有被原文完整支持的选项才能保留。"]
    : ["先判断空格需要的词性、句法功能或固定结构。", "检查前后成分对介词、时态、语式和配合的要求。", "把每个选项代回原句，同时核对语法成立和句意自然。"];
  const correctOption = question.options[question.answer]; const selectedOption = question.options[selected];
  const detailedZh = [
    `【题干理解】${payload.summary}`,
    `【核心规则】${payload.rule}`,
    `【判断步骤】${steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`,
    `【正确答案】${correctOption}。${payload.correctReason}${selected === question.answer ? "\n你本题选择正确。" : `\n你选择了“${selectedOption}”，具体差异见逐项分析。`}`,
    `【选项逐项分析】\n${payload.options.map((item, index) => `${index === question.answer ? "✓" : "✗"} ${item.option}\n常见用法：${item.usage}\n本题判断：${item.reasonInQuestion}\n正确例句：${item.example}`).join("\n\n")}`,
    `【易错提醒】${payload.trap}`
  ].join("\n\n");
  return { ...base, detailedZh };
}
