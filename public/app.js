const state = { type: "grammar", questions: [], index: 0, score: 0, mode: "bank", answered: false };
const $ = (selector) => document.querySelector(selector);

document.querySelectorAll("[data-type]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-type]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.type = button.dataset.type;
}));

async function api(path, options) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json" } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "请求失败");
  return payload;
}

async function refreshStats() {
  const stats = await api("/api/stats");
  $("#accuracy").textContent = `${stats.accuracy}%`;
  $("#total").textContent = stats.total;
  $("#wrong").textContent = stats.wrongCount;
}

async function start() {
  $("#start").disabled = true;
  $("#start").firstChild.textContent = "正在准备… ";
  try {
    const payload = await api("/api/questions", {
      method: "POST",
      body: JSON.stringify({ type: state.type, level: $("#level").value, count: Number($("#count").value) })
    });
    Object.assign(state, { questions: payload.questions, index: 0, score: 0, mode: payload.mode, answered: false });
    $("#welcome").hidden = true; $("#finished").hidden = true; $("#quiz").hidden = false;
    $("#practice").classList.remove("empty");
    render();
  } catch (error) { alert(`暂时无法生成题目：${error.message}`); }
  finally { $("#start").disabled = false; $("#start").firstChild.textContent = "开始新训练 "; }
}

function render() {
  const question = state.questions[state.index];
  state.answered = false;
  $("#counter").textContent = `${String(state.index + 1).padStart(2, "0")} / ${String(state.questions.length).padStart(2, "0")}`;
  $("#source").textContent = state.mode === "ai" ? "AI 动态生成" : "精选题库";
  $("#progress").style.width = `${((state.index + 1) / state.questions.length) * 100}%`;
  $("#topic").textContent = `${question.level} · ${question.topic}`;
  $("#prompt").textContent = question.prompt;
  $("#feedback").hidden = true; $("#next").hidden = true;
  $("#options").replaceChildren(...question.options.map((option, index) => {
    const button = document.createElement("button");
    button.innerHTML = `<span>${String.fromCharCode(65 + index)}</span>${option}`;
    button.addEventListener("click", () => answer(index, button));
    return button;
  }));
}

async function answer(selected, selectedButton) {
  if (state.answered) return;
  state.answered = true;
  const result = await api("/api/attempts", { method: "POST", body: JSON.stringify({ questionId: state.questions[state.index].id, selected }) });
  const buttons = [...$("#options").children];
  buttons.forEach((button) => button.disabled = true);
  buttons[result.answer].classList.add("correct");
  if (!result.correct) selectedButton.classList.add("wrong");
  else state.score++;
  $("#feedback").className = result.correct ? "good" : "bad";
  $("#feedback").innerHTML = `<strong>${result.correct ? "正确 · Bravo !" : "再看一步"}</strong><p>${result.explanation}</p>`;
  $("#feedback").hidden = false; $("#next").hidden = false;
  await refreshStats();
}

function next() {
  if (state.index < state.questions.length - 1) { state.index++; render(); return; }
  $("#quiz").hidden = true; $("#finished").hidden = false;
  $("#result").textContent = `答对 ${state.score} / ${state.questions.length} 题。你的错题已进入薄弱点记录。`;
}

$("#start").addEventListener("click", start);
$("#again").addEventListener("click", start);
$("#next").addEventListener("click", next);

Promise.all([api("/api/health"), refreshStats()]).then(([health]) => {
  $("#ai-status").textContent = health.aiEnabled ? "● AI 已连接" : "● 本地题库模式";
  $("#ai-status").classList.add("ready");
}).catch(() => { $("#ai-status").textContent = "连接失败"; });
