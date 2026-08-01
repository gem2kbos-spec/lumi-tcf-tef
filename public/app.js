const state = { type: "grammar", questions: [], index: 0, score: 0, mode: "bank", answered: false, mistakes: [] };
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
  $("#streak").textContent = stats.streak;
  $("#review-count").textContent = stats.pendingReview;
  const weak = stats.weakSkills.slice(0, 3);
  $("#weak-card").hidden = weak.length === 0;
  $("#weak-skills").replaceChildren(...weak.map((item) => {
    const row = document.createElement("div");
    row.innerHTML = `<span>${item.skill.replaceAll("_", " ")}</span><b>${item.count}</b>`;
    return row;
  }));
}

async function start(typeOverride) {
  const requestedType = typeof typeOverride === "string" ? typeOverride : state.type;
  $("#start").disabled = true;
  $("#review").disabled = true;
  $("#start").firstChild.textContent = "正在准备… ";
  try {
    const payload = await api("/api/questions", {
      method: "POST",
      body: JSON.stringify({ type: requestedType, level: $("#level").value, count: Number($("#count").value) })
    });
    if (!payload.questions.length) {
      alert("目前还没有错题。先完成一组训练，再回来复习吧。");
      return;
    }
    Object.assign(state, { questions: payload.questions, index: 0, score: 0, mode: payload.mode, answered: false, mistakes: [] });
    $("#notice").hidden = !payload.notice; $("#notice").textContent = payload.notice;
    $("#welcome").hidden = true; $("#finished").hidden = true; $("#quiz").hidden = false;
    $("#practice").classList.remove("empty");
    render();
  } catch (error) { alert(`暂时无法生成题目：${error.message}`); }
  finally { $("#start").disabled = false; $("#review").disabled = false; $("#start").firstChild.textContent = "开始新训练 "; }
}

function render() {
  const question = state.questions[state.index];
  state.answered = false;
  $("#counter").textContent = `${String(state.index + 1).padStart(2, "0")} / ${String(state.questions.length).padStart(2, "0")}`;
  $("#source").textContent = state.mode === "ai" ? "AI 动态生成" : state.mode === "review" ? "错题复习" : "精选题库";
  $("#progress").style.width = `${((state.index + 1) / state.questions.length) * 100}%`;
  $("#topic").textContent = `${question.level} · ${question.topic}`;
  $("#prompt").textContent = question.prompt;
  $("#feedback").hidden = true; $("#next").hidden = true;
  $("#options").replaceChildren(...question.options.map((option, index) => {
    const button = document.createElement("button");
    button.innerHTML = `<span>${String.fromCharCode(65 + index)}</span>${option}`;
    button.setAttribute("aria-label", `${String.fromCharCode(65 + index)}，${option}`);
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
  if (!result.correct) { selectedButton.classList.add("wrong"); state.mistakes.push(state.questions[state.index].skill); }
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
  const accuracy = Math.round(state.score / state.questions.length * 100);
  const message = accuracy === 100 ? "Excellent！这一组全部掌握。" : accuracy >= 70 ? "Très bien！再复习错题就更稳了。" : "保持节奏，薄弱点正在变得清晰。";
  $("#session-summary").innerHTML = `<strong>${accuracy}%</strong><span>${message}</span>`;
}

$("#start").addEventListener("click", () => start());
$("#review").addEventListener("click", () => start("review"));
$("#again").addEventListener("click", () => start());
$("#next").addEventListener("click", next);
document.addEventListener("keydown", (event) => {
  if ($("#quiz").hidden) return;
  if (!state.answered && ["1", "2", "3", "4"].includes(event.key)) {
    const button = $("#options").children[Number(event.key) - 1];
    if (button) button.click();
  } else if (state.answered && (event.key === "Enter" || event.key === " ")) next();
});

Promise.all([api("/api/health"), refreshStats()]).then(([health]) => {
  $("#ai-status").textContent = health.aiEnabled ? "● AI 已连接" : "● 本地题库模式";
  $("#ai-status").classList.add("ready");
}).catch(() => { $("#ai-status").textContent = "连接失败"; });
