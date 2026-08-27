import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const file = path.resolve("server/data/members.json");
const empty = { users: [], sessions: [], orders: [], audit: [] };

async function readData() {
  try { return { ...structuredClone(empty), ...JSON.parse(await readFile(file, "utf8")) }; }
  catch (error) { if (error.code === "ENOENT") return structuredClone(empty); throw error; }
}

async function writeData(data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2));
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
  const data = await readData(); const order = { id: `LUMI-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`, userId, planId: plan.id, planName: plan.name, days: plan.days, amountCny: plan.priceCny, paymentMethod: ["wechat", "alipay"].includes(input.paymentMethod) ? input.paymentMethod : "wechat", paymentNote: String(input.paymentNote || "").trim().slice(0, 120), status: "pending", createdAt: new Date().toISOString(), reviewedAt: null, reviewedBy: null };
  data.orders.unshift(order); await writeData(data); return order;
}

export async function ordersForUser(userId) { return (await readData()).orders.filter((item) => item.userId === userId); }

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
