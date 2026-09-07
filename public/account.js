const $a = (selector) => document.querySelector(selector);
let registerMode = false; let currentUser = null; let selectedPlan = "quarter"; let selectedPaymentMethod = "wechat"; let membershipData = null;
let adminData = null; let membershipTimer = null;
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
async function request(path, options = {}) { const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } }); const payload = await response.json().catch(() => ({ error: "服务器返回了无法识别的内容" })); if (!response.ok) { const error = new Error(payload.error || "请求失败"); error.status = response.status; throw error; } return payload; }
function setAppAccess(ready, user = null) {
  window.__LUMI_AUTH__ = { ready, user };
  document.body.classList.toggle("app-booting", !ready);
  document.querySelector("main")?.toggleAttribute("inert", !ready);
  document.querySelector(".study-tools")?.toggleAttribute("inert", !ready);
  if (ready) window.dispatchEvent(new CustomEvent("lumi:auth-ready", { detail: { user } }));
}
function showAuth() { setAppAccess(false); $a("#account-gate").hidden = false; }
function switchMode(next) { registerMode = next; $a("#show-login").classList.toggle("active", !next); $a("#show-register").classList.toggle("active", next); $a("#name-field").hidden = !next; $a("#account-name").required = next; $a("#account-password").autocomplete = next ? "new-password" : "current-password"; $a("#account-submit").textContent = next ? "注册账号" : "登录并进入"; $a("#account-error").textContent = ""; }
function membershipText(user) { if (user.hasAccess) return user.membershipExpiresAt ? `有效期至 ${new Date(user.membershipExpiresAt).toLocaleDateString("zh-CN")}` : "管理员账号"; return ({ pending: "等待开通", suspended: "权限已暂停", expired: "权限已到期" })[user.membershipStatus] || "尚未开通"; }
async function loadMembership() {
  const data = await request("/api/membership"); membershipData = data; const list = $a("#plan-list");
  list.replaceChildren(...data.plans.map((plan) => { const button = document.createElement("button"); button.type = "button"; button.className = `plan-option${plan.id === selectedPlan ? " active" : ""}`; button.setAttribute("aria-pressed", String(plan.id === selectedPlan)); button.innerHTML = `<span>${safe(plan.name)}</span><strong>¥${plan.priceCny}</strong><small>约 ¥${(plan.priceCny / plan.days).toFixed(2)} / 天</small>`; button.onclick = () => { selectedPlan = plan.id; renderPaymentSelection(); }; return button; }));
  renderPaymentSelection();
  const submit = $a("#submit-order");
  if (data.user.hasAccess) { clearInterval(membershipTimer); location.reload(); return; }
  const orders = data.orders; const latest = orders[0]; const pending = latest?.status === "pending";
  $a("#order-status").innerHTML = latest ? `<div class="order-status-card ${safe(latest.status)}"><span>${pending ? "审核中" : latest.status === "confirmed" ? "已开通" : "未通过"}</span><div><strong>${pending ? "付款信息已提交，请等待管理员确认" : latest.status === "confirmed" ? "订单已确认，正在进入训练" : "订单未通过，请核对信息后重新提交"}</strong><small>${safe(latest.id)} · ¥${Number(latest.amountCny) || 0} · ${latest.paymentMethod === "alipay" ? "支付宝" : "微信支付"}</small></div></div>` : "";
  if (pending) { submit.disabled = true; submit.textContent = "付款信息已提交"; }
}
function renderPaymentSelection() {
  if (!membershipData) return;
  const plan = membershipData.plans.find((item) => item.id === selectedPlan) || membershipData.plans[0];
  $a("#payment-amount").textContent = `¥${plan?.priceCny || 0}`;
  $a("#plan-list").querySelectorAll(".plan-option").forEach((button, index) => { const active = membershipData.plans[index]?.id === selectedPlan; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); });
  $a("#payment-methods").querySelectorAll("button").forEach((button) => { const active = button.dataset.paymentMethod === selectedPaymentMethod; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); });
  const methodName = selectedPaymentMethod === "alipay" ? "支付宝" : "微信支付";
  const url = membershipData.paymentMethods?.[selectedPaymentMethod] || ""; const valid = /^(?:https?:\/\/|\/)\S+$/i.test(url);
  $a("#payment-method-name").textContent = methodName;
  $a(".payment-instructions li:nth-child(2)").textContent = `使用${methodName}扫一扫完成付款`;
  $a("#payment-note").placeholder = `例如：${methodName}昵称 + 手机尾号 1234`;
  $a("#payment-qr").innerHTML = valid ? `<img src="${safe(url)}" alt="${methodName}收款二维码">` : "收款码暂不可用";
  const openLink = $a("#open-payment-qr"); openLink.hidden = !valid; if (valid) openLink.href = url;
  const pending = membershipData.orders?.[0]?.status === "pending"; $a("#submit-order").disabled = !valid || pending;
}
$a("#payment-methods").onclick = (event) => { const button = event.target.closest("button[data-payment-method]"); if (!button) return; selectedPaymentMethod = button.dataset.paymentMethod; renderPaymentSelection(); };
async function initialize() { try { const { user, aiUsage } = await request("/api/auth/me"); currentUser = user; $a("#account-profile").textContent = `${user.name} · ${membershipText(user)}${aiUsage ? ` · AI剩余${aiUsage.remaining}` : ""}`; if (user.role === "admin") $a("#open-admin").hidden = false; if (!user.hasAccess) { setAppAccess(false, user); $a("#membership-gate").hidden = false; await loadMembership(); membershipTimer = setInterval(() => loadMembership().catch(() => {}), 15000); return; } setAppAccess(true, user); } catch (error) { showAuth(); if (error.status !== 401) $a("#account-error").textContent = "服务器暂时没有响应，请稍后刷新；这不是账号或密码错误。"; } }
$a("#show-login").onclick = () => switchMode(false); $a("#show-register").onclick = () => switchMode(true);
$a("#account-form").onsubmit = async (event) => { event.preventDefault(); const button = $a("#account-submit"); button.disabled = true; button.textContent = registerMode ? "正在创建账号…" : "正在登录…"; try { await request(registerMode ? "/api/auth/register" : "/api/auth/login", { method: "POST", body: JSON.stringify({ name: $a("#account-name").value, email: $a("#account-email").value, password: $a("#account-password").value }) }); location.reload(); } catch (error) { $a("#account-error").textContent = error.message; button.disabled = false; button.textContent = registerMode ? "注册账号" : "登录并进入"; } };
$a("#submit-order").onclick = async () => { const button = $a("#submit-order"); const note = $a("#payment-note").value.trim(); if (note.length < 2) { $a("#payment-note-help").textContent = "请填写至少 2 个字，方便管理员核对付款"; $a("#payment-note").focus(); return; } button.disabled = true; button.textContent = "正在提交付款信息…"; try { await request("/api/orders", { method: "POST", body: JSON.stringify({ planId: selectedPlan, paymentMethod: selectedPaymentMethod, paymentNote: note }) }); await loadMembership(); button.textContent = "付款信息已提交"; } catch (error) { window.dispatchEvent(new CustomEvent("lumi:toast", { detail: { message: error.message, tone: "error" } })); button.disabled = false; button.textContent = "我已付款，提交审核"; } };
async function signOut() { await request("/api/auth/logout", { method: "POST" }); location.reload(); }
$a("#membership-logout").onclick = signOut; $a("#account-profile").onclick = () => { if (confirm(`${currentUser?.email || "当前账号"}\n${membershipText(currentUser || {})}\n\n是否退出登录？`)) signOut(); };
function renderAdmin() {
  if (!adminData) return; const query = $a("#admin-search").value.trim().toLocaleLowerCase();
  const members = adminData.users.filter((user) => user.role !== "admin"); const filtered = members.filter((user) => !query || `${user.name} ${user.email}`.toLocaleLowerCase().includes(query));
  $a("#admin-summary").innerHTML = `<span>用户 <b>${members.length}</b></span><span>有效会员 <b>${members.filter((user) => user.hasAccess).length}</b></span><span>待审核 <b>${adminData.orders.filter((order) => order.status === "pending").length}</b></span><span>即将到期 <b>${members.filter((user) => user.hasAccess && user.membershipExpiresAt && new Date(user.membershipExpiresAt) - Date.now() < 7 * 86400000).length}</b></span>`;
  $a("#admin-orders").innerHTML = adminData.orders.filter((order) => order.status === "pending").map((order) => `<div class="admin-row"><div><strong>${safe(order.user?.name || "未知")}</strong><small><br>${safe(order.user?.email || "")}</small></div><span>${safe(order.planName)}</span><span>¥${Number(order.amountCny) || 0} · ${order.paymentMethod === "alipay" ? "支付宝" : "微信支付"}<br><small>${safe(order.paymentNote || "无备注")}</small></span><div class="admin-actions"><button class="primary" data-order="${safe(order.id)}" data-action="confirm">确认开通</button><button data-order="${safe(order.id)}" data-action="reject">拒绝</button></div></div>`).join("") || "<p>暂无待审核付款</p>";
  $a("#admin-users").innerHTML = filtered.map((user) => `<div class="admin-row"><div><strong>${safe(user.name)}</strong><small><br>${safe(user.email)}</small></div><span>${safe(membershipText(user))}</span><span>${user.membershipExpiresAt ? new Date(user.membershipExpiresAt).toLocaleDateString("zh-CN") : "—"}</span><div class="admin-actions"><input class="admin-days" type="number" min="1" max="3650" value="30" aria-label="权限天数"><button class="primary" data-user="${safe(user.id)}" data-action="activate">开通</button><button data-user="${safe(user.id)}" data-action="extend">延期</button><button data-user="${safe(user.id)}" data-action="suspend">暂停</button><button data-user="${safe(user.id)}" data-action="revoke">取消</button></div></div>`).join("") || "<p>没有匹配的用户</p>";
}
async function loadAdmin() { adminData = await request("/api/admin/overview"); renderAdmin(); }
$a("#open-admin").onclick = async () => { $a("#admin-panel").hidden = false; await loadAdmin(); }; $a("#close-admin").onclick = () => { $a("#admin-panel").hidden = true; };
$a("#refresh-membership").onclick = () => loadMembership(); $a("#admin-search").oninput = renderAdmin;
$a("#admin-panel").onclick = async (event) => { const button = event.target.closest("button[data-action]"); if (!button) return; const destructive = ["reject", "suspend", "revoke"].includes(button.dataset.action); if (destructive && !confirm(`确定要执行“${button.textContent}”吗？`)) return; button.disabled = true; try { if (button.dataset.order) await request("/api/admin/orders/review", { method: "POST", body: JSON.stringify({ orderId: button.dataset.order, action: button.dataset.action }) }); else { const days = Number(button.closest(".admin-actions").querySelector(".admin-days")?.value) || 30; await request("/api/admin/members/update", { method: "POST", body: JSON.stringify({ userId: button.dataset.user, action: button.dataset.action, days }) }); } await loadAdmin(); } catch (error) { window.dispatchEvent(new CustomEvent("lumi:toast", { detail: { message: error.message, tone: "error" } })); button.disabled = false; } };
initialize();
