const state = { exam: "tcf", type: "grammar", questions: [], index: 0, score: 0, mode: "bank", answered: false, submitting: false, mistakes: [], productionType: null, continuousNumber: 1, recentIds: [], activeCategory: null, sequence: null };
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const richInline = (value) => escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`(.+?)`/g, "<code>$1</code>");
let toastTimer = null;
function showToast(message, tone = "info") {
  const toast = $("#app-toast"); if (!toast) return;
  toast.textContent = message; toast.dataset.tone = tone; toast.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
}
function userStorageKey(suffix) { return `lumi:${window.__LUMI_AUTH__?.user?.id || "guest"}:${suffix}`; }
function savePreferences() {
  try { localStorage.setItem(userStorageKey("preferences"), JSON.stringify({ exam: state.exam, type: state.type, level: $("#level")?.value || "all", category: state.activeCategory, bankType: $("#bank-type")?.value || "all", bankLevel: $("#bank-level")?.value || "all", bankStatus: $("#bank-status")?.value || "all" })); } catch {}
}
function savePracticeSession() {
  const question = state.questions[state.index]; if (!question || state.answered) return;
  if (String(question.source || "").startsWith("ai")) return;
  try { localStorage.setItem(userStorageKey("practice"), JSON.stringify({ savedAt: Date.now(), exam: state.exam, type: state.type, mode: state.mode, continuousNumber: state.continuousNumber, activeCategory: state.activeCategory, sequence: state.sequence, question })); } catch {}
}
function clearPracticeSession() { try { localStorage.removeItem(userStorageKey("practice")); } catch {} refreshPracticeLaunch(); }
function readPracticeSession() { try { const saved = JSON.parse(localStorage.getItem(userStorageKey("practice")) || "null"); return saved?.question && Date.now() - saved.savedAt < 30 * 86400000 ? saved : null; } catch { return null; } }
function restorePreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(userStorageKey("preferences")) || "null"); if (!saved) return;
    if (saved.exam && catalogs[saved.exam]) state.exam = saved.exam;
    if (["grammar", "vocabulary", "reading"].includes(saved.type)) state.type = saved.type;
    if (saved.level && [...$("#level").options].some((option) => option.value === saved.level)) $("#level").value = saved.level;
    if (saved.bankType) $("#bank-type").value = saved.bankType;
    if (saved.bankLevel) $("#bank-level").value = saved.bankLevel;
    if (saved.bankStatus) $("#bank-status").value = saved.bankStatus;
    state.activeCategory = saved.category || null;
  } catch {}
}
function refreshPracticeLaunch(saved = readPracticeSession()) {
  const button = $("#open-practice-hub"); if (!button) return;
  if (!saved) { button.classList.remove("has-resume"); button.innerHTML = "开始刷题 <b>→</b>"; return; }
  const labels = { grammar: "语法", vocabulary: "词汇", reading: "阅读" };
  button.classList.add("has-resume"); button.innerHTML = `<span><small>继续上次训练</small>${labels[saved.type] || "机经"} · ${escapeHtml(saved.question.level || "综合")} · 第 ${saved.continuousNumber || 1} 题</span><b>继续 →</b>`;
}
function resumePractice(saved) {
  Object.assign(state, { exam: saved.exam || "tcf", type: saved.type, mode: saved.mode || "bank", continuousNumber: saved.continuousNumber || 1, activeCategory: saved.activeCategory || null, sequence: saved.sequence || null, questions: [saved.question], index: 0 });
  openPracticeHub(); $("#welcome").hidden = true; $("#production").hidden = true; $("#finished").hidden = true; $("#quiz").hidden = false; $("#practice").classList.remove("empty"); renderCatalog(); render();
}
function prepareResume() { refreshPracticeLaunch(); }

function renderTutorRichText(container, content) {
  const lines = String(content || "").split(/\r?\n/); const fragment = document.createDocumentFragment();
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim(); if (!line) { index++; continue; }
    if (line.includes("|") && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const rows = []; const cells = (text) => text.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      rows.push(cells(line)); index += 2; while (index < lines.length && lines[index].includes("|")) rows.push(cells(lines[index++]));
      const wrap = document.createElement("div"); wrap.className = "tutor-table-wrap"; const table = document.createElement("table");
      rows.forEach((row, rowIndex) => { const tr = document.createElement("tr"); row.forEach((cell) => { const element = document.createElement(rowIndex ? "td" : "th"); element.innerHTML = richInline(cell); tr.append(element); }); table.append(tr); }); wrap.append(table); fragment.append(wrap); continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)/); if (heading) { const element = document.createElement(heading[1].length === 1 ? "h3" : "h4"); element.innerHTML = richInline(heading[2]); fragment.append(element); index++; continue; }
    if (/^[-*]\s+/.test(line)) { const list = document.createElement("ul"); while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) { const item = document.createElement("li"); item.innerHTML = richInline(lines[index].replace(/^\s*[-*]\s+/, "")); list.append(item); index++; } fragment.append(list); continue; }
    const paragraph = document.createElement("p"); const parts = [line]; index++; while (index < lines.length && lines[index].trim() && !lines[index].includes("|") && !/^(#{1,3}|\s*[-*])\s+/.test(lines[index])) parts.push(lines[index++].trim()); paragraph.innerHTML = parts.map(richInline).join("<br>"); fragment.append(paragraph);
  }
  container.replaceChildren(fragment);
}
let selectedVocabulary = null;
let knowledgeTopics = [];
let currentKnowledgeId = "y-en-prepositions";
let knowledgeChat = [];
let categoryCatalog = [];
let bankOffset = 0;
let bankLoading = false;
let bankHasMore = false;
let bankSearchTimer = null;
let tutorHistory = [];
let journalEntries = [];
let journalFilter = "all";
let historyAttempts = [];
let dashboardStats = null;
let dashboardActivity = null;
let dashboardGoal = 10;
const workspacePanelIds = ["exam-center", "activity-center", "ai-center", "bank-center"];

function updateTodayPlan() {
  if (!dashboardStats || !dashboardActivity) return;
  const done = dashboardActivity.todayTotal || 0;
  const goal = dashboardGoal || 10;
  const reviewCount = dashboardStats.pendingReview || 0;
  const remaining = Math.max(0, goal - done);
  $("#today-goal-bar").style.width = `${Math.min(100, Math.round(done / goal * 100))}%`;
  $("#today-goal-text").textContent = remaining ? `今天已完成 ${done} / ${goal}` : `今日目标已完成 · 共 ${done} 题`;
  if (reviewCount) {
    $("#today-focus-label").textContent = "建议先做";
    $("#daily-recommendation").textContent = `${reviewCount} 道错题待复习`;
    $("#today-next-reason").textContent = "复习后答对的题会自动离开待复习列表。";
    $("#today-start").textContent = "去复习";
    $("#today-start").dataset.action = "review";
  } else {
    $("#today-focus-label").textContent = remaining ? "今日训练" : "今日已完成";
    $("#daily-recommendation").textContent = remaining ? `还差 ${remaining} 题` : "可以收尾，也可以继续";
    $("#today-next-reason").textContent = remaining ? "继续上次选择的考试、题型和难度。" : "新的错题会自动进入复习列表。";
    $("#today-start").textContent = remaining ? "继续" : "再练几题";
    $("#today-start").dataset.action = "continue";
  }
}

