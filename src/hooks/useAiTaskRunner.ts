import { useEffect, useRef } from "react";
import { NovelSettings, AiScheduledTask, AiNote } from "./useStoryContext";

// 로컬 AI 혹은 원격 AI 엔드포인트를 호출하기 위한 유틸리티 함수 (useChunkGeneration 내부의 fetchAI와 유사)
const runAiTask = async (task: AiScheduledTask, settings: NovelSettings) => {
  // 사용자 요청에 따라 로컬 AI(Ollama 등) 우선 연결
  const useLocalAI = true;
  let model = "llama3";
  let endpoint = "http://localhost:11434/v1/chat/completions";
  let apiKey = "local-ai-key-not-required";

  if (!useLocalAI) {
    model = "google/gemini-2.5-flash";
    endpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";
    apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  }

  // 기존 AI 노트 포함한 컨텍스트 구성
  let contextStr = `[프로젝트 시놉시스]\n${settings.synopsis}\n\n`;
  if (settings.ai_notes && settings.ai_notes.length > 0) {
    contextStr += `[기존 AI 누적 노트 맥락 (매우 중요, 이전 설정과 모순되지 않게 반영할 것)]\n`;
    settings.ai_notes.forEach(note => {
      contextStr += `- ${note.title}: ${note.content.substring(0, 500)}...\n`;
    });
  }

  const systemPrompt = `당신은 세계관 및 인물 설정을 전담하는 '설정 작가 AI'입니다.\n\n[규칙]\n- 반드시 한국어(Korean)로만 출력하세요.\n- 기존 설정 및 누적 노트와 절대 모순되지 않게 일관성을 유지하세요.\n- 출력은 설정 노트 형태(개조식 또는 설명문)로 작성하세요.`;

  const userPrompt = `${contextStr}\n\n[예약된 작업 지시사항]\n작업 타입: ${task.taskType}\n세부 지시: ${task.targetConcept}\n\n위 지시사항을 바탕으로 새로운 설정을 작성해주세요.`;

  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
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
  });

  if (!response.ok) {
    throw new Error(`AI Task failed: ${response.status}`);
  }

  const data = await response.json();
  const generatedText = data.choices?.[0]?.message?.content || "";
  return generatedText;
};

export function useAiTaskRunner(
  settings: NovelSettings | null,
  saveSettings: (s: Partial<NovelSettings>) => Promise<void>
) {
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (!settings || !settings.scheduled_tasks || settings.scheduled_tasks.length === 0) return;

    // 1분마다 스케줄 확인
    const interval = setInterval(async () => {
      if (isRunningRef.current) return;

      const now = new Date();
      const currentDay = now.getDay(); // 0(Sun) ~ 6(Sat)
      const currentHour = now.getHours().toString().padStart(2, "0");
      const currentMinute = now.getMinutes().toString().padStart(2, "0");
      const currentTimeStr = `${currentHour}:${currentMinute}`;
      const todayDateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

      const tasksToRun = settings.scheduled_tasks?.filter((task) => {
        // 오늘 요일이 포함되어 있고
        if (!task.scheduleDays.includes(currentDay)) return false;
        // 예약된 시간이 지났거나 일치하고
        if (currentTimeStr < task.scheduleTime) return false;
        // 오늘 아직 실행되지 않았다면
        const lastRunDate = task.lastRun ? new Date(task.lastRun).toISOString().split("T")[0] : "";
        if (lastRunDate === todayDateStr) return false;
        
        return true;
      });

      if (tasksToRun && tasksToRun.length > 0) {
        isRunningRef.current = true;
        let updatedTasks = [...(settings.scheduled_tasks || [])];
        let updatedNotes = [...(settings.ai_notes || [])];

        for (const task of tasksToRun) {
          try {
            console.log(`[AI Task Runner] Executing task: ${task.taskType}`);
            const resultText = await runAiTask(task, settings);
            
            if (resultText) {
              const newNote: AiNote = {
                id: `ainote_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                createdAt: new Date().toISOString(),
                title: `[예약작업] ${task.taskType} (${todayDateStr})`,
                content: resultText,
              };
              updatedNotes.push(newNote);
            }

            // 마킹
            updatedTasks = updatedTasks.map(t => 
              t.id === task.id ? { ...t, lastRun: new Date().toISOString() } : t
            );
          } catch (e) {
            console.error(`[AI Task Runner] Task failed:`, e);
          }
        }

        // 저장
        await saveSettings({
          scheduled_tasks: updatedTasks,
          ai_notes: updatedNotes,
        });

        isRunningRef.current = false;
      }
    }, 60 * 1000); // 1분 간격

    return () => clearInterval(interval);
  }, [settings, saveSettings]);
}
