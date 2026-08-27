import crypto from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";
import { readDocument, writeDocument } from "./persistence.js";

const scrypt = promisify(crypto.scrypt);
const file = path.resolve(process.env.LUMI_MEMBER_FILE || "server/data/members.json");
const empty = { users: [], sessions: [], orders: [], audit: [], aiUsage: [], comments: [] };

async function readData() {
  return { ...structuredClone(empty), ...await readDocument("members", empty, file) };
}

async function writeData(data) {
  await writeDocument("members", data, file);
}

const normalizeEmail = (value) => String(value || "").trim().toLocaleLowerCase("en");
const tokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");

async function passwordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(derived).toString("hex")}`;
}

async function passwordMatches(password, stored) {
  const [salt, expectedHex] = String(stored || "").split(":");
  if (!salt || !expectedHex) return false;
  const actual = Buffer.from((await passwordHash(password, salt)).split(":")[1], "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export const plans = [
  { id: "month", name: "30 天训练权限", days: 30, priceCny: 29 },
  { id: "quarter", name: "90 天训练权限", days: 90, priceCny: 69 },
  { id: "half-year", name: "180 天训练权限", days: 180, priceCny: 119 }
];

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash: _, ...safe } = user;
  return { ...safe, hasAccess: user.role === "admin" || (user.membershipStatus === "active" && (!user.membershipExpiresAt || new Date(user.membershipExpiresAt) > new Date())) };
}

export async function ensureAdminFromEnv() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!email || password.length < 10) return null;
  const data = await readData();
  let user = data.users.find((item) => item.email === email);
  if (!user) {
    user = { id: crypto.randomUUID(), email, name: "Lumi 管理员", passwordHash: await passwordHash(password), role: "admin", membershipStatus: "active", membershipExpiresAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    data.users.push(user); await writeData(data);
  } else if (user.role !== "admin") { user.role = "admin"; user.updatedAt = new Date().toISOString(); await writeData(data); }
  return publicUser(user);
}

export async function register({ email, password, name }) {
  email = normalizeEmail(email); password = String(password || ""); name = String(name || "").trim().slice(0, 40);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("请输入有效邮箱");
  if (password.length < 8) throw new Error("密码至少需要 8 位");
  if (!name) throw new Error("请输入称呼");
  const data = await readData();
  if (data.users.some((item) => item.email === email)) throw new Error("该邮箱已经注册");
  const user = { id: crypto.randomUUID(), email, name, passwordHash: await passwordHash(password), role: "member", membershipStatus: "pending", membershipExpiresAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  data.users.push(user); await writeData(data); return publicUser(user);
}

export async function login(email, password) {
  const data = await readData();
  const user = data.users.find((item) => item.email === normalizeEmail(email));
  if (!user || !await passwordMatches(String(password || ""), user.passwordHash)) throw new Error("邮箱或密码错误");
  data.sessions = data.sessions.filter((item) => new Date(item.expiresAt) > new Date());
  const token = crypto.randomBytes(32).toString("base64url");
  data.sessions.push({ id: crypto.randomUUID(), userId: user.id, tokenHash: tokenHash(token), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() });
  await writeData(data); return { token, user: publicUser(user) };
}

export async function authenticate(token) {
  if (!token) return null;
  const data = await readData(); const session = data.sessions.find((item) => item.tokenHash === tokenHash(token) && new Date(item.expiresAt) > new Date());
  return session ? publicUser(data.users.find((item) => item.id === session.userId)) : null;
}

export async function logout(token) {
  if (!token) return;
  const data = await readData(); data.sessions = data.sessions.filter((item) => item.tokenHash !== tokenHash(token)); await writeData(data);
}

export async function createOrder(userId, input) {
  const plan = plans.find((item) => item.id === input.planId); if (!plan) throw new Error("请选择有效套餐");
  const data = await readData();
  const pending = data.orders.find((item) => item.userId === userId && item.status === "pending");
  if (pending) throw new Error(`已有待审核订单：${pending.id}，请勿重复提交`);
  const paymentNote = String(input.paymentNote || "").trim().slice(0, 120);
  if (paymentNote.length < 2) throw new Error("请填写付款备注或转账单号后四位，方便管理员核对");
  const order = { id: `LUMI-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`, userId, planId: plan.id, planName: plan.name, days: plan.days, amountCny: plan.priceCny, paymentMethod: ["wechat", "alipay"].includes(input.paymentMethod) ? input.paymentMethod : "wechat", paymentNote, status: "pending", createdAt: new Date().toISOString(), reviewedAt: null, reviewedBy: null };
  data.orders.unshift(order); await writeData(data); return order;
}

export async function ordersForUser(userId) { return (await readData()).orders.filter((item) => item.userId === userId); }

function usageDate(now = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }

export async function aiUsageForUser(userId, limit = Number(process.env.AI_DAILY_LIMIT) || 100) {
  const data = await readData(); const date = usageDate(); const record = data.aiUsage.find((item) => item.userId === userId && item.date === date);
  const used = record?.count || 0; return { date, used, limit, remaining: Math.max(0, limit - used) };
}

export async function consumeAiQuota(userId, limit = Number(process.env.AI_DAILY_LIMIT) || 100) {
  const data = await readData(); const date = usageDate();
  data.aiUsage = data.aiUsage.filter((item) => item.date >= date);
  let record = data.aiUsage.find((item) => item.userId === userId && item.date === date);
  if (!record) { record = { userId, date, count: 0 }; data.aiUsage.push(record); }
  if (record.count >= limit) return { allowed: false, date, used: record.count, limit, remaining: 0 };
  record.count++; await writeData(data); return { allowed: true, date, used: record.count, limit, remaining: limit - record.count };
}

export async function questionComments(questionId, viewer) {
  const data = await readData();
  return data.comments.filter((item) => item.questionId === questionId && !item.deletedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((item) => {
    const author = data.users.find((user) => user.id === item.userId);
    return { id: item.id, questionId: item.questionId, content: item.content, createdAt: item.createdAt, author: { name: author?.name || "已注销用户", role: author?.role || "member" }, canDelete: viewer.role === "admin" || viewer.id === item.userId };
  });
}

export async function addQuestionComment(userId, questionId, content) {
  content = String(content || "").trim().replace(/\s{3,}/g, "  ").slice(0, 500);
  if (content.length < 2) throw new Error("评论至少需要 2 个字");
  const data = await readData(); const since = Date.now() - 24 * 60 * 60 * 1000;
  if (data.comments.filter((item) => item.userId === userId && new Date(item.createdAt).getTime() > since && !item.deletedAt).length >= 30) throw new Error("今天发表评论较多，请明天继续");
  const duplicate = data.comments.find((item) => item.userId === userId && item.questionId === questionId && item.content === content && Date.now() - new Date(item.createdAt).getTime() < 10 * 60 * 1000 && !item.deletedAt);
  if (duplicate) throw new Error("相同评论已经发表，请勿重复提交");
  const comment = { id: crypto.randomUUID(), questionId, userId, content, createdAt: new Date().toISOString(), deletedAt: null, deletedBy: null };
  data.comments.push(comment); await writeData(data); return comment;
}

export async function deleteQuestionComment(actor, commentId) {
  const data = await readData(); const comment = data.comments.find((item) => item.id === commentId && !item.deletedAt);
  if (!comment) throw new Error("评论不存在");
  if (actor.role !== "admin" && actor.id !== comment.userId) throw new Error("无权删除这条评论");
  comment.deletedAt = new Date().toISOString(); comment.deletedBy = actor.id;
  data.audit.unshift({ id: crypto.randomUUID(), adminId: actor.role === "admin" ? actor.id : null, action: "comment.delete", targetId: commentId, createdAt: new Date().toISOString() });
  await writeData(data); return { ok: true };
}

export async function adminOverview() {
  const data = await readData();
  return { users: data.users.map(publicUser).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), orders: data.orders.map((order) => ({ ...order, user: publicUser(data.users.find((item) => item.id === order.userId)) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), audit: data.audit.slice(0, 100) };
}

function extendMembership(user, days) {
  const current = user.membershipExpiresAt && new Date(user.membershipExpiresAt) > new Date() ? new Date(user.membershipExpiresAt).getTime() : Date.now();
  user.membershipStatus = "active"; user.membershipExpiresAt = new Date(current + days * 86400000).toISOString(); user.updatedAt = new Date().toISOString();
}

export async function reviewOrder(adminId, orderId, action) {
  const data = await readData(); const order = data.orders.find((item) => item.id === orderId); if (!order) throw new Error("订单不存在");
  if (order.status !== "pending") throw new Error("该订单已处理");
  const user = data.users.find((item) => item.id === order.userId); if (!user) throw new Error("用户不存在");
  order.status = action === "confirm" ? "confirmed" : "rejected"; order.reviewedAt = new Date().toISOString(); order.reviewedBy = adminId;
  if (action === "confirm") extendMembership(user, order.days);
  data.audit.unshift({ id: crypto.randomUUID(), adminId, action: `order.${order.status}`, targetId: order.id, createdAt: new Date().toISOString() }); await writeData(data); return { order, user: publicUser(user) };
}

export async function updateMember(adminId, userId, action, days = 30) {
  const data = await readData(); const user = data.users.find((item) => item.id === userId); if (!user || user.role === "admin") throw new Error("用户不存在或不可修改");
  if (action === "activate" || action === "extend") extendMembership(user, Math.min(3650, Math.max(1, Number(days) || 30)));
  else if (action === "suspend") user.membershipStatus = "suspended";
  else if (action === "revoke") { user.membershipStatus = "expired"; user.membershipExpiresAt = new Date().toISOString(); }
  else throw new Error("无效操作");
  user.updatedAt = new Date().toISOString(); data.audit.unshift({ id: crypto.randomUUID(), adminId, action: `member.${action}`, targetId: userId, days: Number(days) || null, createdAt: new Date().toISOString() }); await writeData(data); return publicUser(user);
}
