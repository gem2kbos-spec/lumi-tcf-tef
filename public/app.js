const state = { exam: "tcf", type: "grammar", questions: [], index: 0, score: 0, mode: "bank", answered: false, mistakes: [], audioPlayed: false, productionType: null, continuousNumber: 1, recentIds: [] };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
let selectedVocabulary = null;
let knowledgeTopics = [];
let currentKnowledgeId = "y-en-prepositions";
let knowledgeChat = [];

const catalogs = {
  tcf: {
    title: "TCF 预签证 / DAP", note: "必考：三项 QCM + 书面表达",
    modules: [
      ["listening", "听力理解", "29题 · 25分钟", "一次播放，难度递进", "CO"],
      ["grammar", "语言结构", "18题 · 15分钟", "语法、词汇与语域", "MSL"],
      ["reading", "阅读理解", "29题 · 45分钟", "日常文本到观点文章", "CE"],
      ["writing", "书面表达", "3项 · 60分钟", "信息、叙述与观点比较", "EE"]
    ]
  },
  tef: {
    title: "TEF 全题型训练", note: "报考版本决定实际必考组合",
    modules: [
      ["reading", "阅读理解", "40题 · 60分钟", "四选一，可自由导航", "CE"],
      ["listening", "听力理解", "40题 · 40分钟", "一次播放，不可返回", "CO"],
      ["mixed", "词汇与结构", "40题 · 30分钟", "TEF Études 等版本使用", "LS"],
      ["writing", "书面表达", "2项 · 60分钟", "续写事件与论证观点", "EE"],
      ["speaking", "口语表达", "2项 · 15分钟", "询问信息与说服", "EO"]
    ]
  }
};

const productionTasks = {
  tcf: {
    writing: [
      ["Tâche 1 · message", "Vous avez emprunté un objet à un ami et vous l'avez abîmé. Écrivez-lui pour expliquer la situation et proposer une solution.", "60–120 mots · 描述、解释并提出解决办法。"],
      ["Tâche 2 · récit", "Vous avez participé à une activité organisée dans votre quartier. Racontez cette expérience sur un site communautaire et donnez votre opinion.", "120–150 mots · 叙述经历并作出评价。"],
      ["Tâche 3 · points de vue", "Le télétravail améliore-t-il vraiment la qualité de vie ? Comparez les avantages et les limites, puis donnez votre opinion.", "120–180 mots · 比较两种观点并论证自己的立场。"]
    ],
    speaking: [
      ["Tâche 1 · entretien", "Présentez-vous et parlez de vos études, de votre travail, de vos loisirs et de vos projets.", "约 2 分钟 · 连贯回答考官的个人问题。"],
      ["Tâche 2 · interaction", "Vous téléphonez à une association pour obtenir des renseignements sur un cours de cuisine. Posez des questions sur les horaires, le prix, le matériel et l'inscription.", "2 分钟准备 + 3分30秒互动 · 主动获取信息。"],
      ["Tâche 3 · opinion", "Pensez-vous qu'il faut limiter l'usage du téléphone portable à l'école ?", "约 4分30秒 · 清楚表达观点、理由、例子与结论。"]
    ]
  },
  tef: {
    writing: [
      ["Section A · fait divers", "Un train est resté bloqué plusieurs heures en pleine campagne. Continuez cet article en racontant ce qui s'est passé.", "25 分钟 · 至少 80 词 · 续写一则事件报道。"],
      ["Section B · opinion", "Écrivez au journal pour réagir à l'affirmation : « Les centres-villes devraient être interdits aux voitures. »", "35 分钟 · 至少 200 词 · 表明并论证立场。"]
    ],
    speaking: [
      ["Section A · renseignements", "Vous avez vu une annonce pour louer un appartement. Téléphonez pour obtenir le plus de renseignements possible.", "5 分钟 · 针对广告主动询问信息。"],
      ["Section B · convaincre", "Votre ami hésite à participer à un séjour de bénévolat. Présentez-lui le projet et convainquez-le de s'inscrire.", "10 分钟 · 介绍方案、回应反对意见并说服对方。"]
    ]
  }
};

