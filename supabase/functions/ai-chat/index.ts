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
    const { messages, image } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Prepare messages with optional image
    const formattedMessages = messages.map((msg: any) => {
      if (msg.image && msg.role === "user") {
        return {
          role: msg.role,
          content: [
            { type: "text", text: msg.content },
            { 
              type: "image_url", 
              image_url: { url: msg.image } 
            }
          ]
        };
      }
      return msg;
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: `당신은 친절한 Rhino3D 전문가입니다. 사용자와 자연스럽게 대화하며 도움을 제공합니다.

**역할**
Rhino3D, NURBS 모델링, SubD, Grasshopper, 렌더링, 3D 프린팅 등 모든 기능에 대해 전문적으로 도와드립니다.

**대화 방식**
- 자연스럽고 친근한 대화체로 답변합니다
- 복잡한 개념도 쉽게 설명합니다
- 필요할 때만 단계별로 설명하고, 간단한 질문엔 간단히 답합니다
- 명령어는 \`_CommandName\` 형식으로 표시합니다
- 화면 캡처가 있으면 보이는 내용을 바탕으로 실용적인 조언을 드립니다

**중요**
구조화된 형식 없이 자연스럽게 대화하듯 답변하세요. Gemini나 ChatGPT처럼요.`
          },
          ...formattedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "크레딧이 부족합니다. Lovable AI 워크스페이스에 크레딧을 추가해주세요." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI 게이트웨이 오류가 발생했습니다" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "알 수 없는 오류" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
