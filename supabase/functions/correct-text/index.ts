import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, correctionType, model: requestedModel } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "텍스트가 필요합니다" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const MODEL_WHITELIST = new Set([
      "google/gemini-2.5-flash",
      "google/gemini-2.5-flash-lite",
    ]);
    const model =
      typeof requestedModel === "string" && MODEL_WHITELIST.has(requestedModel)
        ? requestedModel
        : "google/gemini-2.5-flash";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";
    if (correctionType === "spacing-only") {
      systemPrompt = `당신은 한국어 띄어쓰기 전문가입니다. 
주어진 텍스트의 띄어쓰기만 교정해주세요.

중요 규칙:
- 맞춤법이나 문법, 단어 선택은 절대 변경하지 마세요.
- 숫자, 시간 표기, 특수문자와 기호는 그대로 유지하세요.
- 줄바꿈과 문단 구조를 유지하세요.
교정된 텍스트만 출력하세요.`;
    } else if (correctionType === "novel") {
      systemPrompt = `당신은 한국어 소설 맞춤법 및 문체 교정 전문가입니다. (메인작가 AI 보조 시스템)
주어진 소설 텍스트의 맞춤법, 문법, 띄어쓰기, 소설 서식을 자연스럽게 교정해주세요.

중요 규칙:
- 원래 의미, 문체, 분위기를 100% 유지하세요.
- 대화체는 큰따옴표 ""를 사용하세요.
- 인물의 내면 생각은 작은따옴표 ''를 사용하세요.
- 신의 계시나 시스템 메시지, 특별한 알림은 대괄호 []를 사용하세요.
- 줄바꿈과 문단 간격을 소설 형식에 맞게 자연스럽게 정돈하세요.
- 고유명사, 숫자, 캐릭터 설정 명칭은 절대 수정하지 마세요.

교정된 텍스트만 출력하세요. 설명이나 인사말 없이 교정 결과만 반환하세요.`;
    } else {
      systemPrompt = `당신은 한국어 교정 전문가입니다.
주어진 텍스트의 맞춤법, 문법, 띄어쓰기를 교정해주세요.

중요 규칙:
- 원래 의미와 문체는 최대한 유지하면서 자연스럽게 교정하세요.
- 숫자, 시간 표기, 특수문자와 기호는 그대로 유지하세요.
- 줄바꿈과 문단 구조를 유지하세요.
교정된 텍스트만 출력하세요.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI 서비스 오류");
    }

    const data = await response.json();
    const correctedText = data.choices?.[0]?.message?.content?.trim() || text;

    return new Response(
      JSON.stringify({ correctedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("correct-text error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "알 수 없는 오류" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