function renderCatalog() {
  const catalog = catalogs[state.exam];
  $("#exam-title").textContent = catalog.title;
  $("#exam-note").textContent = catalog.note;
  $("#module-grid").replaceChildren(...catalog.modules.map(([type, title, format, description, code]) => {
    const button = document.createElement("button");
    button.className = `module-card${state.type === type ? " active" : ""}`;
    button.dataset.module = type;
    button.innerHTML = `<span>${code}</span><strong>${title}</strong><small>${format}</small><p>${description}</p>`;
    button.addEventListener("click", () => selectModule(type));
    return button;
  }));
}

function selectModule(type) {
  state.type = type;
  state.productionType = ["writing", "speaking"].includes(type) ? type : null;
  document.querySelectorAll("[data-type]").forEach((item) => item.classList.toggle("active", item.dataset.type === type));
  renderCatalog();
  if (state.productionType) showProduction();
  else {
    $("#production").hidden = true; $("#quiz").hidden = true; $("#finished").hidden = true; $("#welcome").hidden = false;
    $("#welcome h2").textContent = catalogs[state.exam].modules.find((item) => item[0] === type)[1];
    $("#welcome p").textContent = "设置等级和题数，然后开始专项训练。";
  }
  $("#practice").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.querySelectorAll("[data-exam]").forEach((button) => button.addEventListener("click", () => {
  state.exam = button.dataset.exam;
  document.querySelectorAll("[data-exam]").forEach((item) => item.classList.toggle("active", item === button));
  selectModule(state.exam === "tcf" ? "grammar" : "mixed");
}));
document.querySelectorAll("[data-type]").forEach((button) => button.addEventListener("click", () => selectModule(button.dataset.type)));

async function api(path, options) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json" } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "请求失败");
  return payload;
}

async function refreshStats() {
  const stats = await api("/api/stats");
  $("#accuracy").textContent = `${stats.accuracy}%`; $("#total").textContent = stats.total; $("#streak").textContent = stats.streak;
  $("#authentic-progress").textContent = `${stats.imported.completed}/${stats.imported.total}`;
  $("#review-count").textContent = stats.pendingReview;
  const weak = stats.weakSkills.slice(0, 3); $("#weak-card").hidden = weak.length === 0;
  $("#weak-skills").replaceChildren(...weak.map((item) => { const row = document.createElement("div"); row.innerHTML = `<span>${item.skill.replaceAll("_", " ")}</span><b>${item.count}</b>`; return row; }));
}

function showKnowledgePreview(topic) {
  if (!topic) return;
  currentKnowledgeId = topic.id; $("#knowledge-title").textContent = topic.title; $("#knowledge-body").textContent = topic.summary;
}

async function loadKnowledgeTopics() {
  const payload = await api("/api/knowledge"); knowledgeTopics = payload.topics;
  showKnowledgePreview(knowledgeTopics.find((topic) => topic.id === currentKnowledgeId) || knowledgeTopics[0]);
}

function refreshKnowledge() {
  if (knowledgeTopics.length < 2) return;
  const choices = knowledgeTopics.filter((topic) => topic.id !== currentKnowledgeId);
  showKnowledgePreview(choices[Math.floor(Math.random() * choices.length)]);
}

