import { useState, useCallback, useRef } from 'react';

export interface ChunkState {
  isGenerating: boolean;
  currentChunk: number;
  totalChunksGenerated: number;
  generatedText: string;
  error: string | null;
}

/**
 * Unified AI call helper. Chooses the appropriate model endpoint based on
 * environment variables and builds the prompt according to the requested
 * action (continue, dialogue, suggest, rewrite).
 */
const fetchAI = async (
  action: string,
  params: any,
  signal?: AbortSignal
): Promise<string> => {
  const settings = params.projectSettings || {};
  const characters = settings.characters || [];
  const summaries = params.storySummaries || [];
  const currentText = params.currentText || '';
  const direction = params.userDirection || '';
  const selectedText = params.selectedText || '';

  // Build context block
  let context = `[작품 기본 정보]\n`;
  if (settings.genre) context += `- 장르: ${settings.genre}\n`;
  if (settings.perspective) context += `- 시점: ${settings.perspective}\n`;
  if (settings.synopsis) context += `- 전체 시놉시스: ${settings.synopsis}\n`;
  if (settings.writing_style) context += `- 문체 스타일: ${settings.writing_style}\n`;
  if (settings.reference_text) {
    context += `\n[작가 고유 문체 스타일 참고 샘플 (Style Guide Only)]\n${settings.reference_text}\n`;
  }
  if (characters.length > 0) {
    context += `\n[주요 등장인물 및 말투 설정]\n`;
    characters.forEach((c: any) => {
      context += `■ ${c.name}: 외모(${c.appearance || '미지정'}), 성격(${c.personality || '미지정'}), 말투(${c.speechStyle || '미지정'}), 관계/배경(${c.relationships || c.background || '미지정'})\n`;
    });
  }
  if (params.characterContext) {
    context += `\n${params.characterContext}\n`;
  }
  if (summaries.length > 0) {
    context += `\n[이전 회차 줄거리 요약]\n`;
    summaries.forEach((s: any) => {
      const ev = Array.isArray(s.events) ? s.events.join(', ') : '';
      context += `Ep.${s.episode_number}: 주요사건(${ev})\n`;
    });
  }

  let systemPrompt = '';
  let userPrompt = '';
  if (action === 'continue') {
    systemPrompt = `당신은 총괄 집필을 담당하는 '메인작가 AI'입니다.\n\n[규칙]\n- 대화는 \"\", 생각은 '', 특별 메세지는 [] 로 표기\n- 주요 인물 외에도 상황에 맞는 엑스트라·조연을 자유롭게 삽입\n- 문체 가이드는 절대 복사하지 말고 톤과 호흡만 학습 적용\n\n**IMPORTANT: You MUST write your ENTIRE response in Korean. 반드시 한국어로만 출력하세요.**`;
    const recent = currentText.length > 2000 ? currentText.slice(-2000) : currentText;
    userPrompt = `${context}\n[현재 에피소드 내용]\n...${recent}\n`;
    if (direction) userPrompt += `[유저 지시]\n${direction}\n`;
    userPrompt += `위 정보를 바탕으로 약 3000자 분량의 다음 내용을 작성해 주세요.`;
  } else if (action === 'dialogue') {
    systemPrompt = `당신은 대화 전담 AI 입니다. 인물들의 고유 말투와 성격을 반영해 자연스러운 대화를 작성하세요.\n\n[규칙] 대화는 \"\", 생각은 '', 특별 메세지는 [] 로 표기\n\n**IMPORTANT: You MUST write your ENTIRE response in Korean. 반드시 한국어로만 출력하세요.**`;
    userPrompt = `${context}\n[대화 상황]\n${direction || '현재 상황에 맞는 대화를 생성'}\n\n[현재 텍스트]\n...${currentText.slice(-1000)}`;
  } else if (action === 'suggest') {
    systemPrompt = `당신은 작가1 AI 입니다. 현재 내용과 전체 시놉시스에 맞는 다음 장면 아이디어 3가지를 제안하세요.\n\n**IMPORTANT: You MUST write your ENTIRE response in Korean. 반드시 한국어로만 출력하세요.**`;
    userPrompt = `${context}\n[현재 내용]\n...${currentText.slice(-1500)}\n\n다음 장면 아이디어 3개를 구체적으로 제시해 주세요.`;
  } else if (action === 'rewrite') {
    systemPrompt = `당신은 재작성 전담 AI 입니다. 선택된 텍스트를 시놉시스와 인물 말투에 맞게 더 풍부하고 감각적인 문장으로 바꾸세요.\n\n**IMPORTANT: You MUST write your ENTIRE response in Korean. 반드시 한국어로만 출력하세요.**`;
    userPrompt = `${context}\n[원본 텍스트]\n${selectedText}\n\n[지시사항]\n${direction}\n\n위 텍스트를 재작성해 주세요.`;
  } else if (action === 'feedback-rewrite') {
    systemPrompt = `당신은 사용자의 피드백을 반영하여 기존 소설 본문을 수정하는 '편집 작가 AI'입니다.\n\n[규칙]\n- 사용자의 피드백 지시를 정확히 반영하되, 전체 스토리 흐름은 최대한 유지하세요.\n- 기존 내용에서 피드백과 관련된 부분만 수정/강화하고 나머지는 보존하세요.\n- 대화는 "", 생각은 '', 특별 메세지는 [] 로 표기\n\n**IMPORTANT: You MUST write your ENTIRE response in Korean. 반드시 한국어로만 출력하세요.**`;
    userPrompt = `${context}\n[현재 에피소드 전체 내용]\n${currentText}\n\n[사용자 피드백 지시사항]\n${direction}\n\n위 에피소드 내용에서 사용자 피드백을 반영하여 수정된 전체 에피소드 내용을 출력해 주세요. 피드백과 무관한 부분은 최대한 원문을 유지하세요.`;
  } else {
    throw new Error(`Unsupported action: ${action}`);
  }

  const provider = localStorage.getItem("ai_provider") || "local";
  const apiKey = localStorage.getItem("ai_api_key") || "";
  const localModel = localStorage.getItem("ai_local_model") || "llama3";

  if (provider === "gemini") {
    if (!apiKey) throw new Error("Gemini API 키가 설정되지 않았습니다.");
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
    const payload = {
      system_instruction: { parts: { text: systemPrompt } },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.7 },
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
      temperature: 0.7,
      frequency_penalty: 0.5,
      presence_penalty: 0.5,
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
    temperature: 0.7,
    frequency_penalty: 1.0,
    presence_penalty: 1.0,
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
  return data.choices?.[0]?.message?.content?.trim() || '';
};

export function useChunkGeneration() {
  const [state, setState] = useState<ChunkState>({
    isGenerating: false,
    currentChunk: 0,
    totalChunksGenerated: 0,
    generatedText: '',
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setState({
      isGenerating: false,
      currentChunk: 0,
      totalChunksGenerated: 0,
      generatedText: '',
      error: null,
    });
  }, []);

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(prev => ({ ...prev, isGenerating: false }));
  }, []);

  const callNovelAssist = useCallback(
    async (body: Record<string, any>): Promise<string | null> => {
      cancelGeneration();
      abortRef.current = new AbortController();

      setState(prev => ({
        ...prev,
        isGenerating: true,
        error: null,
        generatedText: '',
      }));

      try {
        const result = await fetchAI(body.action as string, body, abortRef.current.signal);
        setState(prev => ({
          ...prev,
          generatedText: result,
          isGenerating: false,
          totalChunksGenerated: prev.totalChunksGenerated + 1,
          currentChunk: prev.currentChunk + 1,
        }));
        return result;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('생성이 취소되었습니다');
          return null;
        }
        console.error('AI 생성 중 오류 발생:', err);
        setState(prev => ({
          ...prev,
          error: 'AI 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
          isGenerating: false,
        }));
        return null;
      } finally {
        abortRef.current = null;
      }
    },
    [cancelGeneration]
  );

  const generateChunk = useCallback(
    async (params: {
      projectSettings: any;
      storySummaries: any[];
      characterContext?: string;
      currentText: string;
      userDirection?: string;
    }): Promise<string | null> => {
      return callNovelAssist({ action: 'continue', ...params });
    },
    [callNovelAssist]
  );

  const generateDialogue = useCallback(
    async (params: {
      projectSettings: any;
      storySummaries: any[];
      characterContext?: string;
      currentText: string;
      userDirection?: string;
    }): Promise<string | null> => {
      return callNovelAssist({ action: 'dialogue', ...params });
    },
    [callNovelAssist]
  );

  const suggestScenes = useCallback(
    async (params: {
      projectSettings: any;
      storySummaries: any[];
      currentText: string;
    }): Promise<string | null> => {
      return callNovelAssist({ action: 'suggest', ...params });
    },
    [callNovelAssist]
  );

  const rewriteSelection = useCallback(
    async (params: {
      projectSettings: any;
      selectedText: string;
      userDirection: string;
    }): Promise<string | null> => {
      return callNovelAssist({ action: 'rewrite', ...params });
    },
    [callNovelAssist]
  );

  const applyFeedback = useCallback(
    async (params: {
      projectSettings: any;
      storySummaries: any[];
      currentText: string;
      userDirection: string;
    }): Promise<string | null> => {
      return callNovelAssist({ action: 'feedback-rewrite', ...params });
    },
    [callNovelAssist]
  );

  return {
    state,
    generateChunk,
    generateDialogue,
    suggestScenes,
    rewriteSelection,
    applyFeedback,
    cancelGeneration,
    reset,
  };
}
