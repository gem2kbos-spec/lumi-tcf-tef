export function getAiConfig(env = process.env) {
  if (env.DEEPSEEK_API_KEY) {
    return { enabled: true, provider: "deepseek", model: env.DEEPSEEK_MODEL || "deepseek-v4-flash" };
  }
  if (env.OPENAI_API_KEY) {
    return { enabled: true, provider: "openai", model: env.OPENAI_MODEL || "gpt-5.6-sol" };
  }
  return { enabled: false, provider: "local", model: null };
}

export function aiEnabled() { return getAiConfig().enabled; }

function openAiOutput(payload) {
  return payload.output_text ?? payload.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
}

export async function completeAi({ instructions, input, history = [], schema = null, schemaName = "structured_output", maxTokens = 5000 }) {
  const config = getAiConfig();
  if (!config.enabled) throw new Error("AI_KEY_REQUIRED");

  if (config.provider === "deepseek") {
    const systemPrompt = schema
      ? `${instructions}\n你必须只返回一个合法 JSON 对象，不要使用 Markdown。JSON 必须符合以下结构：${JSON.stringify(schema)}`
      : instructions;
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: input }],
        thinking: { type: "disabled" },
        ...(schema ? { response_format: { type: "json_object" } } : {}),
        max_tokens: maxTokens
      })
    });
    if (!response.ok) throw new Error(`DeepSeek API error ${response.status}: ${await response.text()}`);
    const payload = await response.json();
    const output = payload.choices?.[0]?.message?.content;
    if (!output) throw new Error("DeepSeek did not return content.");
    return output;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: config.model,
      instructions,
      input: [...history, { role: "user", content: input }],
      ...(schema ? { text: { format: { type: "json_schema", name: schemaName, strict: true, schema } } } : {}),
      max_output_tokens: maxTokens
    })
  });
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
  const output = openAiOutput(await response.json());
  if (!output) throw new Error("OpenAI did not return content.");
  return output;
}