async function openKnowledge(topicId = currentKnowledgeId) {
  const payload = await api(`/api/knowledge/${encodeURIComponent(topicId)}`); const topic = payload.topic;
  currentKnowledgeId = topic.id; knowledgeChat = []; showKnowledgePreview(topic);
  $("#lesson-title").textContent = topic.title; $("#lesson-meta").textContent = `${topic.level} · ${topic.type === "grammar" ? "语言结构" : topic.type === "reading" ? "阅读理解" : "听力理解"} · ${topic.skill.replaceAll("_", " ")}`;
  $("#lesson-content").innerHTML = `${topic.sections.map(([title, content], index) => `<article class="lesson-rule"><span>${index + 1}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(content)}</p></article>`).join("")}<section class="lesson-examples"><h3>对比例句</h3>${topic.examples.map(([example, note]) => `<div class="lesson-example"><strong lang="fr">${escapeHtml(example)}</strong><p>${escapeHtml(note)}</p></div>`).join("")}</section>`;
  $("#knowledge-topics").replaceChildren(...knowledgeTopics.map((item) => { const button = document.createElement("button"); button.textContent = item.title; button.classList.toggle("active", item.id === topic.id); button.addEventListener("click", () => openKnowledge(item.id)); return button; }));
  $("#knowledge-messages").innerHTML = '<p class="chat-hint">例如：为什么 penser à quelqu’un 不能用 y？请换一种方式讲数量为什么要保留。</p>';
  $("#knowledge-drawer").hidden = false; document.body.classList.add("knowledge-drawer-open");
}

function closeKnowledge() { $("#knowledge-drawer").hidden = true; document.body.classList.remove("knowledge-drawer-open"); }

function appendKnowledgeMessage(role, content) {
  const message = document.createElement("div"); message.className = `chat-message ${role}`; message.textContent = content; $("#knowledge-messages").append(message); $("#knowledge-messages").scrollTop = $("#knowledge-messages").scrollHeight;
}

async function askKnowledge(event) {
  event.preventDefault(); const input = $("#knowledge-question"); const question = input.value.trim(); if (!question) return;
  const button = $("#knowledge-form button"); appendKnowledgeMessage("user", question); input.value = ""; button.disabled = true; button.textContent = "正在讲解…";
  try {
    const payload = await api("/api/knowledge/ask", { method: "POST", body: JSON.stringify({ topicId: currentKnowledgeId, question, history: knowledgeChat }) });
    knowledgeChat.push({ role: "user", content: question }, { role: "assistant", content: payload.answer }); knowledgeChat = knowledgeChat.slice(-8); appendKnowledgeMessage("assistant", payload.answer);
  } catch (error) { appendKnowledgeMessage("assistant", error.message === "AI_KEY_REQUIRED" ? "追问老师需要先配置 OPENAI_API_KEY。完整固定讲解仍可直接阅读；配置后我会保留本轮上下文，陪你追问到弄懂为止。" : `讲解暂时失败：${error.message}`); }
  finally { button.disabled = false; button.textContent = "追问老师 →"; input.focus(); }
}

async function knowledgePractice() {
  const button = $("#knowledge-practice"); button.disabled = true; button.textContent = "正在生成…";
  try { const payload = await api("/api/knowledge/practice", { method: "POST", body: JSON.stringify({ topicId: currentKnowledgeId, level: $("#knowledge-level").value }) }); closeKnowledge(); openBankQuestion(payload.question); state.mode = "ai"; }
  catch (error) { alert(error.message === "AI_KEY_REQUIRED" ? "生成考点题需要先配置 OPENAI_API_KEY。配置后会严格围绕当前知识点生成 TCF / TEF 风格四选一题。" : `生成失败：${error.message}`); }
  finally { button.disabled = false; button.textContent = "生成考点题 ✦"; }
}

async function loadNotebook() {
  const payload = await api("/api/vocabulary");
  $("#vocab-count").textContent = payload.entries.filter((entry) => !entry.mastered).length;
  $("#notebook-summary").textContent = `${payload.entries.length} 个词`;
  if (!payload.entries.length) {
    const empty = document.createElement("p"); empty.className = "notebook-empty"; empty.textContent = "还没有收藏。做题时选中单词即可加入。"; $("#notebook-list").replaceChildren(empty); return;
  }
  $("#notebook-list").replaceChildren(...payload.entries.map((entry) => {
    const card = document.createElement("article"); card.className = entry.mastered ? "mastered" : "";
    card.innerHTML = `<div><strong>${escapeHtml(entry.word)}</strong><button>${entry.mastered ? "重新学习" : "标记掌握"}</button></div><p>${escapeHtml(entry.contexts[0] || "暂无语境")}</p><small>${new Date(entry.createdAt).toLocaleDateString("zh-CN")}</small>`;
    card.querySelector("strong").addEventListener("click", () => lookupWord(entry.word, entry.contexts[0] || ""));
    card.querySelector("button").addEventListener("click", async () => { await api("/api/vocabulary/mastered", { method: "POST", body: JSON.stringify({ id: entry.id }) }); await loadNotebook(); });
    return card;
  }));
}