function activateWorkspace(viewId, { updateHash = true } = {}) {
  const target = workspacePanelIds.includes(viewId) ? viewId : "exam-center";
  const headings = { "exam-center": ["练习", "TCF / TEF 专项训练"], "bank-center": ["机经", "查找和做题"], "ai-center": ["AI专项", "生成补充练习"], "activity-center": ["记录", "进度和历史"] };
  document.body.classList.add("workspace-navigation-ready");
  document.body.dataset.workspaceView = target;
  const [section, title] = headings[target]; $("#content-section-label").textContent = section; $("#content-section-title").textContent = title;
  workspacePanelIds.forEach((id) => $("#" + id)?.classList.toggle("active", id === target));
  document.querySelectorAll("[data-workspace-view]").forEach((item) => item.classList.toggle("active", item.dataset.workspaceView === target));
  try { localStorage.setItem(userStorageKey("workspace"), target); } catch {}
  if (updateHash && location.hash !== `#${target}`) history.replaceState(null, "", `#${target}`);
  requestAnimationFrame(() => $("#" + target)?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

const catalogs = {
  tcf: {
    title: "TCF 重点训练", note: "语法、词汇、阅读与书面表达",
    modules: [
      ["grammar", "语言结构", "18题 · 15分钟", "语法、词汇与语域", "MSL"],
      ["reading", "阅读理解", "29题 · 45分钟", "日常文本到观点文章", "CE"],
      ["writing", "书面表达", "3项 · 60分钟", "信息、叙述与观点比较", "EE"]
    ]
  },
  tef: {
    title: "TEF 重点训练", note: "阅读、词汇结构与表达",
    modules: [
      ["reading", "阅读理解", "40题 · 60分钟", "四选一，可自由导航", "CE"],
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

function revealPractice({ smooth = true } = {}) {
  const practice = $("#practice"); const hub = $("#practice-hub");
  requestAnimationFrame(() => {
    if (window.matchMedia("(max-width: 700px)").matches && !hub.hidden) {
      hub.scrollTo({ top: Math.max(0, practice.offsetTop - 8), behavior: smooth ? "smooth" : "auto" });
    } else practice.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  });
}

function selectModule(type) {
  state.type = type;
  $("#practice-hub").classList.remove("is-answering", "show-settings");
  state.activeCategory = null;
  state.productionType = ["writing", "speaking"].includes(type) ? type : null;
  savePreferences();
  document.querySelectorAll("[data-type]").forEach((item) => item.classList.toggle("active", item.dataset.type === type));
  renderCatalog();
  if (state.productionType) showProduction();
  else {
    $("#production").hidden = true; $("#quiz").hidden = true; $("#finished").hidden = true; $("#welcome").hidden = false;
    $("#welcome h2").textContent = catalogs[state.exam].modules.find((item) => item[0] === type)[1];
    $("#welcome p").textContent = "选择等级后即可开始专项训练。";
  }
  openPracticeHub();
  revealPractice();
}

document.querySelectorAll("[data-exam]").forEach((button) => button.addEventListener("click", () => {
  state.exam = button.dataset.exam;
  savePreferences();
  document.querySelectorAll("[data-exam]").forEach((item) => item.classList.toggle("active", item === button));
  selectModule(state.exam === "tcf" ? "grammar" : "mixed");
}));
document.querySelectorAll("[data-type]").forEach((button) => button.addEventListener("click", () => selectModule(button.dataset.type)));

async function api(path, options) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(path, { ...options, signal: controller.signal, headers: { "Content-Type": "application/json" } });
    const payload = await response.json().catch(() => ({ error: "服务器返回异常，请稍后重试" })); if (!response.ok) throw new Error(payload.error || "请求失败"); return payload;
  } catch (error) { if (error.name === "AbortError") throw new Error("请求超过60秒，已自动恢复按钮，请重试"); throw error; }
  finally { clearTimeout(timeout); }
}

async function refreshStats() {
  const stats = await api("/api/stats");
  dashboardStats = stats;
  $("#accuracy").textContent = `${stats.accuracy}%`; $("#total").textContent = stats.total; $("#streak").textContent = stats.streak;
  $("#authentic-progress").textContent = `${stats.bank.completed}/${stats.bank.total}`;
  $("#dashboard-accuracy").textContent = stats.total ? `${stats.accuracy}%` : "暂无"; $("#dashboard-streak").textContent = stats.streak; $("#dashboard-remaining").textContent = stats.bank.remaining;
  const abilityLabels = { grammar: "语言结构", vocabulary: "词汇", reading: "阅读" };
  $("#ability-overview").replaceChildren(...Object.entries(abilityLabels).map(([type, label]) => { const item = stats.byType[type] || { total: 0, accuracy: 0 }; const row = document.createElement("div"); row.innerHTML = `<span>${label}<small>${item.total ? `${item.total}题` : "暂无数据"}</small></span><i><b style="width:${item.total ? item.accuracy : 0}%"></b></i><strong>${item.total ? `${item.accuracy}%` : "—"}</strong>`; return row; }));
  $("#review-count").textContent = stats.pendingReview;
  updateTodayPlan();
  const weak = stats.weakSkills.slice(0, 4); $("#weak-card").hidden = weak.length === 0;
  $("#weak-skills").replaceChildren(...weak.map((item) => {
    const row = document.createElement("article"); row.className = "weak-skill-row";
    row.innerHTML = `<div class="weak-meta"><em>${escapeHtml(item.examAbility)}</em><span>错 ${item.count}/${item.total} · ${item.errorRate}%</span></div><strong>${escapeHtml(item.title)}</strong><p><b>错误判断</b>${escapeHtml(item.errorType)}</p><p><b>下一步</b>${escapeHtml(item.action)}</p><button>练同类机经 →</button>${item.latestReason && item.latestReason !== item.errorType ? `<details><summary>查看最近一次错因</summary><p>${escapeHtml(item.latestReason)}</p></details>` : ""}`;
    row.querySelector("button").addEventListener("click", () => practiceWeakPoint(item)); return row;
  }));
}

function practiceWeakPoint(item) {
  state.type = item.type; state.activeCategory = item.category || null; state.productionType = null;
  document.querySelectorAll("[data-type]").forEach((button) => button.classList.toggle("active", button.dataset.type === item.type));
  renderCatalog(); openPracticeHub(); start(item.type);
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
  $("#lesson-title").textContent = topic.title; $("#lesson-meta").textContent = `${topic.level} · ${topic.type === "grammar" ? "语言结构" : topic.type === "reading" ? "阅读理解" : "词汇"} · ${topic.skill.replaceAll("_", " ")}`;
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
    knowledgeChat.push({ role: "user", content: question }, { role: "assistant", content: payload.answer }); knowledgeChat = knowledgeChat.slice(-8); appendKnowledgeMessage("assistant", payload.answer); await loadJournal();
  } catch (error) { appendKnowledgeMessage("assistant", error.message === "AI_KEY_REQUIRED" ? "追问老师需要先配置 DeepSeek 密钥。完整固定讲解仍可直接阅读；配置后我会保留本轮上下文，陪你追问到弄懂为止。" : `讲解暂时失败：${error.message}`); }
  finally { button.disabled = false; button.textContent = "追问老师 →"; input.focus(); }
}

async function knowledgePractice() {
  const button = $("#knowledge-practice"); button.disabled = true; button.textContent = "正在生成…";
  try { const payload = await api("/api/knowledge/practice", { method: "POST", body: JSON.stringify({ topicId: currentKnowledgeId, level: $("#knowledge-level").value }) }); closeKnowledge(); openBankQuestion(payload.question); state.mode = "ai"; }
  catch (error) { showToast(error.message === "AI_KEY_REQUIRED" ? "生成考点题需要先配置 DeepSeek 密钥。" : `生成失败：${error.message}`, "error"); }
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

function openNotebook({ preserveContext = false } = {}) { if (!preserveContext) { $("#journal-drawer").hidden = true; $("#mistake-drawer").hidden = true; closeTutor(); closeHistory(); closePracticeHub(); } $("#vocab-drawer").hidden = false; document.body.classList.add("notebook-open"); loadNotebook(); }
function closeNotebook() { $("#vocab-drawer").hidden = true; document.body.classList.remove("notebook-open"); }

function isQuickReference(entry) { return entry.subtype === "quick-reference" || /\|\s*:?-{3,}/.test(entry.content || ""); }

function createJournalCard(entry) {
  const card = document.createElement("article"); card.className = `journal-entry ${entry.kind}`;
  const top = document.createElement("div"); const kind = document.createElement("span"); const time = document.createElement("time");
  kind.textContent = entry.kind === "mistake" ? "错题考点" : isQuickReference(entry) ? "速查表" : "答疑整理"; time.textContent = new Date(entry.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); top.append(kind, time);
  const title = document.createElement("h3"); title.textContent = entry.title;
  const meta = document.createElement("div"); meta.className = "journal-meta"; [entry.meta?.category, entry.meta?.level, entry.meta?.type === "reading" ? "阅读" : entry.meta?.type === "vocabulary" ? "词汇" : entry.meta?.type === "grammar" ? "语法" : ""].filter(Boolean).forEach((text) => { const chip = document.createElement("span"); chip.textContent = text; meta.append(chip); });
  const question = document.createElement("p"); question.className = "journal-question"; question.textContent = `${entry.kind === "question" ? "我的提问" : "原题回看"}：${entry.question}`;
  const detail = document.createElement("details"); const summary = document.createElement("summary"); const content = document.createElement("div"); content.className = "journal-content"; summary.textContent = entry.kind === "mistake" ? "展开错因与解析" : "展开整理内容"; renderTutorRichText(content, entry.content); detail.append(summary, content);
  card.append(top, title); if (meta.children.length) card.append(meta); card.append(question, detail); return card;
}

function renderJournal() {
  const knowledgeEntries = journalEntries.filter((entry) => entry.kind !== "mistake");
  const entries = knowledgeEntries.filter((entry) => journalFilter === "all" || journalFilter === "quick-reference" ? (journalFilter === "all" || isQuickReference(entry)) : entry.kind === journalFilter);
  if (!entries.length) {
    const empty = document.createElement("p"); empty.className = "journal-empty"; empty.textContent = journalFilter === "quick-reference" ? "还没有速查表。让lili老师生成对比表或速查表后会自动归入这里。" : "还没有知识整理内容。向lili老师提问后会自动出现在这里。";
    $("#journal-list").replaceChildren(empty); return;
  }
  $("#journal-list").replaceChildren(...entries.map(createJournalCard));
}

function renderMistakes() {
  const mistakes = journalEntries.filter((entry) => entry.kind === "mistake" && entry.meta?.analysisVersion === 2); $("#mistake-count").textContent = mistakes.length; $("#mistake-ball-count").textContent = mistakes.length;
  if (!mistakes.length) { const empty = document.createElement("p"); empty.className = "journal-empty"; empty.textContent = "还没有错题。做错后会自动按具体考点整理到这里。"; $("#mistake-list").replaceChildren(empty); return; }
  $("#mistake-list").replaceChildren(...mistakes.map(createJournalCard));
}

async function loadJournal() {
  const payload = await api("/api/journal"); journalEntries = payload.entries || []; $("#journal-count").textContent = journalEntries.filter((entry) => entry.kind !== "mistake").length; renderJournal(); renderMistakes();
}
function openJournal() { closeNotebook(); closeMistakes(); closeTutor(); closeHistory(); closePracticeHub(); $("#journal-drawer").hidden = false; loadJournal(); }
function closeJournal() { $("#journal-drawer").hidden = true; }
function openMistakes() { closeNotebook(); closeJournal(); closeTutor(); closeHistory(); closePracticeHub(); $("#mistake-drawer").hidden = false; loadJournal(); }
function closeMistakes() { $("#mistake-drawer").hidden = true; }

async function lookupWord(word, context = "") {
  openNotebook({ preserveContext: true }); $("#lookup-word").textContent = word; $("#lookup-detail").innerHTML = "<p>正在查找用法…</p>";
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
  const button = $("#save-selection"); button.disabled = true; button.textContent = "正在转为原形…";
  try { const payload = await api("/api/vocabulary", { method: "POST", body: JSON.stringify(selectedVocabulary) }); await loadNotebook(); button.textContent = `✓ 已加入：${payload.lemma}`; setTimeout(() => { $("#selection-tools").hidden = true; button.textContent = "＋ 生词本"; }, 1100); }
  finally { button.disabled = false; }
}

function frenchWordAtPoint(x, y) {
  const range = document.caretRangeFromPoint?.(x, y); if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;
  const text = range.startContainer.textContent || ""; const offset = range.startOffset; const isFrench = /[A-Za-zÀ-ÖØ-öø-ÿŒœ'-]/;
  let start = offset; let end = offset; while (start > 0 && isFrench.test(text[start - 1])) start--; while (end < text.length && isFrench.test(text[end])) end++;
  const word = text.slice(start, end).replace(/^[-']+|[-']+$/g, ""); if (!/[A-Za-zÀ-ÖØ-öø-ÿŒœ]/.test(word)) return null;
  const wordRange = document.createRange(); wordRange.setStart(range.startContainer, start); wordRange.setEnd(range.startContainer, end); return { word, range: wordRange, element: range.startContainer.parentElement };
}

function firstFrenchWordIn(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT); let node;
  while ((node = walker.nextNode())) { const match = node.textContent.match(/[A-Za-zÀ-ÖØ-öø-ÿŒœ]+(?:['’-][A-Za-zÀ-ÖØ-öø-ÿŒœ]+)*/); if (match) { const range = document.createRange(); range.setStart(node, match.index); range.setEnd(node, match.index + match[0].length); return { word: match[0], range, element: node.parentElement }; } }
  return null;
}

function showVocabularyTools({ word, range, element }, point = null) {
  if (!word || word.length > 80 || word.split(/\s+/).length > 4 || element?.closest("input, textarea, select, [contenteditable=true], #selection-tools")) return false;
  const question = element?.closest("#practice") ? state.questions[state.index] : null;
  const contextElement = element?.closest("p, h1, h2, h3, article, section, button, li, td, th") || element;
  const context = question?.passage || question?.prompt || contextElement?.textContent.trim().slice(0, 800) || "";
  selectedVocabulary = { word: word.replace(/^[^A-Za-zÀ-ÿŒœ'-]+|[^A-Za-zÀ-ÿŒœ'-]+$/g, ""), context, questionId: question?.id || null }; if (!selectedVocabulary.word) return false;
  const rect = range?.getBoundingClientRect(); const x = point?.x ?? rect?.left ?? 10; const y = point?.y ?? rect?.bottom ?? 10;
  const tools = $("#selection-tools"); $("#save-selection").textContent = `＋ “${selectedVocabulary.word}”`; tools.style.left = `${Math.min(window.innerWidth - 230, Math.max(10, x))}px`; tools.style.top = `${Math.min(window.innerHeight - 60, Math.max(10, y + 8))}px`; tools.hidden = false; return true;
}

function captureVocabularySelection() {
  const selection = window.getSelection(); const raw = selection?.toString().trim();
  if (!raw || !selection.rangeCount) { $("#selection-tools").hidden = true; return; }
  const range = selection.getRangeAt(0); const element = selection.anchorNode?.nodeType === Node.TEXT_NODE ? selection.anchorNode.parentElement : selection.anchorNode;
  if (!showVocabularyTools({ word: raw, range, element })) $("#selection-tools").hidden = true;
}

async function loadInsights() {
  const insights = await api("/api/insights");
  dashboardGoal = insights.recommendedToday;
  updateTodayPlan();
  const typeLabels = { grammar: "语言结构", vocabulary: "词汇", reading: "阅读" };
  const skillLabels = {
    technologie: "科技主题", culture: "文化主题", médias: "媒体主题", société: "社会主题",
    "identifier l'intention": "判断说话意图", "comprendre l'idée principale": "理解主旨",
    "repérer une information détaillée": "定位详细信息", "inférer l'attitude d'un locuteur": "推断说话人态度",
    "comprendre un échange professionnel courant": "理解常见职场对话"
  };
  $("#coverage-gaps").replaceChildren(...insights.coverageGaps.slice(0, 8).map((item) => {
    const tag = document.createElement("span"); tag.textContent = `${typeLabels[item.type] || item.type} · ${skillLabels[item.skill] || item.skill}`; return tag;
  }));
}

async function loadActivity() {
  const activity = await api("/api/activity");
  dashboardActivity = activity;
  $("#history-authentic").textContent = `${activity.historicBank} / ${activity.bankTotal}`;
  const bankRemaining = Math.max(0, activity.bankTotal - activity.historicBank);
  $("#history-generated").textContent = `${bankRemaining}题`; $("#today-authentic").textContent = `${activity.todayBank}题`; $("#today-generated").textContent = `${activity.todayTotal}题`;
  $("#history-authentic-percent").textContent = `${activity.bankPercentage}% · 剩余 ${bankRemaining} 题`; $("#authentic-progress-bar").style.width = `${activity.bankPercentage}%`;
  $("#today-total").textContent = `${activity.todayTotal}题`; $("#today-accuracy").textContent = `${activity.todayAccuracy}%`; $("#authentic-total").textContent = `${activity.bankTotal}题`;
  $("#last-activity").textContent = activity.lastActivityAt ? new Date(activity.lastActivityAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "暂无记录";
  updateTodayPlan();
}

function renderHistoryDetail(attempt) {
  const question = attempt.question; const detail = $("#history-detail");
  const source = "机经";
  detail.innerHTML = `<div class="history-meta"><span>${escapeHtml(question.level || "")}</span><span>${escapeHtml(question.categoryLabel || question.topic || "综合考点")}</span><span>${source}</span><span>${attempt.correct ? "本次正确" : "本次错误"}</span></div>${question.passage ? `<div class="history-passage">${escapeHtml(question.passage)}</div>` : ""}<h3>${escapeHtml(question.prompt)}</h3><div class="history-options">${question.options.map((option, index) => `<div class="history-option${option === attempt.correctOption ? " correct" : index === attempt.selected && !attempt.correct ? " wrong" : ""}"><b>${String.fromCharCode(65 + index)}</b> ${escapeHtml(option)}${option === attempt.correctOption ? " · 正确答案" : index === attempt.selected ? " · 你的选择" : ""}</div>`).join("")}</div><div class="history-analysis"><section><b>${attempt.analysis ? "新版详细中文解析" : "旧解析已撤下"}</b><p>${escapeHtml(attempt.analysis?.detailedZh || "这次历史作答没有新版解析。重新作答后会先立即显示正确答案，再生成逐项详细解析。")}</p></section></div><div class="history-variation"><div><strong>生成类似题目</strong><span>围绕同一考点立即再练一题</span></div><input id="history-variation-request" maxlength="300" placeholder="例如：难一点，换成生活场景，干扰项更接近……"><button id="history-generate-variation">生成并作答 ✦</button></div>`;
  $("#history-generate-variation").addEventListener("click", () => generateHistoryVariation(attempt));
}

async function generateHistoryVariation(attempt) {
  const button = $("#history-generate-variation"); button.disabled = true; button.textContent = "正在生成…";
  try { const payload = await api("/api/variations", { method: "POST", body: JSON.stringify({ questionId: attempt.questionId, request: $("#history-variation-request").value }) }); closeHistory(); openPracticeHub(); openBankQuestion(payload.question); state.mode = "ai"; }
  catch (error) { showToast(error.message === "AI_KEY_REQUIRED" ? "生成类似题需要先连接 DeepSeek。" : `生成失败：${error.message}`, "error"); button.disabled = false; button.textContent = "生成并作答 ✦"; }
}

function renderHistory() {
  $("#history-count").textContent = `共 ${historyAttempts.length} 次作答 · 最新在前`;
  if (!historyAttempts.length) { const empty = document.createElement("p"); empty.className = "journal-empty"; empty.textContent = "没有符合筛选条件的记录。"; $("#history-list").replaceChildren(empty); $("#history-detail").innerHTML = "<p>调整筛选条件后查看。</p>"; return; }
  const cards = historyAttempts.map((attempt, index) => { const card = document.createElement("button"); card.className = `history-card${index === 0 ? " active" : ""}`; card.innerHTML = `<div><b class="${attempt.correct ? "correct" : "wrong"}">${attempt.correct ? "✓ 正确" : "✕ 错误"}</b><time>${new Date(attempt.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div><p>${escapeHtml(attempt.question.prompt)}</p><small>${escapeHtml(attempt.question.level)} · ${escapeHtml(attempt.question.categoryLabel || attempt.question.topic || "综合考点")}</small>`; card.addEventListener("click", () => { document.querySelectorAll(".history-card").forEach((item) => item.classList.toggle("active", item === card)); renderHistoryDetail(attempt); }); return card; });
  $("#history-list").replaceChildren(...cards); renderHistoryDetail(historyAttempts[0]);
}

async function loadHistory() {
  const params = new URLSearchParams({ type: $("#history-type").value, result: $("#history-result").value, source: $("#history-source").value, level: $("#history-level").value }); const payload = await api(`/api/history?${params}`); historyAttempts = payload.attempts; renderHistory();
}
function openHistory() { closeNotebook(); closeJournal(); closeMistakes(); closeTutor(); closePracticeHub(); $("#history-drawer").hidden = false; loadHistory(); }
function closeHistory() { $("#history-drawer").hidden = true; }
function openPracticeHub() {
  closeNotebook(); closeJournal(); closeMistakes(); closeTutor(); closeHistory();
  if (!state.questions[state.index] || state.answered) {
    $("#practice-hub").classList.remove("is-answering", "show-settings");
    $("#quiz").hidden = true; $("#production").hidden = true; $("#finished").hidden = true; $("#welcome").hidden = false; $("#practice").classList.add("empty");
  }
  $("#practice-hub").hidden = false;
}
function closePracticeHub() { if (!$("#practice-hub").hidden && state.questions[state.index] && !state.answered) { savePracticeSession(); refreshPracticeLaunch(); showToast("当前题目已保存，下次可以继续", "info"); } $("#practice-hub").hidden = true; }

async function loadBank(reset = true) {
  if (bankLoading) return; bankLoading = true; $("#bank-list").classList.add("loading");
  if (reset) bankOffset = 0;
  if (reset) $("#bank-list").setAttribute("aria-busy", "true");
  const params = new URLSearchParams({ source: $("#bank-source").value, type: $("#bank-type").value, level: $("#bank-level").value, status: $("#bank-status").value, category: $("#bank-category").value, answerStatus: $("#bank-answer-status").value, q: $("#bank-search").value.trim(), offset: bankOffset, limit: 50 });
  try {
    const payload = await api(`/api/bank?${params}`);
    $("#bank-count").textContent = payload.meta.total; bankHasMore = payload.meta.hasMore; $("#bank-load-more").hidden = !bankHasMore;
    if (!payload.questions.length && reset) {
    const empty = document.createElement("div"); empty.className = "bank-empty";
    empty.innerHTML = "<strong>没有符合当前条件的题目</strong><p>可以清除搜索词，或放宽题型、难度和答案状态。</p>";
    $("#bank-list").replaceChildren(empty); return;
    }
    const cards = payload.questions.map((question) => {
    const card = document.createElement("article"); card.className = `bank-card${question.completed ? " completed" : ""}`;
    const source = "机经";
    const preview = question.passage ? question.passage.slice(0, 105) : question.prompt;
    const category = question.categoryLabel || categoryCatalog.find((item) => item.id === question.category)?.label || question.skill.replaceAll("_", " ");
    card.innerHTML = `<div class="bank-card-top"><span class="level-pill ${question.level.toLowerCase()}">${question.levelEstimated ? "≈" : ""}${escapeHtml(question.level)}</span><span>难度 ${question.difficulty}/10</span><span>${escapeHtml(source)}</span><span class="category-tag">${escapeHtml(category)}</span>${question.completed ? "<b>✓ 已完成</b>" : ""}</div><h3>${escapeHtml(question.prompt)}</h3>${question.passage ? `<p>${escapeHtml(preview)}</p>` : ""}<div><small>${escapeHtml(question.topic)}</small><button ${question.answerVerified ? "" : "disabled"}>${question.answerVerified ? "进入作答 →" : "暂不开放"}</button></div>`;
    if (question.answerVerified) card.querySelector("button").addEventListener("click", () => openBankQuestion(question)); else card.classList.add("pending-answer"); return card;
    });
    if (reset) $("#bank-list").replaceChildren(...cards); else $("#bank-list").append(...cards);
    bankOffset += payload.questions.length;
  } catch (error) {
    if (reset) { const retry = document.createElement("button"); retry.className = "bank-retry"; retry.innerHTML = `<strong>题库暂时没有载入</strong><span>${escapeHtml(error.message)}</span><b>重新加载</b>`; retry.addEventListener("click", () => loadBank(true)); $("#bank-list").replaceChildren(retry); }
    else showToast(`更多题目加载失败：${error.message}`, "error");
  } finally { bankLoading = false; $("#bank-list").classList.remove("loading"); $("#bank-list").removeAttribute("aria-busy"); }
}

async function loadCategories(type = $("#category-type").value) {
  const payload = await api(`/api/categories?type=${encodeURIComponent(type)}`); categoryCatalog = payload.categories;
  const visibleCategories = payload.categories.filter((category) => category.readyTotal > 0);
  $("#category-grid").replaceChildren(...visibleCategories.map((category) => {
    const progress = category.total ? Math.round(category.completed / category.total * 100) : 0;
    const card = document.createElement("button"); card.className = `category-card${$("#bank-category").value === category.id ? " active" : ""}`;
    card.innerHTML = `<strong>${escapeHtml(category.label)}</strong><p>${escapeHtml(category.description)}</p><div class="category-counts"><span>机经 <b>${category.completed}/${category.total}</b></span></div><div class="category-progress"><i style="width:${progress}%"></i></div><small>点击查看并刷题 · 机经进度 ${progress}%</small>`;
    card.addEventListener("click", async () => { $("#bank-type").value = type; setCategoryOptions(payload.categories, category.id); state.activeCategory = category.id; await loadBank(true); await loadCategories(type); $("#bank-list").scrollIntoView({ behavior: "smooth", block: "start" }); });
    return card;
  }));
  if ($("#bank-type").value === type) setCategoryOptions(payload.categories, $("#bank-category").value);
}

function setCategoryOptions(categories, selected = "all") {
  const first = document.createElement("option"); first.value = "all"; first.textContent = "全部细分考点";
  $("#bank-category").replaceChildren(first, ...categories.map((category) => { const option = document.createElement("option"); option.value = category.id; option.textContent = `${category.label}（${category.total}）`; return option; }));
  $("#bank-category").value = categories.some((item) => item.id === selected) ? selected : "all";
}

function openBankQuestion(question) {
  if (question.answerVerified === false) return;
  openPracticeHub();
  state.type = question.type; state.activeCategory = question.category || null; state.questions = [question]; state.index = 0; state.mode = question.source === "user_imported" ? "authentic" : "bank"; state.continuousNumber = 1;
  if ([...$("#level").options].some((option) => option.value === question.level)) $("#level").value = question.level;
  $("#welcome").hidden = true; $("#production").hidden = true; $("#finished").hidden = true; $("#quiz").hidden = false; $("#practice").classList.remove("empty"); render();
}

async function smartGenerate() {
  const button = $("#smart-generate"); button.disabled = true; let seconds = 0; button.textContent = "已收到 · 正在审校题目 0秒"; const timer = setInterval(() => { seconds++; button.textContent = `正在生成并审校 ${seconds}秒…`; }, 1000);
  try {
    const payload = await api("/api/smart-generation", { method: "POST", body: JSON.stringify({ mode: $("#ai-mode").value, type: $("#ai-type").value, level: $("#ai-level").value, request: $("#ai-request").value }) });
    openBankQuestion(payload.question); state.mode = "ai";
    $("#notice").hidden = false; $("#notice").textContent = `${payload.reason} · 目标考点：${payload.targetSkill || "综合能力"}`;
  } catch (error) {
    showToast(error.message === "AI_KEY_REQUIRED" ? "机经补缺训练需要先配置 DeepSeek 密钥。" : `生成失败：${error.message}`, "error");
  } finally { clearInterval(timer); button.disabled = false; button.textContent = "分析覆盖并生成 ✦"; }
}

async function start(typeOverride, preserveSequence = false) {
  const requestedType = typeof typeOverride === "string" ? typeOverride : state.type;
  if (["writing", "speaking"].includes(requestedType)) return showProduction();
  $("#start").disabled = true; $("#review").disabled = true; $("#start").firstChild.textContent = "正在准备… ";
  try {
    const payload = await api("/api/questions", { method: "POST", body: JSON.stringify({ exam: state.exam, type: requestedType, level: $("#level").value, count: 1, excludeIds: state.recentIds, category: state.activeCategory || "all", useAI: false }) });
    if (!payload.questions.length) { showToast("这一专项暂时没有可练题，请换一个等级或考点。", "error"); return; }
    if (!preserveSequence) state.continuousNumber = 1;
    Object.assign(state, { questions: payload.questions, index: 0, mode: payload.mode, answered: false, sequence: payload.sequence });
    state.recentIds = [...state.recentIds, ...payload.questions.map((question) => question.id)].slice(-12);
    $("#notice").hidden = !payload.notice; $("#notice").textContent = payload.notice;
    $("#welcome").hidden = true; $("#production").hidden = true; $("#finished").hidden = true; $("#quiz").hidden = false; $("#practice").classList.remove("empty"); render();
  } catch (error) { showToast(`暂时无法载入题目：${error.message}`, "error"); }
  finally { $("#start").disabled = false; $("#review").disabled = false; $("#start").firstChild.textContent = "开始练习 "; }
}

let commentKind = "question";
const commentKindInfo = { question: { label: "提问", placeholder: "例如：这一题我先看什么信息来判断？", hint: "把卡住的地方说具体一点，更容易得到有用回复" }, strategy: { label: "解题思路", placeholder: "分享你的判断路径：我先看……再排除……", hint: "建议写出判断顺序，而不只写答案" }, report: { label: "题目纠错", placeholder: "请具体说明题干、选项、答案或解析哪里有问题", hint: "提交后会进入管理员的题目核验队列" } };
function setCommentKind(kind) { commentKind = kind; const info = commentKindInfo[kind] || commentKindInfo.question; document.querySelectorAll("[data-comment-kind]").forEach((button) => button.classList.toggle("active", button.dataset.commentKind === commentKind)); $("#comment-content").placeholder = info.placeholder; $("#comment-hint").textContent = info.hint; }
function commentAvatar(name) { return String(name || "学").trim().slice(0, 1).toLocaleUpperCase(); }
function commentKindLabel(kind) { return commentKindInfo[kind]?.label || "讨论"; }
function reportLabel(status) { return ({ pending: "待核验", reviewing: "核验中", resolved: "已处理" })[status] || "待核验"; }
async function loadQuestionComments() {
  const question = state.questions[state.index]; if (!question) return;
  const list = $("#comment-list"); const questionId = question.id; list.innerHTML = "<p>正在加载讨论…</p>";
  try {
    const payload = await api(`/api/comments/${encodeURIComponent(questionId)}`);
    if (state.questions[state.index]?.id !== questionId) return;
    const pendingReports = payload.comments.filter((comment) => comment.kind === "report" && comment.reportStatus !== "resolved").length;
    $("#comment-count").textContent = payload.comments.length ? `${payload.comments.length}条${pendingReports ? ` · ${pendingReports}待核验` : ""}` : "抢先讨论";
    list.innerHTML = payload.comments.length ? payload.comments.map((comment) => `<article class="comment-item ${escapeHtml(comment.kind || "question")} ${comment.author.role === "admin" ? "admin" : ""}"><div class="comment-author"><span class="comment-avatar">${escapeHtml(commentAvatar(comment.author.name))}</span><div class="comment-meta"><strong>${escapeHtml(comment.author.name)}</strong>${comment.author.role === "admin" ? '<span class="comment-admin">管理员</span>' : ""}<span class="comment-kind ${escapeHtml(comment.kind || "question")}">${commentKindLabel(comment.kind)}</span>${comment.kind === "report" ? `<span class="comment-report-status">${reportLabel(comment.reportStatus)}</span>` : ""}<time>${new Date(comment.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div></div><p>${escapeHtml(comment.content)}</p><div class="comment-footer"><span>${comment.kind === "report" ? "管理员会核验并更新状态" : "欢迎补充你的判断依据"}</span>${comment.canDelete ? `<button class="comment-delete" data-comment-id="${escapeHtml(comment.id)}">删除</button>` : ""}</div></article>`).join("") : "<p>还没有讨论。第一个提出具体问题的人，通常收获最多。</p>";
  } catch (error) { list.innerHTML = `<p>讨论加载失败：${escapeHtml(error.message)}</p>`; }
}

async function submitQuestionComment(event) {
  event.preventDefault(); const question = state.questions[state.index]; const content = $("#comment-content").value.trim(); if (!question || !content) return;
  const button = $("#comment-form button"); button.disabled = true; button.textContent = "正在发表…"; $("#comment-hint").textContent = "正在提交";
  try { await api(`/api/comments/${encodeURIComponent(question.id)}`, { method: "POST", body: JSON.stringify({ content, kind: commentKind }) }); $("#comment-content").value = ""; $("#comment-hint").textContent = commentKind === "report" ? "已提交核验" : "已发布"; await loadQuestionComments(); }
  catch (error) { $("#comment-hint").textContent = error.message; }
  finally { button.disabled = false; button.textContent = "发表评论"; }
}

function render() {
  const question = state.questions[state.index]; state.answered = false; state.submitting = false; $("#practice-hub").classList.add("is-answering"); $("#practice-hub").classList.remove("show-settings");
  $("#selection-tools").hidden = true;
  $("#counter").textContent = state.sequence?.total ? `连续第 ${state.continuousNumber} 题 · 当前范围已完成 ${state.sequence.completed}/${state.sequence.total}` : `第 ${state.continuousNumber} 题 · 作答后立即解析`;
  const currentSource = question.source === "user_imported" ? "authentic" : question.source === "mock" ? "mock" : question.source?.startsWith("ai") ? "ai" : state.mode;
  $("#source").textContent = currentSource === "review" ? "错题复习" : currentSource === "ai" ? "AI 补缺题" : "已审机经";
  const progressPercent = state.sequence?.total ? Math.min(100, ((state.sequence.completed + 1) / state.sequence.total) * 100) : 100;
  $("#progress").style.width = `${progressPercent}%`; $("#progress").parentElement.setAttribute("aria-label", `当前范围进度 ${Math.round(progressPercent)}%`); $("#topic").textContent = `${question.level} · ${question.topic}`; $("#question-status").textContent = "请选择答案";
  $("#answer-shortcuts").textContent = "快捷键：1–4 或 A–D 选择答案";
  $("#passage").hidden = !question.passage; $("#passage").textContent = question.passage || ""; $("#prompt").textContent = question.prompt;
  $("#feedback").hidden = true; $("#answer-actions").hidden = true; $("#question-tools").hidden = true; $("#toggle-question-tools").setAttribute("aria-expanded", "false"); $("#toggle-question-tools b").textContent = "⌄";
  $("#comment-content").value = ""; setCommentKind("question"); $("#question-comments").hidden = true; $(".comment-body").hidden = true; $("#toggle-comments b").textContent = "展开"; $("#comment-count").textContent = "按需查看";
  $("#options").replaceChildren(...question.options.map((option, index) => { const button = document.createElement("button"); const letter = String.fromCharCode(65 + index); const marker = document.createElement("span"); marker.textContent = letter; button.append(marker, document.createTextNode(option)); button.setAttribute("aria-label", `${letter}，${option}`); button.title = `快捷键 ${index + 1} 或 ${letter}`; button.addEventListener("click", () => answer(index, button)); return button; }));
  $("#next").firstChild.textContent = currentSource === "review" ? "直接练下一道错题 " : "直接练下一道机经 ";
  savePreferences(); savePracticeSession();
  revealPractice({ smooth: state.continuousNumber > 1 });
}

async function answer(selected, selectedButton) {
  if (state.answered || state.submitting) return; state.submitting = true;
  const buttons = [...$("#options").children]; buttons.forEach((button) => button.disabled = true); $("#options").setAttribute("aria-busy", "true");
  selectedButton.classList.add("checking");
  $("#question-status").textContent = `已选择 ${String.fromCharCode(65 + selected)}，正在核对`;
  $("#feedback").className = "feedback-loading"; $("#feedback").innerHTML = `<div class="answer-loading"><i></i><div><strong>已收到你的答案：${String.fromCharCode(65 + selected)}</strong><p>正在核对正确答案…</p></div></div>`; $("#feedback").hidden = false;
  try {
    const result = await api("/api/check-answer", { method: "POST", body: JSON.stringify({ questionId: state.questions[state.index].id, selected }) });
    const answeredQuestion = state.questions[state.index]; const answeredQuestionId = answeredQuestion.id;
    state.answered = true; clearPracticeSession(); selectedButton.classList.remove("checking"); buttons[result.answer].classList.add("correct");
    if (!result.correct) { selectedButton.classList.add("wrong"); state.mistakes.push(state.questions[state.index].skill); } else state.score++;
    buttons.forEach((button, index) => {
      if (index === result.answer) button.setAttribute("aria-label", `${button.textContent.trim()}，正确答案`);
      else if (index === selected && !result.correct) button.setAttribute("aria-label", `${button.textContent.trim()}，你的选择，不正确`);
    });
    $("#question-status").textContent = result.correct ? "回答正确 · 可直接进入下一题" : `回答错误 · 正确答案是 ${String.fromCharCode(65 + result.answer)}`;
    $("#answer-shortcuts").textContent = "快捷键：Enter 或空格进入下一题";
    if (state.sequence && state.questions[state.index].source === "user_imported") { state.sequence.completed = Math.min(state.sequence.total, state.sequence.completed + 1); state.sequence.remaining = Math.max(0, state.sequence.total - state.sequence.completed); $("#counter").textContent = `连续第 ${state.continuousNumber} 题 · 当前范围已完成 ${state.sequence.completed}/${state.sequence.total}`; }
    $("#feedback").className = result.correct ? "good feedback-rich" : "bad feedback-rich";
    const correctOption = answeredQuestion.options[result.answer]; const completedSentence = answeredQuestion.prompt.replace(/_+|…+|\.{3,}/, correctOption);
    $("#feedback").innerHTML = `<div class="feedback-title"><strong>${result.correct ? "✓ 回答正确" : "✕ 回答错误"}</strong><span>正确答案 · ${String.fromCharCode(65 + result.answer)}</span></div><section class="instant-answer"><b>${escapeHtml(correctOption)}</b><p>${escapeHtml(completedSentence)}</p></section><section id="analysis-pending" class="analysis-pending"><div class="answer-loading"><i></i><div><strong>详细中文解析正在准备</strong><p>会说明判断顺序，并逐项解释每个选项。你无需等待，可随时练下一题。</p></div></div></section>`;
    $("#feedback").hidden = false; $("#answer-actions").hidden = false; $("#question-comments").hidden = false;
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 700px)").matches) $("#feedback").scrollIntoView({ behavior: "smooth", block: "start" });
      $("#next").focus({ preventScroll: true });
    });
    const savedAttempt = await api("/api/attempts", { method: "POST", body: JSON.stringify({ questionId: answeredQuestionId, selected, exam: state.exam }) });
    const loadDetailedAnalysis = async () => {
      const pending = $("#analysis-pending");
      if (!pending || state.questions[state.index]?.id !== answeredQuestionId || !state.answered) return;
      pending.className = "analysis-pending";
      pending.innerHTML = `<div class="answer-loading"><i></i><div><strong>正在生成新版详细解析</strong><p>将说明决定性规则，并逐项解释每个选项；你现在可以直接练下一题。</p></div></div>`;
      try {
        const payload = await api("/api/attempt-analysis", { method: "POST", body: JSON.stringify({ attemptId: savedAttempt.attemptId, questionId: answeredQuestionId }) });
        if (state.questions[state.index]?.id !== answeredQuestionId || !state.answered) return;
        const analysis = payload.analysis; const current = $("#analysis-pending"); if (!current) return;
        current.className = "detailed-analysis"; current.innerHTML = `<details open><summary>详细中文解析</summary><p>${escapeHtml(analysis.detailedZh)}</p></details>`;
        $("#ask-lili-analysis")?.remove();
        const ask = document.createElement("button"); ask.id = "ask-lili-analysis"; ask.className = "ask-lili-analysis"; ask.innerHTML = "<span>lili</span><strong>还有哪里没看懂？继续问这道题</strong><small>自动带上题目、你的答案和当前解析</small>"; ask.addEventListener("click", () => askLiliAboutAttempt(selected, result, analysis)); $("#feedback").append(ask);
        if (!result.correct) loadJournal();
      } catch (error) {
        const current = $("#analysis-pending");
        if (!current || state.questions[state.index]?.id !== answeredQuestionId) return;
        current.className = "analysis-pending analysis-error";
        current.innerHTML = `<p>详细解析暂时没有生成成功：${escapeHtml(error.message)}</p><button type="button" class="retry-analysis">重新生成详细解析</button>`;
        current.querySelector(".retry-analysis").addEventListener("click", loadDetailedAnalysis, { once: true });
      }
    };
    Promise.all([refreshStats(), loadActivity(), loadInsights(), loadBank(), loadCategories()]).catch(() => {});
    loadDetailedAnalysis();
  } catch (error) {
    selectedButton.classList.remove("checking"); $("#feedback").hidden = true; buttons.forEach((button) => button.disabled = false); showToast(`提交失败，请重试：${error.message}`, "error");
  } finally { state.submitting = false; $("#options").removeAttribute("aria-busy"); }
}

async function variation() {
  const button = $("#variation"); button.disabled = true; button.textContent = "正在生成…";
  try {
    const payload = await api("/api/variations", { method: "POST", body: JSON.stringify({ questionId: state.questions[state.index].id, request: $("#variation-request").value }) });
    state.questions = [payload.question]; state.index = 0; state.mode = "ai"; state.continuousNumber++; render();
  } catch (error) {
    showToast(error.message === "AI_KEY_REQUIRED" ? "举一反三需要先配置 DeepSeek 密钥。" : `生成失败：${error.message}`, "error");
  } finally { button.disabled = false; button.textContent = "生成变式题 ✦"; }
}

async function next() {
  if (state.submitting || $("#next").disabled) return;
  const button = $("#next"); const previous = button.innerHTML; button.disabled = true; button.innerHTML = "正在载入下一题…";
  state.continuousNumber++;
  let loaded = false;
  try { await start(state.mode === "review" ? "review" : state.type, true); loaded = true; }
  finally { button.disabled = false; if (!loaded && button.isConnected && !button.hidden) button.innerHTML = previous; }
}

function showProduction() {
  $("#practice-hub").classList.remove("is-answering", "show-settings");
  const tasks = productionTasks[state.exam][state.productionType]; const task = tasks[Math.floor(Math.random() * tasks.length)];
  $("#welcome").hidden = true; $("#quiz").hidden = true; $("#finished").hidden = true; $("#production").hidden = false; $("#practice").classList.remove("empty");
  $("#production-exam").textContent = `${state.exam.toUpperCase()} · ${state.productionType === "writing" ? "表达写作" : "口语表达"}`; $("#production-format").textContent = task[0];
  $("#production-topic").textContent = $("#level").value; $("#production-prompt").textContent = task[1]; $("#production-guidance").textContent = task[2];
  $("#production-answer").hidden = state.productionType === "speaking"; $("#production-answer").value = ""; $("#word-count").textContent = state.productionType === "writing" ? "0 mots" : "请计时录音练习";
}

function openTutor() { $("#tutor-drawer").hidden = false; $("#open-tutor").hidden = true; $("#tutor-question").focus(); }
function closeTutor() { $("#tutor-drawer").hidden = true; $("#open-tutor").hidden = false; }
function askLiliAboutAttempt(selectedIndex, result, analysis) {
  const question = state.questions[state.index]; const selectedAnswer = question.options[selectedIndex] || "未记录"; const correct = question.options[result.answer] || "未记录";
  openTutor(); askTutor(`我没有完全看懂这道题的解析，请结合原句逐步讲清楚，并说明判断顺序和每个干扰项为什么不对。\n\n题目：${question.prompt}\n我的答案：${selectedAnswer}\n正确答案：${correct}\n当前详细中文解析：${analysis.detailedZh || analysis.explanationZh}`);
}
function appendTutorMessage(role, content) { const message = document.createElement("div"); message.className = `tutor-message ${role}`; if (role === "assistant") renderTutorRichText(message, content); else message.textContent = content; $("#tutor-messages").append(message); $("#tutor-messages").scrollTop = $("#tutor-messages").scrollHeight; return message; }
async function askTutor(question) {
  const text = String(question || "").trim(); if (!text) return; const button = $("#tutor-form button"); appendTutorMessage("user", text); $("#tutor-question").value = ""; button.disabled = true; button.textContent = "已收到";
  let seconds = 0; const waiting = appendTutorMessage("assistant", "lili已收到，正在思考 0秒…"); waiting.classList.add("waiting"); const timer = setInterval(() => { seconds++; waiting.textContent = `lili正在结合当前题目回答 ${seconds}秒…`; }, 1000);
  try { const payload = await api("/api/tutor/ask", { method: "POST", body: JSON.stringify({ question: text, questionId: state.questions[state.index]?.id || null, history: tutorHistory }) }); tutorHistory.push({ role: "user", content: text }, { role: "assistant", content: payload.answer }); tutorHistory = tutorHistory.slice(-10); renderTutorRichText(waiting, payload.answer); waiting.classList.remove("waiting"); const label = payload.provider === "deepseek" ? "DeepSeek" : payload.provider === "openai" ? "OpenAI" : "本地知识库"; $("#tutor-mode").textContent = payload.mode === "ai" ? `${label} 已连接 · 保留本轮上下文` : "本地知识库 · 配置密钥后支持任意问题"; await loadJournal(); }
  catch (error) { waiting.textContent = `暂时无法回答：${error.message}`; waiting.classList.remove("waiting"); }
  finally { clearInterval(timer); button.disabled = false; button.textContent = "发送 →"; $("#tutor-question").focus(); }
}

$("#start").addEventListener("click", () => start()); $("#review").addEventListener("click", () => start("review")); $("#again").addEventListener("click", () => start()); $("#next").addEventListener("click", next); $("#variation").addEventListener("click", variation); $("#new-production").addEventListener("click", showProduction);
$("#production-answer").addEventListener("input", (event) => { const words = event.target.value.trim().split(/\s+/).filter(Boolean).length; $("#word-count").textContent = `${words} mots`; });
$("#toggle-practice-settings").addEventListener("click", () => { const hub = $("#practice-hub"); hub.classList.toggle("show-settings"); $("#toggle-practice-settings").textContent = hub.classList.contains("show-settings") ? "收起训练设置" : "调整训练设置"; });
$("#toggle-question-tools").addEventListener("click", () => { const tools = $("#question-tools"); tools.hidden = !tools.hidden; $("#toggle-question-tools").setAttribute("aria-expanded", String(!tools.hidden)); $("#toggle-question-tools b").textContent = tools.hidden ? "⌄" : "⌃"; });
$("#level").addEventListener("change", savePreferences);
$("#refresh-knowledge").addEventListener("click", refreshKnowledge); $("#open-knowledge").addEventListener("click", () => openKnowledge()); $("#close-knowledge").addEventListener("click", closeKnowledge); $("#knowledge-form").addEventListener("submit", askKnowledge); $("#knowledge-practice").addEventListener("click", knowledgePractice);
$("#open-notebook").addEventListener("click", openNotebook); $("#close-notebook").addEventListener("click", closeNotebook);
$("#open-journal").addEventListener("click", openJournal); $("#close-journal").addEventListener("click", closeJournal);
$("#open-mistakes").addEventListener("click", openMistakes); $("#close-mistakes").addEventListener("click", closeMistakes);
$("#open-history").addEventListener("click", openHistory); $("#close-history").addEventListener("click", closeHistory);
$("#open-practice-hub").addEventListener("click", () => { const saved = readPracticeSession(); if (saved) resumePractice(saved); else openPracticeHub(); }); $("#close-practice-hub").addEventListener("click", closePracticeHub);
$("#open-ai-shortcut").addEventListener("click", () => activateWorkspace("ai-center"));
$("#today-start").addEventListener("click", () => { openPracticeHub(); start($("#today-start").dataset.action === "review" ? "review" : undefined); });
document.querySelectorAll("[data-workspace-view]").forEach((item) => item.addEventListener("click", (event) => { event.preventDefault(); activateWorkspace(item.dataset.workspaceView); }));
window.addEventListener("hashchange", () => activateWorkspace(location.hash.slice(1), { updateHash: false }));
for (const selector of ["#history-type", "#history-result", "#history-source", "#history-level"]) $(selector).addEventListener("change", loadHistory);
document.querySelectorAll("[data-journal-filter]").forEach((button) => button.addEventListener("click", () => { journalFilter = button.dataset.journalFilter; document.querySelectorAll("[data-journal-filter]").forEach((item) => item.classList.toggle("active", item === button)); renderJournal(); }));
$("#lookup-selection").addEventListener("click", () => selectedVocabulary && lookupWord(selectedVocabulary.word, selectedVocabulary.context));
$("#save-selection").addEventListener("click", saveSelectedWord);
document.addEventListener("mouseup", (event) => { if (event.button === 0) setTimeout(captureVocabularySelection, 0); });
document.addEventListener("contextmenu", (event) => {
  if (event.target.closest("input, textarea, select, [contenteditable=true]")) return;
  const selection = window.getSelection(); const selected = selection?.toString().trim(); let shown = false;
  if (selected && selection.rangeCount && selection.anchorNode?.parentElement?.contains(event.target)) shown = showVocabularyTools({ word: selected, range: selection.getRangeAt(0), element: selection.anchorNode.parentElement }, { x: event.clientX, y: event.clientY });
  if (!shown) { const found = frenchWordAtPoint(event.clientX, event.clientY) || firstFrenchWordIn(event.target); if (found) { selection.removeAllRanges(); selection.addRange(found.range); shown = showVocabularyTools(found, { x: event.clientX, y: event.clientY }); } }
  if (shown) event.preventDefault();
});
document.addEventListener("click", (event) => {
  if (event.target.closest("#options button") && window.getSelection()?.toString().trim()) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
$("#smart-generate").addEventListener("click", smartGenerate);
$("#comment-form").addEventListener("submit", submitQuestionComment); $("#refresh-comments").addEventListener("click", loadQuestionComments);
document.querySelectorAll("[data-comment-kind]").forEach((button) => button.addEventListener("click", () => setCommentKind(button.dataset.commentKind)));
$("#toggle-comments").addEventListener("click", async () => { const body = $(".comment-body"); body.hidden = !body.hidden; $("#toggle-comments b").textContent = body.hidden ? "展开" : "收起"; if (!body.hidden && $("#comment-count").textContent === "按需查看") await loadQuestionComments(); });
$("#comment-list").addEventListener("click", async (event) => { const button = event.target.closest("[data-comment-id]"); if (!button || !confirm("确定删除这条评论吗？")) return; button.disabled = true; try { await api("/api/comments", { method: "DELETE", body: JSON.stringify({ commentId: button.dataset.commentId }) }); await loadQuestionComments(); } catch (error) { showToast(error.message, "error"); button.disabled = false; } });
$("#open-tutor").addEventListener("click", openTutor); $("#close-tutor").addEventListener("click", closeTutor); $("#tutor-form").addEventListener("submit", (event) => { event.preventDefault(); askTutor($("#tutor-question").value); });
document.querySelectorAll(".tutor-starters button").forEach((button) => button.addEventListener("click", () => askTutor(button.textContent)));
for (const selector of ["#bank-level", "#bank-status", "#bank-category", "#bank-answer-status"]) $(selector).addEventListener("change", () => { state.activeCategory = $("#bank-category").value === "all" ? null : $("#bank-category").value; savePreferences(); loadBank(true); });
$("#bank-source").addEventListener("change", () => { state.activeCategory = null; $("#bank-category").value = "all"; loadBank(true); loadCategories($("#category-type").value); });
$("#bank-search").addEventListener("input", () => { clearTimeout(bankSearchTimer); bankSearchTimer = setTimeout(() => loadBank(true), 250); });
$("#bank-load-more").addEventListener("click", () => loadBank(false));
$("#clear-bank-filters").addEventListener("click", async () => { $("#bank-search").value = ""; $("#bank-type").value = "all"; $("#bank-level").value = "all"; $("#bank-status").value = "all"; state.activeCategory = null; $("#category-type").value = "grammar"; await loadCategories("grammar"); $("#bank-category").value = "all"; savePreferences(); await loadBank(true); showToast("已恢复全部机经", "info"); });
$("#bank-list").addEventListener("scroll", (event) => { if (bankHasMore && event.currentTarget.scrollTop + event.currentTarget.clientHeight >= event.currentTarget.scrollHeight - 180) loadBank(false); });
$("#category-type").addEventListener("change", (event) => loadCategories(event.target.value));
$("#bank-type").addEventListener("change", async (event) => { state.activeCategory = null; savePreferences(); $("#category-type").value = event.target.value === "all" ? "grammar" : event.target.value; await loadCategories($("#category-type").value); await loadBank(true); });
document.addEventListener("keydown", (event) => { const editing = event.target.closest?.("input, textarea, select, [contenteditable=true]"); if (event.key === "Escape" && !editing) { closePracticeHub(); closeHistory(); closeJournal(); closeMistakes(); closeTutor(); closeNotebook(); return; } if (editing || $("#quiz").hidden || $("#practice-hub").hidden) return; const key = event.key.toUpperCase(); const optionIndex = ["1", "2", "3", "4"].includes(key) ? Number(key) - 1 : ["A", "B", "C", "D"].indexOf(key); if (!state.answered && optionIndex >= 0) { const button = $("#options").children[optionIndex]; if (button) { event.preventDefault(); button.click(); } } else if (state.answered && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); next(); } });
function updateNetworkStatus() { $("#network-status").hidden = navigator.onLine; if (navigator.onLine) showToast("网络已恢复，可以继续练习", "success"); }
window.addEventListener("offline", updateNetworkStatus); window.addEventListener("online", updateNetworkStatus);

let appInitialized = false;
async function initializeApp() {
  if (appInitialized) return; appInitialized = true;
  let savedWorkspace = "exam-center"; try { savedWorkspace = localStorage.getItem(userStorageKey("workspace")) || savedWorkspace; } catch {}
  restorePreferences(); renderCatalog(); prepareResume(); activateWorkspace(location.hash.slice(1) || savedWorkspace, { updateHash: false });
  const healthPromise = api("/api/health").then((health) => {
    const label = health.aiProvider === "deepseek" ? "DeepSeek" : health.aiProvider === "openai" ? "OpenAI" : "本地题库";
    $("#ai-status").textContent = health.aiEnabled ? `● ${label} 已连接` : "● 机经可用 · AI未连接";
    $("#tutor-mode").textContent = health.aiEnabled ? `${label} 已连接 · 可以连续追问` : "本地知识库 · 可回答常见考点";
    $("#ai-status").classList.add("ready");
  }).catch(() => { $("#ai-status").textContent = "机经可用 · AI暂时离线"; $("#ai-status").classList.remove("ready"); });
  const jobs = [refreshStats(), loadActivity(), loadInsights(), loadCategories().then(loadBank), loadNotebook(), loadKnowledgeTopics(), loadJournal()];
  const results = await Promise.allSettled(jobs); await healthPromise;
  const failures = results.filter((result) => result.status === "rejected").length;
  if (failures) showToast(`${failures}项个人数据暂未同步，机经刷题仍可继续。`, "warning");
}
window.addEventListener("lumi:auth-ready", initializeApp, { once: true });
window.addEventListener("lumi:toast", (event) => showToast(event.detail?.message || "操作失败", event.detail?.tone || "info"));
if (window.__LUMI_AUTH__?.ready) initializeApp();
