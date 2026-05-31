async function callClaude(apiKey, messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: messages.filter((m) => m.role !== "system"),
      system: messages.find((m) => m.role === "system")?.content || "",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API error (${res.status}): ${body}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error("Claude returned an empty response");
  return text;
}

function extractOpenAiText(data) {
  const choice = data.choices?.[0];
  const message = choice?.message;
  const content = message?.content;

  if (typeof content === "string" && content.trim()) {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => (typeof part === "string" ? part : part?.text))
      .filter(Boolean)
      .join("");
    if (text.trim()) return text;
  }

  if (message?.refusal) {
    throw new Error(`ChatGPT refused the request: ${message.refusal}`);
  }

  const finishReason = choice?.finish_reason;
  const reasoningTokens =
    data.usage?.completion_tokens_details?.reasoning_tokens;
  const details = [
    finishReason && `finish_reason=${finishReason}`,
    reasoningTokens != null && `reasoning_tokens=${reasoningTokens}`,
  ]
    .filter(Boolean)
    .join(", ");

  throw new Error(
    `ChatGPT returned an empty response${details ? ` (${details})` : ""}`,
  );
}

async function callChatGPT(apiKey, messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      messages,
      reasoning_effort: "low",
      max_completion_tokens: 500,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ChatGPT API error (${res.status}): ${body}`);
  }
  const data = await res.json();
  return extractOpenAiText(data);
}

async function callGemini(apiKey, messages) {
  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  const contents = nonSystem.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body = { contents };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${text}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

async function callGrok(apiKey, messages) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-3-latest",
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Grok API error (${res.status}): ${body}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Grok returned an empty response");
  return text;
}

const aiClients = {
  Claude: callClaude,
  ChatGPT: callChatGPT,
  Gemini: callGemini,
  Grok: callGrok,
};
export default aiClients;