function openNotebook() { $("#vocab-drawer").hidden = false; document.body.classList.add("drawer-open"); loadNotebook(); }
function closeNotebook() { $("#vocab-drawer").hidden = true; document.body.classList.remove("drawer-open"); }

async function lookupWord(word, context = "") {
  openNotebook(); $("#lookup-word").textContent = word; $("#lookup-detail").innerHTML = "<p>正在查找用法…</p>";
  try {
    const payload = await api(`/api/vocabulary/lookup?word=${encodeURIComponent(word)}&context=${encodeURIComponent(context)}`);
    if (!payload.result) {
      $("#lookup-detail").innerHTML = `<p><strong>已保留原题语境。</strong></p><p>这个词暂时没有本地词条。配置 AI 后可生成经语境约束的中法用法解析。</p>${context ? `<blockquote>${escapeHtml(context)}</blockquote>` : ""}`; return;
    }
    const item = payload.result;
    $("#lookup-detail").innerHTML = `<div class="word-meaning"><strong>${escapeHtml(item.meaningZh)}</strong><span>${escapeHtml(item.partOfSpeech)}</span></div><section><b>Usage en français</b><p lang="fr">${escapeHtml(item.usageFr)}</p></section><section><b>中文用法</b><p>${escapeHtml(item.usageZh)}</p></section><section><b>常用搭配</b><div class="collocations">${item.collocations.map((text) => `<span>${escapeHtml(text)}</span>`).join("")}</div></section><section><b>例句</b>${item.examples.map((text) => `<p lang="fr">${escapeHtml(text)}</p>`).join("")}</section>`;
  } catch (error) { $("#lookup-detail").innerHTML = `<p>查询失败：${escapeHtml(error.message)}</p>`; }
}

async function saveSelectedWord() {
  if (!selectedVocabulary) return;
  await api("/api/vocabulary", { method: "POST", body: JSON.stringify(selectedVocabulary) });
  $("#selection-tools").hidden = true; await loadNotebook(); openNotebook();
}

function captureVocabularySelection() {
  const selection = window.getSelection(); const raw = selection?.toString().trim();
  if (!raw || raw.length > 80 || raw.split(/\s+/).length > 4 || !selection.anchorNode?.parentElement?.closest("#practice")) { $("#selection-tools").hidden = true; return; }
  const word = raw.replace(/^[^A-Za-zÀ-ÿ'-]+|[^A-Za-zÀ-ÿ'-]+$/g, ""); if (!word) return;
  const range = selection.getRangeAt(0); const rect = range.getBoundingClientRect(); const question = state.questions[state.index];
  selectedVocabulary = { word, context: question?.passage || question?.prompt || selection.anchorNode.parentElement.textContent.trim(), questionId: question?.id || null };
  const tools = $("#selection-tools"); tools.style.left = `${Math.min(window.innerWidth - 220, Math.max(10, rect.left))}px`; tools.style.top = `${Math.max(10, rect.bottom + 8)}px`; tools.hidden = false;
}

async function loadInsights() {
  const insights = await api("/api/insights");
  $("#recommended-today").textContent = `${insights.recommendedToday}题`;
  $("#sprint-review").textContent = `${insights.weakSkills.reduce((sum, item) => sum + item.count, 0)}题`;
  $("#sprint-coverage").textContent = `${insights.imported.percentage}%`;
  $("#sprint-advice").textContent = insights.weakSkills.length
    ? `优先强化：${insights.weakSkills.slice(0, 3).map((item) => item.skill.replaceAll("_", " ")).join("、")}。先复习错题，再做AI重点强化。`
    : "先完成语言结构与阅读各5题，系统会据此识别你的薄弱点。";
  $("#coverage-gaps").replaceChildren(...insights.coverageGaps.slice(0, 8).map((item) => {
    const tag = document.createElement("span"); tag.textContent = `${item.type} · ${item.skill}`; return tag;
  }));
}

