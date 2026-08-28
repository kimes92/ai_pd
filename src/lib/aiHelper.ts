/**
 * Centralized AI API Calling Helper
 * Supports Local AI (Ollama), Google Gemini, and OpenAI
 */
export const callAI = async (
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal
): Promise<string> => {
  const provider = localStorage.getItem("ai_provider") || "local";
  const apiKey = localStorage.getItem("ai_api_key") || "";
  const localModel = localStorage.getItem("ai_local_model") || "llama3";

  if (provider === "gemini") {
    if (!apiKey) throw new Error("Gemini API 키가 설정되지 않았습니다.");
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
    const payload = {
      system_instruction: { parts: { text: systemPrompt } },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.85 },
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) throw new Error(`Gemini API error ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  }

  if (provider === "openai") {
    if (!apiKey) throw new Error("OpenAI API 키가 설정되지 않았습니다.");
    const endpoint = "https://api.openai.com/v1/chat/completions";
    const payload = {
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.85,
      frequency_penalty: 1.15,
      presence_penalty: 1.1,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) throw new Error(`OpenAI API error ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  // 로컬 AI (Ollama)
  const endpoint = "http://localhost:11434/v1/chat/completions";
  const payload = {
    model: localModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.85,
    frequency_penalty: 1.15,
    presence_penalty: 1.1,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Local AI API error ${response.status}: ${txt}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
};
