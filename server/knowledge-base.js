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

export function buildAttemptAnalysis(question, selected) {
  const correctOption = question.options[question.answer];
  const selectedOption = question.options[selected];
  const [label, note] = KNOWLEDGE[question.skill] || [question.topic || "本题考点", "回到题干或原文，确认决定正确答案的唯一证据，并比较其余选项为什么不成立。"];
  const correct = selected === question.answer;
  let errorReasonZh = "本题作答正确。建议仍然确认决定答案的关键线索，避免只是猜对。";
  if (!correct && question.type === "reading") errorReasonZh = `你选择了“${selectedOption}”，但这个选项没有被原文完整支持。你的错误更接近“${label}”环节：可能抓到了局部相似词，却没有核对题干要求和决定性限定条件。`;
  else if (!correct && question.type === "listening") errorReasonZh = `你选择了“${selectedOption}”。这个干扰项可能复用了录音中的词，但没有准确表达说话人的完整意思。需要加强“${label}”。`;
  else if (!correct) errorReasonZh = `你选择了“${selectedOption}”，说明“${label}”还不稳定。不要只看单词是否眼熟，应先判断句法位置、固定搭配或逻辑关系，再排除干扰项。`;
  return {
    explanationFr: question.explanation,
    explanationZh: `正确答案是“${correctOption}”。本题考查【${label}】。${note}`,
    errorReasonZh,
    knowledge: { label, note },
    selectedOption,
    correctOption
  };
}