async function loadBank() {
  const params = new URLSearchParams({ source: $("#bank-source").value, type: $("#bank-type").value, level: $("#bank-level").value, status: $("#bank-status").value });
  const payload = await api(`/api/bank?${params}`);
  $("#bank-count").textContent = payload.questions.length;
  if (!payload.questions.length) {
    const empty = document.createElement("div"); empty.className = "bank-empty";
    empty.innerHTML = $("#bank-source").value === "user_imported" ? "<strong>真题等待导入</strong><p>你把真题发给我后，会在这里按照原始顺序和难度展示。</p>" : "<strong>没有符合筛选条件的题目</strong>";
    $("#bank-list").replaceChildren(empty); return;
  }
  $("#bank-list").replaceChildren(...payload.questions.map((question) => {
    const card = document.createElement("article"); card.className = `bank-card${question.completed ? " completed" : ""}`;
    const source = question.source === "user_imported" ? "真题" : question.source?.startsWith("ai") ? "AI补充" : "精选";
    const preview = question.passage ? question.passage.slice(0, 105) : question.type === "listening" ? "音频内容仅在作答时播放" : question.prompt;
    card.innerHTML = `<div class="bank-card-top"><span class="level-pill ${question.level.toLowerCase()}">${escapeHtml(question.level)}</span><span>${escapeHtml(source)}</span><span>${escapeHtml(question.type)}</span>${question.completed ? "<b>✓ 已完成</b>" : ""}</div><h3>${escapeHtml(question.prompt)}</h3><p>${escapeHtml(preview)}</p><div><small>${escapeHtml(question.topic)} · ${escapeHtml(question.skill.replaceAll("_", " "))}</small><button>进入作答 →</button></div>`;
    card.querySelector("button").addEventListener("click", () => openBankQuestion(question)); return card;
  }));
}

