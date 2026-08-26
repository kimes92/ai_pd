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

    const {
      action,
      projectSettings,
      storySummaries = [],
      characterContext = "",
      currentText = "",
      userDirection = "",
      selectedText = "",
      userPrompt: customUserPrompt = "",
    } = await req.json();

    // 1. AI 인물 자동 생성 액션 (JSON 반환)
    if (action === "generate-character") {
      const systemPrompt = `당신은 소설 캐릭터 디자인 및 세계관 구축 전문 '작가2 AI'입니다.
유저가 기재한 소설 정보(장르, 시놉시스, 기존 인물 구도) 및 지시사항을 바탕으로 스토리의 몰입감을 극대화하고 입체적인 서사 확장이 가능한 독창적인 인물을 생성하세요.

반드시 다음 JSON 구조로만 응답하세요 (다른 설명 금지):
{
  "name": "인물 이름",
  "appearance": "외모, 나이, 체형, 복장 묘사",
  "personality": "성격, 가치관, 숨겨진 동기",
  "background": "배경 스토리, 신분, 비밀, 과거사",
  "relationships": "기존 인물들과의 관계 및 갈등 구도",
  "speechStyle": "말투, 어조, 자주 쓰는 언습"
}`;

      let userPrompt = `[소설 환경]\n- 장르: ${projectSettings?.genre || "판타지"}\n- 시놉시스: ${projectSettings?.synopsis || "미지정"}\n- 문체: ${projectSettings?.writing_style || "기본"}\n\n`;
      if (projectSettings?.characters && projectSettings.characters.length > 0) {
        userPrompt += `[기존 등록 인물 목록]\n${projectSettings.characters.map((c: any) => c.name).join(", ")}\n\n`;
      }
      if (customUserPrompt) {
        userPrompt += `[유저의 특별 지시사항]\n${customUserPrompt}\n\n`;
      } else {
        userPrompt += `이 세계관과 이야기에 신선한 위기나 조력을 가져올 입체적이고 확장성 있는 신규 등장인물을 1명 생성해주세요.`;
      }

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
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        throw new Error(`AI 게이트웨이 오류: ${response.status}`);
      }
      const data = await response.json();
      const resultJsonText = data.choices?.[0]?.message?.content || "{}";
      return new Response(resultJsonText, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. 컨텍스트 구성 (이어쓰기 / 대화 / 장면제안 / 재작성)
    let contextPrompt = "";

    if (projectSettings) {
      contextPrompt += `[프로젝트 기본 설정]\n`;
      if (projectSettings.perspective) contextPrompt += `- 시점: ${projectSettings.perspective}\n`;
      if (projectSettings.writing_style) contextPrompt += `- 문체 스타일: ${projectSettings.writing_style}\n`;
      if (projectSettings.synopsis) contextPrompt += `- 전체 시놉시스: ${projectSettings.synopsis}\n`;
      contextPrompt += `- 서식 규칙: 대화체 "", 인물 생각 '', 시스템/특별 메시지 []\n\n`;

      if (projectSettings.characters && projectSettings.characters.length > 0) {
        contextPrompt += `[주요 등장인물 목록]\n`;
        projectSettings.characters.forEach((c: any) => {
          contextPrompt += `■ ${c.name}: 외모(${c.appearance || "미지정"}), 성격(${c.personality || "미지정"}), 말투(${c.speechStyle || "미지정"}), 관계(${c.relationships || "미지정"})\n`;
        });
        contextPrompt += `\n`;
      }
    }

    if (characterContext) {
      contextPrompt += `${characterContext}\n\n`;
    }

    if (storySummaries && storySummaries.length > 0) {
      contextPrompt += `[이전 회차 요약 - 스토리 개연성 유지용]\n`;
      storySummaries.forEach((s: any) => {
        contextPrompt += `Ep.${s.episode_number}: 주요사건(${Array.isArray(s.events) ? s.events.join(", ") : ""})\n`;
      });
      contextPrompt += `\n`;
    }

    // 3. 액션별 프롬프트 세팅
    let systemPrompt = "";
    let userPrompt = "";

    if (action === "continue") {
      // 메인작가 AI — 3000자 이어쓰기
      systemPrompt = `당신은 총괄 집필을 맡은 '메인작가 AI'입니다.
유저(작가)와 직접 협업하여 1편당 10,000자 이상의 고품질 소설을 완성합니다.
한 번에 약 3000자 분량의 다음 스토리를 자연스럽게 이어씁니다.

[핵심 집필 원칙]
1. 기존 스토리 요약 및 인물 상태와 100% 개연성을 유지하세요.
2. 뜬금없는 전개나 이전 설정 파괴는 절대로 금지됩니다.
3. 인물이 알 수 없는 정보를 갑자기 알게 되어서는 안 됩니다.
4. [등장인물 연출 규칙]:
   - [등록된 주요 인물]: 설정에 등록된 주연/조연의 성격, 말투, 외모, 알고 있는 정보를 엄격히 준수하세요.
   - [조연 및 엑스트라 연출]: 등록된 주요 인물들 외에도 이야기를 생동감 넘치고 풍성하게 만들기 위해 마을 주민, 경비병, 상인, 악당 하수인, 기사단원, 행인 등 조연과 엑스트라 인물들을 상황에 맞게 자유롭고 생생하게 연출하세요! (등록된 인물만 세상에 존재하는 것이 아닙니다)
5. 서식 규칙: 대화체는 "", 인물 내면 생각은 '', 신의 계시나 특별 메시지는 []를 사용하세요.
6. 몰입감 있는 서사와 감정 묘사를 포함하여 약 3,000자 내외로 충실하게 작성하세요.`;

      const recentContent = currentText.length > 2000 ? currentText.slice(-2000) : currentText;
      userPrompt = `${contextPrompt}[현재 에피소드 마지막 작성 내용]\n...${recentContent}\n\n`;
      if (userDirection) {
        userPrompt += `[유저(작가)의 집필 방향 지시]\n${userDirection}\n\n`;
      }
      userPrompt += `위 내용에 이어서 개연성 있고 흥미진진하게 약 3000자 분량으로 소설을 계속 이어써주세요. 조연이나 엑스트라 인물들도 풍성하게 등장시켜 이야기를 생동감 있게 만드세요.`;
    } else if (action === "dialogue") {
      // 메인작가 AI — 대화 생성
      systemPrompt = `당신은 인물 대화 전담 '메인작가 AI'입니다.
주요 인물뿐만 아니라 필요시 주변 조연/엑스트라와의 생동감 넘치고 입체적인 대화 장면을 작성합니다.
대화체는 "", 내면 생각은 ''를 엄격히 준수하세요.`;

      userPrompt = `${contextPrompt}[대화 상황 지시]\n${userDirection || "현재 상황에 맞는 인물들의 입체적인 대화를 작성해주세요."}\n\n[현재 문맥]\n...${currentText.slice(-1000)}`;
    } else if (action === "suggest") {
      // 작가1 AI — 추가 아이디어 & 복선 제안
      systemPrompt = `당신은 개연성 검토 및 스토리 아이디어를 담당하는 '작가1 AI'입니다.
현재 스토리 흐름에서 개연성을 유지하면서도 흥미를 극대화할 수 있는 다음 장면 전개 방향 3가지를 제안하세요. (새로운 조연 인물의 등판이나 복선 회수도 적극 제안하세요)`;

      userPrompt = `${contextPrompt}[현재 에피소드 내용]\n...${currentText.slice(-1500)}\n\n앞으로의 스토리 전개를 위한 신선하고 개연성 있는 장면 방향 3가지를 제안해주세요.`;
    } else if (action === "rewrite") {
      // 메인작가 AI — 선택 구간 재작성
      systemPrompt = `당신은 문체 및 디테일 수정을 담당하는 '메인작가 AI'입니다.
유저가 선택한 문단을 지시에 맞게 더 감깔나고 입체적으로 재작성합니다.
대화체 "", 생각 '', 특별메시지 [] 서식을 준수하세요.`;

      userPrompt = `${contextPrompt}[선택한 원본 텍스트]\n${selectedText}\n\n[수정 지시사항]\n${userDirection}\n\n위 선택 텍스트를 지시사항에 맞게 재작성해주세요. 재작성된 텍스트만 출력하세요.`;
    } else {
      throw new Error(`알 수 없는 액션: ${action}`);
    }

    // 4. AI Gateway API 호출 (스트리밍 SSE)
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
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `AI 게이트웨이 오류: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("novel-assist error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "알 수 없는 오류" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
