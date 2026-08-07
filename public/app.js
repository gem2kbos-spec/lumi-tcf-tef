const state = { exam: "tcf", type: "grammar", questions: [], index: 0, score: 0, mode: "bank", answered: false, mistakes: [], audioPlayed: false, productionType: null, continuousNumber: 1, recentIds: [] };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

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
  $("#feedback").hidden = false; $("#answer-actions").hidden = false; await refreshStats();
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
document.addEventListener("keydown", (event) => { if ($("#quiz").hidden) return; if (!state.answered && ["1", "2", "3", "4"].includes(event.key)) { const button = $("#options").children[Number(event.key) - 1]; if (button) button.click(); } else if (state.answered && (event.key === "Enter" || event.key === " ")) next(); });

renderCatalog();
Promise.all([api("/api/health"), refreshStats()]).then(([health]) => { $("#ai-status").textContent = health.aiEnabled ? "● AI 已连接" : "● 本地题库模式"; $("#ai-status").classList.add("ready"); }).catch(() => { $("#ai-status").textContent = "连接失败"; });