function openBankQuestion(question) {
  state.type = question.type; state.questions = [question]; state.index = 0; state.mode = question.source === "user_imported" ? "authentic" : "bank"; state.continuousNumber = 1;
  $("#welcome").hidden = true; $("#production").hidden = true; $("#finished").hidden = true; $("#quiz").hidden = false; $("#practice").classList.remove("empty"); render();
  $("#practice").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function smartGenerate() {
  const button = $("#smart-generate"); button.disabled = true; button.textContent = "正在分析题库覆盖…";
  try {
    const payload = await api("/api/smart-generation", { method: "POST", body: JSON.stringify({ mode: $("#ai-mode").value, type: $("#ai-type").value, level: $("#ai-level").value, request: $("#ai-request").value }) });
    openBankQuestion(payload.question); state.mode = "ai";
    $("#notice").hidden = false; $("#notice").textContent = `${payload.reason} · 目标考点：${payload.targetSkill || "综合能力"}`;
  } catch (error) {
    alert(error.message === "AI_KEY_REQUIRED" ? "AI补缺训练需要先配置 OPENAI_API_KEY。配置后会根据真题覆盖缺口和你的错题生成。" : `生成失败：${error.message}`);
  } finally { button.disabled = false; button.textContent = "分析覆盖并生成 ✦"; }
}

async function start(typeOverride, preserveSequence = false) {
  const requestedType = typeof typeOverride === "string" ? typeOverride : state.type;
  if (["writing", "speaking"].includes(requestedType)) return showProduction();
  $("#start").disabled = true; $("#review").disabled = true; $("#start").firstChild.textContent = "正在准备… ";
  try {
    const payload = await api("/api/questions", { method: "POST", body: JSON.stringify({ exam: state.exam, type: requestedType, level: $("#level").value, count: 1, excludeIds: state.recentIds }) });
    if (!payload.questions.length) { alert("这一专项的本地题目正在扩充，请配置 AI 出题或换一个等级。"); return; }
    if (!preserveSequence) state.continuousNumber = 1;
    Object.assign(state, { questions: payload.questions, index: 0, mode: payload.mode, answered: false });
    state.recentIds = [...state.recentIds, ...payload.questions.map((question) => question.id)].slice(-12);
    $("#notice").hidden = !payload.notice; $("#notice").textContent = payload.notice;
    $("#welcome").hidden = true; $("#production").hidden = true; $("#finished").hidden = true; $("#quiz").hidden = false; $("#practice").classList.remove("empty"); render();
  } catch (error) { alert(`暂时无法生成题目：${error.message}`); }
  finally { $("#start").disabled = false; $("#review").disabled = false; $("#start").firstChild.textContent = "开始连续刷题 "; }
}

function render() {
  const question = state.questions[state.index]; state.answered = false; state.audioPlayed = false;
  $("#counter").textContent = `第 ${state.continuousNumber} 题 · 作答后立即解析`;
  $("#source").textContent = state.mode === "ai" ? "AI 同考点变式" : state.mode === "review" ? "错题复习" : "合并精选题库";
  $("#progress").style.width = `${((state.index + 1) / state.questions.length) * 100}%`; $("#topic").textContent = `${question.level} · ${question.topic}`;
  $("#play-audio").hidden = !question.audioText; $("#play-audio").disabled = false; $("#play-audio").textContent = "▶ 播放音频（仅一次）";
  $("#passage").hidden = !question.passage; $("#passage").textContent = question.passage || ""; $("#prompt").textContent = question.prompt;
  $("#feedback").hidden = true; $("#answer-actions").hidden = true;
  $("#options").replaceChildren(...question.options.map((option, index) => { const button = document.createElement("button"); button.innerHTML = `<span>${String.fromCharCode(65 + index)}</span>${option}`; button.setAttribute("aria-label", `${String.fromCharCode(65 + index)}，${option}`); button.addEventListener("click", () => answer(index, button)); return button; }));
}

function playAudio() {
  if (state.audioPlayed) return; const question = state.questions[state.index]; if (!question?.audioText) return;
  state.audioPlayed = true; $("#play-audio").disabled = true; $("#play-audio").textContent = "正在播放…";
  const speech = new SpeechSynthesisUtterance(question.audioText); speech.lang = "fr-FR"; speech.rate = 0.92;
  speech.onend = () => { $("#play-audio").textContent = "✓ 已播放"; }; window.speechSynthesis.speak(speech);
}

async function answer(selected, selectedButton) {
  if (state.answered) return; state.answered = true;
  const result = await api("/api/attempts", { method: "POST", body: JSON.stringify({ questionId: state.questions[state.index].id, selected, exam: state.exam }) });
  const buttons = [...$("#options").children]; buttons.forEach((button) => button.disabled = true); buttons[result.answer].classList.add("correct");
  if (!result.correct) { selectedButton.classList.add("wrong"); state.mistakes.push(state.questions[state.index].skill); } else state.score++;
  const analysis = result.analysis;
  $("#feedback").className = result.correct ? "good feedback-rich" : "bad feedback-rich";
  $("#feedback").innerHTML = `<div class="feedback-title"><strong>${result.correct ? "正确 · Bravo !" : "错误分析"}</strong><span>${escapeHtml(analysis.knowledge.label)}</span></div><section><b>中文解析</b><p>${escapeHtml(analysis.explanationZh)}</p></section><section><b>Explication en français</b><p lang="fr">${escapeHtml(analysis.explanationFr)}</p></section><section class="error-reason"><b>${result.correct ? "复盘建议" : "你错在这里"}</b><p>${escapeHtml(analysis.errorReasonZh)}</p></section>${["grammar", "vocabulary"].includes(state.questions[state.index].type) ? `<section class="knowledge-note"><b>相关知识点</b><p>${escapeHtml(analysis.knowledge.note)}</p></section>` : ""}`;
  $("#feedback").hidden = false; $("#answer-actions").hidden = false; await Promise.all([refreshStats(), loadInsights(), loadBank()]);
}

async function variation() {
  const button = $("#variation"); button.disabled = true; button.textContent = "正在生成…";
  try {
    const payload = await api("/api/variations", { method: "POST", body: JSON.stringify({ questionId: state.questions[state.index].id, request: $("#variation-request").value }) });
    state.questions = [payload.question]; state.index = 0; state.mode = "ai"; state.continuousNumber++; render();
  } catch (error) {
    alert(error.message === "AI_KEY_REQUIRED" ? "举一反三需要先配置 OPENAI_API_KEY。配置后会针对当前考点生成全新的变式题。" : `生成失败：${error.message}`);
  } finally { button.disabled = false; button.textContent = "生成变式题 ✦"; }
}

function next() {
  state.continuousNumber++;
  start(state.mode === "review" ? "review" : state.type, true);
}

function showProduction() {
  const tasks = productionTasks[state.exam][state.productionType]; const task = tasks[Math.floor(Math.random() * tasks.length)];
  $("#welcome").hidden = true; $("#quiz").hidden = true; $("#finished").hidden = true; $("#production").hidden = false; $("#practice").classList.remove("empty");
  $("#production-exam").textContent = `${state.exam.toUpperCase()} · ${state.productionType === "writing" ? "表达写作" : "口语表达"}`; $("#production-format").textContent = task[0];
  $("#production-topic").textContent = $("#level").value; $("#production-prompt").textContent = task[1]; $("#production-guidance").textContent = task[2];
  $("#production-answer").hidden = state.productionType === "speaking"; $("#production-answer").value = ""; $("#word-count").textContent = state.productionType === "writing" ? "0 mots" : "请计时录音练习";
}

$("#start").addEventListener("click", () => start()); $("#review").addEventListener("click", () => start("review")); $("#again").addEventListener("click", () => start()); $("#next").addEventListener("click", next); $("#variation").addEventListener("click", variation); $("#play-audio").addEventListener("click", playAudio); $("#new-production").addEventListener("click", showProduction);
$("#production-answer").addEventListener("input", (event) => { const words = event.target.value.trim().split(/\s+/).filter(Boolean).length; $("#word-count").textContent = `${words} mots`; });
$("#refresh-knowledge").addEventListener("click", refreshKnowledge); $("#open-knowledge").addEventListener("click", () => openKnowledge()); $("#close-knowledge").addEventListener("click", closeKnowledge); $("#knowledge-form").addEventListener("submit", askKnowledge); $("#knowledge-practice").addEventListener("click", knowledgePractice);
$("#open-notebook").addEventListener("click", openNotebook); $("#close-notebook").addEventListener("click", closeNotebook);
$("#lookup-selection").addEventListener("click", () => selectedVocabulary && lookupWord(selectedVocabulary.word, selectedVocabulary.context));
$("#save-selection").addEventListener("click", saveSelectedWord);
document.addEventListener("mouseup", () => setTimeout(captureVocabularySelection, 0));
document.addEventListener("click", (event) => {
  if (event.target.closest("#options button") && window.getSelection()?.toString().trim()) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
$("#smart-generate").addEventListener("click", smartGenerate);
for (const selector of ["#bank-source", "#bank-type", "#bank-level", "#bank-status"]) $(selector).addEventListener("change", loadBank);
document.addEventListener("keydown", (event) => { if ($("#quiz").hidden) return; if (!state.answered && ["1", "2", "3", "4"].includes(event.key)) { const button = $("#options").children[Number(event.key) - 1]; if (button) button.click(); } else if (state.answered && (event.key === "Enter" || event.key === " ")) next(); });

renderCatalog();
Promise.all([api("/api/health"), refreshStats(), loadInsights(), loadBank(), loadNotebook(), loadKnowledgeTopics()]).then(([health]) => { $("#ai-status").textContent = health.aiEnabled ? "● AI 已连接" : "● 本地题库模式"; $("#ai-status").classList.add("ready"); }).catch(() => { $("#ai-status").textContent = "连接失败"; });
