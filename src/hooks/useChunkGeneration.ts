import { useState, useCallback, useRef } from 'react';
import { callAI } from '@/lib/aiHelper';
import { DEFAULT_WEB_NOVEL_PROMPT } from '@/hooks/useStoryContext';

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

  const customPrompt = projectSettings?.custom_writing_prompt || DEFAULT_WEB_NOVEL_PROMPT;

  const strictRules = `
[웹소설 전용 필수 집필 지침]
${customPrompt}

[엄격 규칙]
1. ⚠️ 개요/요약 금지: '1장 **주인공의 000', '주인공은 좀비를 만나서 ~' 같은 스토리보드, 개요 요약, 줄거리 문장을 절대로 출력하지 마세요.
2. 대화체(""): 인물 간 대사는 반드시 큰따옴표("")를 사용해 입체적인 대화 장면으로 묘사하세요.
3. 속마음(''): 인물의 내면 고민과 독백은 작은따옴표('')로 짧고 강렬하게 표기하세요.
4. 오직 실제 연재되는 한국어 순수 웹소설 본문 문장만 출력하세요. (인사말, 챕터 제목, 캐릭터 설명 등 메타 텍스트 절대로 금지)
5. 1~2문장마다 줄바꿈하여 모바일 웹소설 특유의 빠른 호흡과 높은 가독성을 유지하세요.`;

  const textSnippet = currentText.trim()
    ? `[현재 에피소드 내용]\n...${currentText.slice(-2000)}`
    : `[현재 에피소드 내용]\n(아직 작성된 본문 텍스트가 없습니다. 이번 에피소드의 시작입니다.)`;

  if (action === 'continue') {
    // Phase 1: 작가1 AI → 개연성 점검 및 스토리 아이디어 뼈대 설계
    const writer1System = `당신은 스토리 구조와 개연성을 담당하는 '작가1 AI (아이디어 닥터)'입니다.
이전 에피소드 요약 및 현재 회차 맥락을 분석하여, 다음 전개의 개연성을 점검하고 사건의 흥미진진한 핵심 아이디어 뼈대를 설계하세요.

**반드시 100% 한국어로만 개연성과 아이디어 뼈대만 출력하세요. 영문이나 메타 텍스트는 절대 금지합니다.**`;

    const writer1User = `${context}\n${textSnippet}\n${direction ? `[유저 지시사항]\n${direction}\n` : ''}다음 장면에 대한 개연성 점검과 스토리 아이디어 뼈대를 3문장으로 간결하게 설계하세요.`;

    let writer1Plan = '';
    try {
      writer1Plan = await callAI(writer1System, writer1User, signal);
    } catch {
      writer1Plan = '주인공의 결단과 인물 간 갈등을 심화시키는 서사 전개';
    }

    // Phase 2: 메인작가 AI → 3000자 순수 소설 본문 작문
    const mainWriterSystem = `당신은 총괄 집필을 담당하는 '메인작가 AI'입니다.
작가1 AI가 설계한 개연성 및 스토리 아이디어 뼈대를 바탕으로, 생생하고 몰입감 넘치는 소설 본문(~3000자)을 작문하세요.

[규칙]
- 대화는 "", 생각은 '', 특별 메세지는 [] 로 표기
- 문체 가이드는 톤과 호흡만 학습 적용${strictRules}

**절대로 영어나 설명문, 메타 텍스트를 출력하지 말고 100% 한국어 순수 소설 본문만 출력하세요.**`;

    const directionDirective = direction
      ? `\n[유저 지시 장면/지시사항 반영 (필수)]\n${direction}\n위 지시사항 및 장면 구상을 바탕으로 인물 간 대화(""), 속마음(''), 사건 묘사를 더해 완벽한 웹소설 문장 형태로 3000자 분량을 펼쳐 작성해 주세요.`
      : '';

    const mainWriterUser = `${context}\n${textSnippet}\n[작가1 AI의 개연성 & 스토리 아이디어 뼈대]\n${writer1Plan}\n${directionDirective}\n위 청사진을 바탕으로 소설 본문을 풍부하게 작문해 주세요.`;

    return await callAI(mainWriterSystem, mainWriterUser, signal);
  }

  let systemPrompt = '';
  let userPrompt = '';

  if (action === 'dialogue') {
    systemPrompt = `당신은 총괄 집필 메인작가 AI (대화 전담) 입니다. 등장인물들의 고유 말투와 성격을 생생하게 반영해 입체적인 대화 장면을 작성하세요.\n\n[규칙] 대화는 "", 생각은 '', 특별 메세지는 [] 로 표기${strictRules}\n\n**절대로 영어나 설명문을 출력하지 말고 100% 한국어 순수 소설 대화 장면만 출력하세요.**`;
    userPrompt = `${context}\n${textSnippet}\n\n[대화 상황/지시]\n${direction || '현재 등장인물들의 성격과 관계에 어울리는 생생한 대화 씬을 생성해 주세요.'}`;
  } else if (action === 'suggest') {
    systemPrompt = `당신은 스토리 구성을 돕는 '작가1 AI (스토리 닥터)'입니다.\n\n[규칙]\n- 절대로 영어나 영문 타이틀(Here are three scene ideas..., Scene Idea 1 등)을 출력하지 마세요.\n- 100% 자연스러운 한국어(Korean)로만 다음 장면 아이디어 3가지를 1), 2), 3) 번호로 구체적이고 흥미진진하게 제안하세요.`;
    userPrompt = `${context}\n${textSnippet}\n\n[지시사항]\n${direction || '스토리를 극적으로 이끌어갈 다음 장면 아이디어 3개를 제안해 주세요.'}`;
  } else if (action === 'rewrite') {
    systemPrompt = `당신은 재작성 전담 AI 입니다. 선택된 텍스트를 시놉시스와 인물 말투에 맞게 더 풍부하고 감각적인 문장으로 바꾸세요.${strictRules}\n\n**절대로 영어나 설명문을 출력하지 말고 100% 한국어 순수 소설 본문만 출력하세요.**`;
    userPrompt = `${context}\n[원본 텍스트]\n${selectedText}\n\n[지시사항]\n${direction}\n\n위 텍스트를 재작성해 주세요.`;
  } else if (action === 'feedback-rewrite') {
    systemPrompt = `당신은 사용자의 피드백을 반영하여 기존 소설 본문을 수정하는 '메인작가 AI (편집 모드)'입니다.\n\n[규칙]\n- 사용자의 피드백 지시를 정확히 반영하되, 전체 스토리 흐름은 최대한 유지하세요.\n- 기존 내용에서 피드백과 관련된 부분만 수정/강화하고 나머지는 보존하세요.\n- 대화는 "", 생각은 '', 특별 메세지는 [] 로 표기${strictRules}\n\n**절대로 영어나 설명문을 출력하지 말고 100% 한국어 순수 소설 본문만 출력하세요.**`;
    userPrompt = `${context}\n[현재 에피소드 전체 내용]\n${currentText}\n\n[사용자 피드백 지시사항]\n${direction}\n\n위 에피소드 내용에서 사용자 피드백을 반영하여 수정된 전체 에피소드 내용을 출력해 주세요. 피드백과 무관한 부분은 최대한 원문을 유지하세요.`;
  } else {
    throw new Error(`Unsupported action: ${action}`);
  }

  return await callAI(systemPrompt, userPrompt, signal);
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
        if (err.name === 'AbortError') return null;
        console.error('AI call error:', err);
        setState(prev => ({
          ...prev,
          isGenerating: false,
          error: err.message || 'AI 생성에 실패했습니다.',
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
