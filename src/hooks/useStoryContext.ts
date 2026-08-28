import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { callAI } from '@/lib/aiHelper';

export interface CharacterInfo {
  name: string;
  appearance: string;
  personality: string;
  background: string;
  relationships: string;
  speechStyle: string;
}

export interface AiScheduledTask {
  id: string;
  taskType: string;
  scheduleDays: number[]; // 0=Sun, 1=Mon...
  scheduleTime: string; // "HH:MM"
  targetConcept: string;
  lastRun?: string;
}

export interface AiNote {
  id: string;
  createdAt: string;
  title: string;
  content: string;
}

export interface UserFeedback {
  id: string;
  episodeId: string;
  episodeTitle?: string;
  instruction: string;
  status: 'pending' | 'applied';
  createdAt: string;
}

export interface PipelineLog {
  id: string;
  step: string;
  agentName: string;
  summary: string;
  timestamp: string;
}

export interface NovelSettings {
  id: string;
  project_id: string;
  perspective: '1st' | '3rd_limited' | '3rd_omniscient';
  characters: CharacterInfo[];
  synopsis: string;
  description: string;
  writing_style: string;
  format_rules: { dialogue: string; thought: string; special: string };
  reference_text: string;
  scheduled_tasks?: AiScheduledTask[];
  ai_notes?: AiNote[];
  custom_writing_prompt?: string;
  auto_writer_enabled?: boolean;
  auto_writer_log?: PipelineLog[];
  user_feedbacks?: UserFeedback[];
}

export const DEFAULT_WEB_NOVEL_PROMPT = `[웹소설 전용 실감나는 집필 지침 - 필수 적용]
1. ⚠️ 개요/요약 금지: '1장 **주인공의 000', '주인공은 좀비를 만나서 ~' 같은 스토리보드/줄거리 요약 문장을 절대로 출력하지 마세요.
2. 대화체(""): 인물 간 대사는 큰따옴표("")로 별도 문단을 나눠 생생하고 입체적으로 작성하세요.
   예: "젠장! 내가 여기서 능력을 써버리면 승리할 수 있을까?"
3. 속마음(''): 인물의 긴박한 내면 독백과 심리 고민은 작은따옴표('')로 짧고 강렬하게 표현하세요.
   예: '이 방법밖에 없다. 더 늦으면 모두 끝이야.'
4. 상황 묘사: 인물의 시선, 떨리는 호흡, 시각/청각적 현장감을 감각적인 문장으로 표현하세요.
5. 가독성: 1~2문장마다 줄바꿈하여 모바일 웹소설 특유의 빠른 호흡과 몰입감을 유지하세요.`;

export interface StorySummary {
  id: string;
  episode_id: string;
  project_id: string;
  episode_number: number;
  events: string[];
  character_changes: Record<string, string>;
  foreshadowing: string[];
  world_state: string;
  key_dialogue: string[];
  unresolved: string[];
}

const defaultFormatRules = { dialogue: '""', thought: "''", special: '[]' };

