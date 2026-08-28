import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NovelSettings, PipelineLog, UserFeedback, AiNote, DEFAULT_WEB_NOVEL_PROMPT } from "./useStoryContext";
import { NovelEpisode } from "./useNovelEpisode";

/**
 * AI API를 호출하는 유틸리티 함수 (로컬, Gemini, OpenAI 지원)
 */
const callAI = async (
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
    throw new Error(`Local AI API error ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
};

/**
 * 프로젝트 컨텍스트를 조합하여 AI에게 전달할 정보를 구성
 */
const buildContext = (settings: NovelSettings, episodes: NovelEpisode[]) => {
  let ctx = `[작품 기본 정보]\n`;
  if (settings.synopsis) ctx += `- 시놉시스: ${settings.synopsis}\n`;
  if (settings.writing_style) ctx += `- 문체: ${settings.writing_style}\n`;
  if (settings.perspective) ctx += `- 시점: ${settings.perspective}\n`;

  if (settings.characters && settings.characters.length > 0) {
    ctx += `\n[주요 등장인물]\n`;
    settings.characters.forEach((c) => {
      ctx += `■ ${c.name}: 외모(${c.appearance || "미지정"}), 성격(${c.personality || "미지정"}), 말투(${c.speechStyle || "미지정"}), 관계(${c.relationships || c.background || "미지정"})\n`;
    });
  }

  // AI 노트 맥락 포함 (이전 설정 노트들을 참고)
  if (settings.ai_notes && settings.ai_notes.length > 0) {
    ctx += `\n[누적 AI 설정 노트 (맥락 유지 필수)]\n`;
    settings.ai_notes.slice(-10).forEach((note) => {
      ctx += `- ${note.title}: ${note.content.substring(0, 300)}...\n`;
    });
  }

  // 이전 에피소드 요약 포함
  if (episodes.length > 0) {
    ctx += `\n[이전 에피소드 요약]\n`;
    episodes.forEach((ep) => {
      if (ep.content) {
        ctx += `Ep.${ep.episode_number} "${ep.title}": ${ep.content.substring(0, 500)}...\n`;
      }
    });
  }

  return ctx;
};

export interface AutoWriterState {
  isAutoMode: boolean;
  currentStep: string; // idle / writing / reviewing / revising / updating-arcs / applying-feedback / paused
  currentEpisodeId: string | null;
  pipelineLog: PipelineLog[];
  isProcessing: boolean;
}

export function useAutoWriterEngine(
  settings: NovelSettings | null,
  saveSettings: (s: Partial<NovelSettings>) => Promise<void>,
  episodes: NovelEpisode[],
  updateEpisode: (id: string, updates: Partial<NovelEpisode>) => Promise<void>,
  createEpisode: (title?: string) => Promise<NovelEpisode>
) {
  const [autoState, setAutoState] = useState<AutoWriterState>({
    isAutoMode: false,
    currentStep: "idle",
    currentEpisodeId: null,
    pipelineLog: [],
    isProcessing: false,
  });

  const abortRef = useRef<AbortController | null>(null);
  const isRunningRef = useRef(false);

  // 로그 추가 헬퍼
  const addLog = useCallback((step: string, agentName: string, summary: string) => {
    const log: PipelineLog = {
      id: `log_${Date.now()}`,
      step,
      agentName,
      summary,
      timestamp: new Date().toISOString(),
    };
    setAutoState((prev) => ({
      ...prev,
      pipelineLog: [...prev.pipelineLog.slice(-50), log], // 최근 50개만 유지
    }));

    // settings에도 영속 저장
    if (settings) {
      const updatedLog = [...(settings.auto_writer_log || []).slice(-50), log];
      saveSettings({ auto_writer_log: updatedLog });
    }
  }, [settings, saveSettings]);

  /**
   * 핵심 파이프라인: 한 사이클 실행
   * Step 1: 메인작가 AI → 이어쓰기
   * Step 2: 작가1 AI → 개연성 검토
   * Step 3: 작가2 AI → 인물 아크 업데이트
   * Step 4: 결과 저장
   */
  const runPipelineCycle = useCallback(async () => {
    if (!settings || isRunningRef.current) return;
    isRunningRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 현재 작업할 에피소드 결정 (마지막 에피소드 또는 새로 생성)
      let targetEpisode = episodes[episodes.length - 1];

      if (!targetEpisode || targetEpisode.status === "finalized") {
        // 새 에피소드 생성
        setAutoState((prev) => ({ ...prev, currentStep: "writing", isProcessing: true }));
        addLog("create", "시스템", `새로운 에피소드 ${episodes.length + 1} 생성 중...`);
        targetEpisode = await createEpisode(`에피소드 ${episodes.length + 1}`);
      }

      setAutoState((prev) => ({
        ...prev,
        currentEpisodeId: targetEpisode.id,
        currentStep: "writing",
        isProcessing: true,
      }));

      const context = buildContext(settings, episodes);

      // ──────── STEP 1: 작가2 AI & 작가1 AI ─ 인물관계 분석 및 플롯 구조 설계 ────────
      addLog("step1", "작가2 & 작가1 AI", "인물 관계를 분석하고 에피소드 개연성/구조를 설계 중...");

      const customPrompt = settings?.custom_writing_prompt || DEFAULT_WEB_NOVEL_PROMPT;

      const strictRules = `
[웹소설 전용 필수 집필 지침]
${customPrompt}

[엄격 규칙]
1. ⚠️ 개요/요약 금지: '1장 **주인공의 000', '주인공은 좀비를 만나서 ~' 같은 스토리보드, 개요 요약, 줄거리 문장을 절대로 출력하지 마세요.
2. 대화체(""): 인물 간 대사는 반드시 큰따옴표("")를 사용해 입체적인 대화 장면으로 묘사하세요.
3. 속마음(''): 인물의 내면 고민과 독백은 작은따옴표('')로 짧고 강렬하게 표기하세요.
4. 오직 실제 연재되는 한국어 순수 웹소설 본문 문장만 출력하세요. (인사말, 챕터 제목, 캐릭터 설명 등 메타 텍스트 절대로 금지)
5. 1~2문장마다 줄바꿈하여 모바일 웹소설 특유의 빠른 호흡과 높은 가독성을 유지하세요.`;

      // 1-A. 작가2 AI: 인물 관계 및 구도 분석
      const writer2System = `당신은 인물 관계 및 누적 설정을 총괄하는 '작가2 AI (설정 관리자)'입니다.
이전 에피소드들과 등장인물 설정을 분석하여, 이번 에피소드에서 강조되어야 할 인물 간 대립 구도, 관계 변화, 감정 상태를 요약하세요.

**반드시 100% 한국어로 3문장 이내로 간결히 요약하세요.**`;
      const writer2User = `${context}\n이번 에피소드에서 다룰 인물 간 대립 구도와 관계 변화를 분석하세요.`;
      
      let writer2Analysis = '';
      try {
        writer2Analysis = await callAI(writer2System, writer2User, controller.signal);
      } catch {
        writer2Analysis = '주인공과 주변 인물 간의 관계 심화 및 갈등 조성';
      }

      // 1-B. 작가1 AI: 개연성 및 플롯 구조 설계
      const writer1DesignSystem = `당신은 스토리 개연성과 플롯 구성을 담당하는 '작가1 AI (스토리 닥터)'입니다.
전체 시놉시스와 작가2 AI의 인물관계 분석을 바탕으로, 이번 에피소드의 개연성과 핵심 사건 아이디어/구조(플롯 뼈대)를 설계하세요.

**반드시 100% 한국어로 개연성 및 플롯 구조 뼈대만 출력하세요.**`;
      const writer1DesignUser = `${context}\n[작가2 AI의 인물관계 분석]\n${writer2Analysis}\n\n이번 에피소드의 개연성을 고려한 스토리 아이디어 구조 뼈대를 설계하세요.`;

      let writer1Blueprint = '';
      try {
        writer1Blueprint = await callAI(writer1DesignSystem, writer1DesignUser, controller.signal);
      } catch {
        writer1Blueprint = '사건의 서막 -> 인물 간 갈등 발생 -> 예측 불가능한 반전 계기';
      }

      addLog("step1-done", "작가1 & 작가2 AI", "인물구도 및 개연성 스토리 뼈대 설계 완료!");

      // ──────── STEP 2: 메인작가 AI ─ 전체 소설 본문 작문 (~3000자) ────────
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
      setAutoState((prev) => ({ ...prev, currentStep: "writing" }));
      addLog("step2", "메인작가 AI", "작가1, 2의 구조를 바탕으로 3000자 본문 작문 중...");

      const mainWriterSystem = `당신은 총괄 집필을 담당하는 '메인작가 AI'입니다.
작가2 AI의 인물관계 분석과 작가1 AI의 스토리 청사진을 바탕으로, 생생하고 몰입감 넘치는 소설 본문(~3000자)을 작문하세요.

[규칙]
- 대화는 "", 생각은 '', 특별 메세지는 [] 로 표기
- 문체 가이드는 톤과 호흡만 학습 적용${strictRules}

**반드시 한국어(Korean) 순수 소설 본문만 출력하세요.**`;

      const currentContent = targetEpisode.content || "";
      const recentContent = currentContent.length > 2000 ? currentContent.slice(-2000) : currentContent;

      // 사용자 피드백이 있으면 반영
      const pendingFeedbacks = (settings.user_feedbacks || []).filter(
        (f) => f.status === "pending" && f.episodeId === targetEpisode.id
      );
      let feedbackInstruction = "";
      if (pendingFeedbacks.length > 0) {
        feedbackInstruction = `\n[사용자 피드백 반영 요청]\n`;
        pendingFeedbacks.forEach((f) => {
          feedbackInstruction += `- ${f.instruction}\n`;
        });
        feedbackInstruction += `위 피드백을 자연스럽게 반영하며 이어쓰세요.\n`;
      }

      const mainWriterUser = `${context}\n[현재 에피소드 내용]\n...${recentContent}\n[작가2 AI 인물관계 분석]\n${writer2Analysis}\n[작가1 AI 플롯 청사진]\n${writer1Blueprint}\n${feedbackInstruction}\n위 청사진과 본문을 바탕으로 약 3000자 분량의 소설 이야기를 작성해 주세요.`;

      const generatedDraft = await callAI(mainWriterSystem, mainWriterUser, controller.signal);

      if (!generatedDraft) {
        addLog("error", "메인작가 AI", "초안 텍스트 생성 실패");
        return;
      }

      addLog("step2-done", "메인작가 AI", `${generatedDraft.length}자 초안 작문 완료!`);

      // ──────── STEP 3: 작가1 AI ─ 개연성 및 OOC 검수 ────────
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");

      setAutoState((prev) => ({ ...prev, currentStep: "reviewing" }));
      addLog("step3", "작가1 AI", "개연성 및 인물 일관성(OOC) 검수 중...");

      const reviewerSystem = `당신은 스토리 개연성과 일관성을 검토하는 '작가1 AI (스토리 닥터)'입니다.\n\n[규칙]\n- 이전 에피소드 내용 및 설정과 방금 작성된 초안의 모순(OOC, 설정 오류 등)을 찾아내세요.\n- 인물의 말투, 성격, 관계가 설정과 일치하는지 검토하세요.\n- 비판적이고 날카로운 시각으로 분석 결과를 리포트 형식으로 출력하세요.\n\n**반드시 100% 한국어(Korean)로만 검수 리포트를 출력하세요.**`;

      const reviewerUser = `${context}\n[방금 작성된 초안]\n${generatedDraft}\n\n위 초안의 개연성, 인물 일관성, 스토리 흐름을 검토하고 구체적인 수정 방향(피드백)을 제공해 주세요.`;

      const reviewResult = await callAI(reviewerSystem, reviewerUser, controller.signal);
      addLog("step3-done", "작가1 AI", reviewResult ? `검수 완료: ${reviewResult.substring(0, 80)}...` : "검수 완료");

      // ──────── STEP 4: 메인작가 AI ─ 원고 교정 및 보완 (Revision) ────────
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");

      setAutoState((prev) => ({ ...prev, currentStep: "revising" }));
      addLog("step4", "메인작가 AI", "작가1의 검수 결과를 바탕으로 원고 교정 및 보완 중...");

      const revisionSystem = `당신은 작가1 AI의 검수 피드백을 반영하여 원본을 고쳐쓰는 '메인작가 AI'입니다.\n\n[규칙]\n- 피드백에서 지적된 개연성 오류나 OOC(캐릭터 붕괴)를 완벽히 수정하세요.\n- 문체 가이드는 톤과 호흡만 학습하며 절대 복사하지 마세요.${strictRules}\n\n**반드시 한국어(Korean) 순수 소설 본문만 출력하세요.**`;
      
      const revisionUser = `[원본 초안]\n${generatedDraft}\n\n[작가1 AI 검수 피드백]\n${reviewResult}\n\n위 피드백을 반영하여 원본 초안을 수정하고 보완한 최종 텍스트를 작성해 주세요.`;

      const revisedText = await callAI(revisionSystem, revisionUser, controller.signal);
      const finalGeneratedText = revisedText || generatedDraft;

      addLog("step4-done", "메인작가 AI", `최종 원고 교정 완료! (${finalGeneratedText.length}자)`);

      // 에피소드에 최종 내용 추가
      const updatedContent = currentContent ? currentContent + "\n\n" + finalGeneratedText : finalGeneratedText;
      await updateEpisode(targetEpisode.id, { content: updatedContent });

      // ──────── STEP 5: 작가2 AI ─ 인물별 스토리 아크 및 관계도 갱신 ────────
      if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");

      setAutoState((prev) => ({ ...prev, currentStep: "updating-arcs" }));
      addLog("step5", "작가2 AI", "새 원고를 바탕으로 인물별 스토리 아크 및 관계도 갱신 중...");

      const arcWriterSystem = `당신은 인물별 스토리 아크를 추적하는 '설정관리 AI'입니다.\n\n[규칙]\n- 새로 확정된 텍스트에서 각 인물의 감정 변화, 관계 변화, 새로운 정보를 추출하세요.\n- 설정 노트 형태로 간결하게 정리하세요.\n\n**IMPORTANT: 반드시 한국어(Korean)로만 출력하세요.**`;

      const arcWriterUser = `${context}\n[방금 확정된 텍스트]\n${finalGeneratedText}\n\n위 텍스트에서 인물별 변화를 추출하여 아크 업데이트 노트를 작성해 주세요.`;

      const arcUpdate = await callAI(arcWriterSystem, arcWriterUser, controller.signal);
      addLog("step4-done", "설정관리 AI", arcUpdate ? `아크 업데이트 완료: ${arcUpdate.substring(0, 100)}...` : "아크 업데이트 완료");

      // ──────── STEP 4: 결과 저장 ────────
      // 작가1, 작가2의 결과를 AI 노트로 저장
      const newNotes: AiNote[] = [];
      if (reviewResult) {
        newNotes.push({
          id: `ainote_review_${Date.now()}`,
          createdAt: new Date().toISOString(),
          title: `[검수작가 피드백] Ep.${targetEpisode.episode_number}`,
          content: reviewResult,
        });
      }
      if (arcUpdate) {
        newNotes.push({
          id: `ainote_arc_${Date.now()}`,
          createdAt: new Date().toISOString(),
          title: `[설정관리 아크] Ep.${targetEpisode.episode_number}`,
          content: arcUpdate,
        });
      }

      // 피드백 처리 완료 마킹
      let updatedFeedbacks = settings.user_feedbacks || [];
      if (pendingFeedbacks.length > 0) {
        updatedFeedbacks = updatedFeedbacks.map((f) =>
          pendingFeedbacks.some((pf) => pf.id === f.id) ? { ...f, status: "applied" as const } : f
        );
        addLog("feedback", "시스템", `사용자 피드백 ${pendingFeedbacks.length}건 반영 완료`);
      }

      await saveSettings({
        ai_notes: [...(settings.ai_notes || []), ...newNotes],
        user_feedbacks: updatedFeedbacks,
      });

      addLog("done", "시스템", `파이프라인 1사이클 완료! (Ep.${targetEpisode.episode_number}에 ${finalGeneratedText.length}자 추가)`);

      setAutoState((prev) => ({
        ...prev,
        currentStep: "idle",
        isProcessing: false,
      }));
    } catch (err: any) {
      if (err.name === "AbortError") {
        addLog("stopped", "시스템", "자동화가 중지되었습니다.");
      } else {
        console.error("[AutoWriter] Pipeline error:", err);
        addLog("error", "시스템", `오류 발생: ${err.message}`);
      }
      setAutoState((prev) => ({
        ...prev,
        currentStep: "idle",
        isProcessing: false,
      }));
    } finally {
      isRunningRef.current = false;
      abortRef.current = null;
    }
  }, [settings, episodes, saveSettings, updateEpisode, createEpisode, addLog]);

  // 자동화 ON/OFF 토글
  const toggleAutoMode = useCallback(async () => {
    const newState = !autoState.isAutoMode;
    setAutoState((prev) => ({ ...prev, isAutoMode: newState }));

    if (newState) {
      addLog("start", "시스템", "🚀 AI 자동화 모드 ON — 파이프라인 시작합니다.");
      await saveSettings({ auto_writer_enabled: true });
    } else {
      // 중지
      abortRef.current?.abort();
      addLog("stop", "시스템", "⏹ AI 자동화 모드 OFF — 파이프라인을 정지합니다.");
      await saveSettings({ auto_writer_enabled: false });
      setAutoState((prev) => ({
        ...prev,
        currentStep: "idle",
        isProcessing: false,
      }));
    }
  }, [autoState.isAutoMode, addLog, saveSettings]);

  // 수동으로 1사이클 실행
  const runOneCycle = useCallback(async () => {
    if (autoState.isProcessing) return;
    await runPipelineCycle();
  }, [autoState.isProcessing, runPipelineCycle]);

  // 자동 모드일 때 반복 실행 (30초 간격)
  const runPipelineRef = useRef(runPipelineCycle);
  useEffect(() => {
    runPipelineRef.current = runPipelineCycle;
  }, [runPipelineCycle]);

  useEffect(() => {
    if (!autoState.isAutoMode) return;

    // 즉시 1사이클 실행
    if (!isRunningRef.current) {
      runPipelineRef.current();
    }

    const interval = setInterval(() => {
      if (!isRunningRef.current && autoState.isAutoMode) {
        runPipelineRef.current();
      }
    }, 30000); // 30초마다 체크

    return () => clearInterval(interval);
  }, [autoState.isAutoMode]); // 의존성에서 settings 제거하여 무한루프 방지

  // 사용자 피드백 추가
  const addFeedback = useCallback(
    async (episodeId: string, instruction: string, episodeTitle?: string) => {
      if (!settings) return;
      const fb: UserFeedback = {
        id: `fb_${Date.now()}`,
        episodeId,
        episodeTitle,
        instruction,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      const updated = [...(settings.user_feedbacks || []), fb];
      await saveSettings({ user_feedbacks: updated });
      addLog("feedback-add", "사용자", `피드백 추가: "${instruction.substring(0, 50)}..."`);
    },
    [settings, saveSettings, addLog]
  );

  // 피드백 즉시 적용 (자동화 외에서도 사용 가능)
  const applyFeedbackNow = useCallback(
    async (feedbackId: string) => {
      if (!settings) return;
      const fb = (settings.user_feedbacks || []).find((f) => f.id === feedbackId);
      if (!fb || fb.status === "applied") return;

      const targetEp = episodes.find((ep) => ep.id === fb.episodeId);
      if (!targetEp || !targetEp.content) return;

      setAutoState((prev) => ({ ...prev, currentStep: "applying-feedback", isProcessing: true }));
      addLog("feedback-apply", "편집 작가 AI", `피드백 즉시 반영 중: "${fb.instruction.substring(0, 50)}..."`);

      try {
        const context = buildContext(settings, episodes);
        const system = `당신은 사용자의 피드백을 반영하여 기존 소설 본문을 수정하는 '편집 작가 AI'입니다.\n\n[규칙]\n- 사용자의 피드백 지시를 정확히 반영하되, 전체 스토리 흐름은 최대한 유지하세요.\n- 기존 내용에서 피드백과 관련된 부분만 수정/강화하고 나머지는 보존하세요.\n- 대화는 "", 생각은 '', 특별 메세지는 [] 로 표기\n\n**IMPORTANT: 반드시 한국어(Korean)로만 출력하세요.**`;
        const user = `${context}\n[현재 에피소드 전체 내용]\n${targetEp.content}\n\n[사용자 피드백 지시사항]\n${fb.instruction}\n\n위 에피소드 내용에서 사용자 피드백을 반영하여 수정된 전체 에피소드 내용을 출력해 주세요. 피드백과 무관한 부분은 최대한 원문을 유지하세요.`;

        const result = await callAI(system, user);
        if (result) {
          await updateEpisode(targetEp.id, { content: result });
          const updatedFb = (settings.user_feedbacks || []).map((f) =>
            f.id === feedbackId ? { ...f, status: "applied" as const } : f
          );
          await saveSettings({ user_feedbacks: updatedFb });
          addLog("feedback-done", "편집 작가 AI", `피드백 반영 완료! (Ep.${targetEp.episode_number})`);
        }
      } catch (err: any) {
        addLog("error", "편집 작가 AI", `피드백 반영 실패: ${err.message}`);
      } finally {
        setAutoState((prev) => ({ ...prev, currentStep: "idle", isProcessing: false }));
      }
    },
    [settings, episodes, saveSettings, updateEpisode, addLog]
  );

  return {
    autoState,
    toggleAutoMode,
    runOneCycle,
    addFeedback,
    applyFeedbackNow,
  };
}
