import test from "node:test";
import assert from "node:assert/strict";
import { getKnowledgeTopic, knowledgeTopics } from "../server/knowledge-topics.js";

test("knowledge classroom contains complete, unique lessons", () => {
  assert.ok(knowledgeTopics.length >= 6);
  assert.equal(new Set(knowledgeTopics.map((topic) => topic.id)).size, knowledgeTopics.length);
  for (const topic of knowledgeTopics) {
    assert.ok(topic.title && topic.summary && topic.skill && topic.type);
    assert.ok(topic.sections.length >= 4);
    assert.ok(topic.examples.length >= 1);
  }
});

test("y and en lesson leads with the preposition decision rule", () => {
  const topic = getKnowledgeTopic("y-en-prepositions");
  assert.match(topic.title, /看介词，不看中文/);
  assert.match(topic.summary, /à/);
  assert.match(topic.summary, /de/);
  assert.ok(topic.sections.some(([, content]) => content.includes("lui/leur")));
});
