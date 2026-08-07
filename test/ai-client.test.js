import test from "node:test";
import assert from "node:assert/strict";
import { getAiConfig } from "../server/ai-client.js";

test("AI is disabled without a configured key", () => {
  assert.deepEqual(getAiConfig({}), { enabled: false, provider: "local", model: null });
});

test("DeepSeek is the preferred provider", () => {
  assert.deepEqual(getAiConfig({ DEEPSEEK_API_KEY: "ds", OPENAI_API_KEY: "oa" }), { enabled: true, provider: "deepseek", model: "deepseek-v4-flash" });
});

test("DeepSeek and OpenAI models can be configured", () => {
  assert.equal(getAiConfig({ DEEPSEEK_API_KEY: "ds", DEEPSEEK_MODEL: "custom-ds" }).model, "custom-ds");
  assert.deepEqual(getAiConfig({ OPENAI_API_KEY: "oa", OPENAI_MODEL: "custom-oa" }), { enabled: true, provider: "openai", model: "custom-oa" });
});
