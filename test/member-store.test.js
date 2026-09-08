import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("member orders cannot be duplicated and admin approval grants access", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lumi-members-"));
  process.env.LUMI_MEMBER_FILE = path.join(directory, "members.json");
  const store = await import(`../server/member-store.js?test=${Date.now()}`);
  const member = await store.register({ name: "学员", email: "learner@example.com", password: "secure-pass-2026", acceptedTerms: true });
  assert.equal(member.hasAccess, false);
  const order = await store.createOrder(member.id, { planId: "month", paymentNote: "尾号1234", purchaseAccepted: true });
  await assert.rejects(() => store.createOrder(member.id, { planId: "quarter", paymentNote: "尾号5678", purchaseAccepted: true }), /已有待审核订单/);
  const reviewed = await store.reviewOrder("admin-id", order.id, "confirm");
  assert.equal(reviewed.user.hasAccess, true);
  assert.equal(reviewed.user.membershipStatus, "active");
  assert.equal((await store.consumeAiQuota(member.id, 2)).allowed, true);
  assert.equal((await store.consumeAiQuota(member.id, 2)).remaining, 0);
  assert.equal((await store.consumeAiQuota(member.id, 2)).allowed, false);
  const comment = await store.addQuestionComment(member.id, "question-1", "我认为这里应先判断介词。 ");
  await assert.rejects(() => store.addQuestionComment(member.id, "question-1", "我认为这里应先判断介词。"), /相同评论/);
  const comments = await store.questionComments("question-1", member);
  assert.equal(comments.length, 1); assert.equal(comments[0].canDelete, true); assert.equal(comments[0].author.name, "学员");
  await store.deleteQuestionComment(member, comment.id);
  assert.equal((await store.questionComments("question-1", member)).length, 0);
});

test("payment note is required for manual verification", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lumi-members-note-"));
  process.env.LUMI_MEMBER_FILE = path.join(directory, "members.json");
  const store = await import(`../server/member-store.js?test=${Date.now()}-note`);
  const member = await store.register({ name: "学员", email: "note@example.com", password: "secure-pass-2026", acceptedTerms: true });
  await assert.rejects(() => store.createOrder(member.id, { planId: "month", paymentNote: "", purchaseAccepted: true }), /付款备注/);
});

test("registration and payment require explicit agreement", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lumi-consent-"));
  process.env.LUMI_MEMBER_FILE = path.join(directory, "members.json");
  const store = await import(`../server/member-store.js?test=${Date.now()}-consent`);
  await assert.rejects(() => store.register({ name: "学员", email: "consent@example.com", password: "secure-pass-2026" }), /同意用户协议/);
  const member = await store.register({ name: "学员", email: "consent@example.com", password: "secure-pass-2026", acceptedTerms: true });
  await assert.rejects(() => store.createOrder(member.id, { planId: "month", paymentNote: "尾号1234" }), /购买与退款说明/);
});

test("new registrations require a ten-character password", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lumi-password-length-"));
  process.env.LUMI_MEMBER_FILE = path.join(directory, "members.json");
  const store = await import(`../server/member-store.js?test=${Date.now()}-password-length`);
  await assert.rejects(() => store.register({ name: "学员", email: "short@example.com", password: "123456789", acceptedTerms: true }), /至少需要 10 位/);
});

test("concurrent registrations do not overwrite one another", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lumi-concurrent-members-"));
  process.env.LUMI_MEMBER_FILE = path.join(directory, "members.json");
  const store = await import(`../server/member-store.js?test=${Date.now()}-concurrent`);
  await Promise.all(Array.from({ length: 8 }, (_, index) => store.register({ name: `学员${index}`, email: `parallel-${index}@example.com`, password: "secure-pass-2026", acceptedTerms: true })));
  const overview = await store.adminOverview();
  assert.equal(overview.users.filter((user) => user.email.startsWith("parallel-")).length, 8);
});

test("concurrent quota and comment writes are all retained", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lumi-concurrent-activity-"));
  process.env.LUMI_MEMBER_FILE = path.join(directory, "members.json");
  const store = await import(`../server/member-store.js?test=${Date.now()}-concurrent-activity`);
  const member = await store.register({ name: "并发学员", email: "activity@example.com", password: "secure-pass-2026", acceptedTerms: true });
  await Promise.all([
    ...Array.from({ length: 12 }, () => store.consumeAiQuota(member.id, 20)),
    ...Array.from({ length: 6 }, (_, index) => store.addQuestionComment(member.id, `question-${index}`, `第 ${index + 1} 条有效评论`))
  ]);
  assert.equal((await store.aiUsageForUser(member.id, 20)).used, 12);
  const comments = await Promise.all(Array.from({ length: 6 }, (_, index) => store.questionComments(`question-${index}`, member)));
  assert.equal(comments.flat().length, 6);
});

test("a new login invalidates the previous device session", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lumi-single-session-"));
  process.env.LUMI_MEMBER_FILE = path.join(directory, "members.json");
  const store = await import(`../server/member-store.js?test=${Date.now()}-single-session`);
  await store.register({ name: "单设备学员", email: "single@example.com", password: "secure-pass-2026", acceptedTerms: true });
  const firstDevice = await store.login("single@example.com", "secure-pass-2026");
  assert.equal((await store.authenticate(firstDevice.token))?.email, "single@example.com");
  const secondDevice = await store.login("single@example.com", "secure-pass-2026");
  assert.equal(await store.authenticate(firstDevice.token), null);
  assert.equal((await store.authenticate(secondDevice.token))?.email, "single@example.com");
});

test("admin can reset a member password and invalidate active sessions", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lumi-password-reset-"));
  process.env.LUMI_MEMBER_FILE = path.join(directory, "members.json");
  const store = await import(`../server/member-store.js?test=${Date.now()}-password-reset`);
  const member = await store.register({ name: "找回密码学员", email: "recover@example.com", password: "old-password-2026", acceptedTerms: true });
  const oldSession = await store.login(member.email, "old-password-2026");
  const result = await store.resetMemberPassword("admin-id", member.id);
  assert.match(result.temporaryPassword, /^Lu-/);
  assert.equal(await store.authenticate(oldSession.token), null);
  await assert.rejects(() => store.login(member.email, "old-password-2026"), /邮箱或密码错误/);
  assert.equal((await store.login(member.email, result.temporaryPassword)).user.email, member.email);
});

test("member can change their own password and every existing session is revoked", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lumi-change-password-"));
  process.env.LUMI_MEMBER_FILE = path.join(directory, "members.json");
  const store = await import(`../server/member-store.js?test=${Date.now()}-change-password`);
  const member = await store.register({ name: "安全设置学员", email: "change@example.com", password: "old-password-2026", acceptedTerms: true });
  const session = await store.login(member.email, "old-password-2026");
  await assert.rejects(() => store.changePassword(member.id, "wrong-password", "new-password-2026"), /当前密码不正确/);
  await store.changePassword(member.id, "old-password-2026", "new-password-2026");
  assert.equal(await store.authenticate(session.token), null);
  assert.equal((await store.login(member.email, "new-password-2026")).user.email, member.email);
});
