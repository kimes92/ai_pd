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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { action, currentText, previousSummaries = [], characterArcs = [], characters = [] } = await req.json();

    if (action === "consistency-check") {
      // 작가1 AI — 개연성 검토
      const systemPrompt = `당신은 스토리 개연성을 엄격히 검토하는 '작가1 AI'입니다.
작성된 에피소드 내용이 이전 회차 요약 및 인물 상태와 모순되거나 뜬금없는 전개가 있는지 분석하세요.

반드시 다음 JSON 구조로 응답하세요 (다른 설명 금지):
{
  "isConsistent": true|false,
  "score": 0~100 (개연성 점수),
  "issues": [
    {
      "type": "모순" | "설정파괴" | "급전개" | "인물붕괴",
      "description": "구체적 모순 내용 설명",
      "severity": "high" | "medium" | "low"
    }
  ],
  "strengths": ["잘 연결된 복선 및 강점 1", "강점 2"],
  "writerAdvice": "작가1 AI의 개연성 유지 및 전개 제언"
}`;

      const userPrompt = `[이전 회차 요약]\n${JSON.stringify(previousSummaries, null, 2)}\n\n[인물별 현재 상태]\n${JSON.stringify(characterArcs, null, 2)}\n\n[검토할 에피소드 본문]\n${currentText}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) throw new Error("AI 게이트웨이 오류");
      const data = await response.json();
      const resultText = data.choices?.[0]?.message?.content || "{}";

      return new Response(resultText, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "generate-summary") {
      // 작가1 & 작가2 AI — 에피소드 요약 및 인물별 스토리 아크 생성
      const systemPrompt = `당신은 에피소드를 분석하는 '작가1 AI' 및 '작가2 AI' 팀입니다.
작성된 에피소드를 분석하여 전체 스토리 요약(작가1)과 인물별 입체적 스토리 아크(작가2)를 동시에 생성합니다.

반드시 다음 JSON 구조로 응답하세요 (다른 설명 금지):
{
  "summary": {
    "events": ["주요 사건 1", "주요 사건 2"],
    "character_changes": {"인물명": "변화 내용"},
    "foreshadowing": ["새로 던져진 복선/떡밥"],
    "world_state": "장소, 시간, 분위기 변화",
    "key_dialogue": ["명대사/핵심 대화"],
    "unresolved": ["미해결 과제/갈등"]
  },
  "character_arcs": [
    {
      "character_name": "인물명",
      "emotional_state": "현재 감정 상태",
      "location": "현재 위치",
      "goals": "현재 목표/동기",
      "known_info": ["알고 있는 정보들"],
      "unknown_info": ["모르는 정보들"],
      "relationships": {"상대인물": "관계 상태"},
      "growth_notes": "이 회차에서의 성격/상태 변화",
      "conflicts": "현재 겪고 있는 갈등",
      "next_possibilities": "작가2 AI의 인물 성장 제안"
    }
  ]
}`;

      const userPrompt = `[등장인물 목록]\n${JSON.stringify(characters, null, 2)}\n\n[분석할 에피소드 본문]\n${currentText}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) throw new Error("AI 게이트웨이 오류");
      const data = await response.json();
      const resultText = data.choices?.[0]?.message?.content || "{}";

      return new Response(resultText, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      throw new Error(`알 수 없는 액션: ${action}`);
    }
  } catch (e) {
    console.error("story-review error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "알 수 없는 오류" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
