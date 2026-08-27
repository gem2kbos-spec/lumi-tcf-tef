import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("member orders cannot be duplicated and admin approval grants access", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lumi-members-"));
  process.env.LUMI_MEMBER_FILE = path.join(directory, "members.json");
  const store = await import(`../server/member-store.js?test=${Date.now()}`);
  const member = await store.register({ name: "学员", email: "learner@example.com", password: "secure-pass-2026" });
  assert.equal(member.hasAccess, false);
  const order = await store.createOrder(member.id, { planId: "month", paymentNote: "尾号1234" });
  await assert.rejects(() => store.createOrder(member.id, { planId: "quarter", paymentNote: "尾号5678" }), /已有待审核订单/);
  const reviewed = await store.reviewOrder("admin-id", order.id, "confirm");
  assert.equal(reviewed.user.hasAccess, true);
  assert.equal(reviewed.user.membershipStatus, "active");
  assert.equal((await store.consumeAiQuota(member.id, 2)).allowed, true);
  assert.equal((await store.consumeAiQuota(member.id, 2)).remaining, 0);
  assert.equal((await store.consumeAiQuota(member.id, 2)).allowed, false);
});

test("payment note is required for manual verification", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lumi-members-note-"));
  process.env.LUMI_MEMBER_FILE = path.join(directory, "members.json");
  const store = await import(`../server/member-store.js?test=${Date.now()}-note`);
  const member = await store.register({ name: "学员", email: "note@example.com", password: "secure-pass-2026" });
  await assert.rejects(() => store.createOrder(member.id, { planId: "month", paymentNote: "" }), /付款备注/);
});