const getLocalSettings = (projectId?: string): NovelSettings | null => {
  if (!projectId) return null;
  try {
    const raw = localStorage.getItem(`novelai_settings_${projectId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveLocalSettings = (projectId: string, settings: NovelSettings) => {
  try {
    localStorage.setItem(`novelai_settings_${projectId}`, JSON.stringify(settings));
  } catch (e) {
    console.error('Local settings save error:', e);
  }
};

export function useStoryContext(projectId?: string) {
  const [settings, setSettings] = useState<NovelSettings | null>(getLocalSettings(projectId));
  const [summaries, setSummaries] = useState<StorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSettings = useCallback(async (): Promise<NovelSettings | null> => {
    if (!projectId) return null;
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('novel_settings')
        .select('*')
        .eq('project_id', projectId)
        .single();

      if (!error && data) {
        const parsed: NovelSettings = {
          ...data,
          characters: data.characters || [],
          format_rules: data.format_rules || defaultFormatRules,
          scheduled_tasks: data.scheduled_tasks || [],
          ai_notes: data.ai_notes || [],
          custom_writing_prompt: data.custom_writing_prompt || DEFAULT_WEB_NOVEL_PROMPT,
          auto_writer_enabled: data.auto_writer_enabled || false,
          auto_writer_log: data.auto_writer_log || [],
          user_feedbacks: data.user_feedbacks || [],
        };
        setSettings(parsed);
        saveLocalSettings(projectId, parsed);
        return parsed;
      }
    } catch (err) {
      console.warn('Supabase settings load warning, using LocalStorage:', err);
    } finally {
      setIsLoading(false);
    }
    const local = getLocalSettings(projectId);
    setSettings(local);
    return local;
  }, [projectId]);

  const loadSummaries = useCallback(async (): Promise<StorySummary[]> => {
    if (!projectId) return [];
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('story_summaries')
        .select('*')
        .eq('project_id', projectId)
        .order('episode_number', { ascending: true });
      if (error) throw error;
      setSummaries(data || []);
      return data || [];
    } catch (err) {
      console.warn('Supabase summaries load warning:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const saveSettings = useCallback(async (newSettings: Partial<NovelSettings>, overrideProjectId?: string) => {
    const targetId = overrideProjectId || projectId;
    if (!targetId) return;

    const updatedSettings: NovelSettings = {
      id: settings?.id || 'sett-' + Date.now(),
      project_id: targetId,
      perspective: newSettings.perspective || settings?.perspective || '3rd_limited',
      characters: newSettings.characters || settings?.characters || [],
      synopsis: newSettings.synopsis ?? settings?.synopsis ?? '',
      description: newSettings.description ?? settings?.description ?? '',
      writing_style: newSettings.writing_style ?? settings?.writing_style ?? '',
      format_rules: newSettings.format_rules || settings?.format_rules || defaultFormatRules,
      reference_text: newSettings.reference_text ?? settings?.reference_text ?? '',
      scheduled_tasks: newSettings.scheduled_tasks ?? settings?.scheduled_tasks ?? [],
      ai_notes: newSettings.ai_notes ?? settings?.ai_notes ?? [],
      auto_writer_enabled: newSettings.auto_writer_enabled ?? settings?.auto_writer_enabled ?? false,
      auto_writer_log: newSettings.auto_writer_log ?? settings?.auto_writer_log ?? [],
      user_feedbacks: newSettings.user_feedbacks ?? settings?.user_feedbacks ?? [],
    };

    try {
      const payload = {
        ...updatedSettings,
        project_id: targetId,
      };
      const { data, error } = await (supabase as any)
        .from('novel_settings')
        .upsert(payload, { onConflict: 'project_id' })
        .select()
        .single();

      if (!error && data) {
        updatedSettings.id = data.id;
      }
    } catch (err) {
      console.warn('Supabase settings upsert warning, saved to LocalStorage:', err);
    }

    saveLocalSettings(targetId, updatedSettings);
    setSettings(updatedSettings);
  }, [projectId, settings]);

  // AI 인물 자동 생성 기능 (주인공, 시놉시스, 에피소드 유기적 분석 기반 생성)
  const generateAiCharacter = useCallback(async (instruction?: string): Promise<CharacterInfo | null> => {
    try {
      const synopsis = settings?.synopsis || '세계관 시놉시스 미지정';
      const description = settings?.description || '';
      const perspective = settings?.perspective || '3rd_limited';

      // 1. 등록된 주요 등장인물(특히 주인공)의 세부 설정 분석
      let registeredCharsText = '';
      if (settings?.characters && settings.characters.length > 0) {
        registeredCharsText = settings.characters
          .filter(c => c.name.trim() !== '')
          .map((c, idx) => `[인물 ${idx + 1}: ${c.name}]
- 외모: ${c.appearance || '미지정'}
- 성격/특징: ${c.personality || '미지정'}
- 배경/과거: ${c.background || '미지정'}
- 말투: ${c.speechStyle || '미지정'}
- 인물관계: ${c.relationships || '미지정'}`)
          .join('\n\n');
      } else {
        registeredCharsText = '등록된 기존 인물 정보 없음';
      }

      // 2. 진행된 에피소드 흐름 분석
      let episodeFlowText = '';
      if (summaries && summaries.length > 0) {
        episodeFlowText = summaries
          .map(s => `Ep.${s.episode_number}: 주요사건(${Array.isArray(s.events) ? s.events.join(', ') : ''})`)
          .join('\n');
      } else {
        episodeFlowText = '진행된 에피소드 없음';
      }

      const systemPrompt = `당신은 웹소설 인물 기획 및 세계관 구성 전담 '설정작가 AI'입니다.
작품의 시놉시스, 등록된 주인공(예: 강찬성 등)의 성격/외모/과거 배경/말투, 그리고 현재까지의 에피소드 서사 흐름을 유기적으로 깊이 있게 분석하세요.

[기획 원칙]
- 정형화되거나 상투적인 캐릭터 템플릿 생성을 절대 금지합니다.
- 주인공의 가치관이나 목적과 강렬하게 대립하거나, 심도 있게 결탁하여 서사의 위기와 갈등을 증폭시키는 입체적인 인물 1명을 기획하세요.
- 인물의 이름, 외모, 성격, 과거사, 주인공과의 관계, 시그니처 말투를 매우 세밀하고 구체적으로 작성하세요.

**반드시 아래 JSON 형식으로만 응답하세요. 다른 설명, 인사말, 마크다운 래퍼는 절대 포함하지 마세요.**
{
  "name": "이름 (한국어 웹소설에 어울리는 고유 이름)",
  "appearance": "외모 묘사 (체형, 대표 의상, 시각적 포인트 등)",
  "personality": "성격 및 고유 특성 (겉과 속의 차이, 딜레마, 약점 포함)",
  "background": "배경 및 비하인드 스토리 (주인공과의 과거 접점이나 사건의 중심 계기)",
  "relationships": "주요 등장인물(특히 주인공)과의 관계 및 서사적 역할 (갈등/조력 구도)",
  "speechStyle": "말투 및 시그니처 구어체 (말투 특징과 시그니처 대사 예시)"
}`;

      const userPrompt = `[작품 기본 정보]
- 전체 시놉시스: ${synopsis}
${description ? `- 기획 의도/설명: ${description}\n` : ''}- 시점: ${perspective}

[등록된 주요 등장인물 세부 설정]
${registeredCharsText}

[현재까지의 에피소드 사건 흐름]
${episodeFlowText}

[추가 요청 지시사항]
${instruction || '주인공의 목적 달성에 중요한 전환점이 되거나 갈등을 유발할 인물을 기획해 주세요.'}`;

      const res = await callAI(systemPrompt, userPrompt);
      const jsonMatch = res.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && parsed.name) {
          return {
            name: parsed.name,
            appearance: parsed.appearance || '',
            personality: parsed.personality || '',
            background: parsed.background || '',
            relationships: parsed.relationships || '',
            speechStyle: parsed.speechStyle || '',
          };
        }
      }
      return null;
    } catch (err) {
      console.error('AI 인물 생성 실패:', err);
      return null;
    }
  }, [settings, summaries]);

  // 메인작가 AI에 전달할 전체 컨텍스트 빌드
  const buildAiContext = useCallback(() => {
    const perspectiveMap: Record<string, string> = {
      '1st': '1인칭',
      '3rd_limited': '3인칭 제한적',
      '3rd_omniscient': '3인칭 전지적',
    };

    const projectSettings = settings ? {
      perspective: perspectiveMap[settings.perspective] || settings.perspective,
      characters: settings.characters,
      synopsis: settings.synopsis,
      writing_style: settings.writing_style,
      format_rules: settings.format_rules,
      reference_text: settings.reference_text,
      ai_notes: settings.ai_notes || [],
    } : null;

    const storySummaries = summaries.map(s => ({
      episode_number: s.episode_number,
      events: s.events,
      character_changes: s.character_changes,
      foreshadowing: s.foreshadowing,
      world_state: s.world_state,
      key_dialogue: s.key_dialogue,
      unresolved: s.unresolved,
    }));

    return { projectSettings, storySummaries };
  }, [settings, summaries]);

  return {
    settings, summaries, isLoading,
    loadSettings, loadSummaries, saveSettings, generateAiCharacter, buildAiContext,
  };
}
