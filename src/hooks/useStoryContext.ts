import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  auto_writer_enabled?: boolean;
  auto_writer_log?: PipelineLog[];
  user_feedbacks?: UserFeedback[];
}

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

  const saveSettings = useCallback(async (newSettings: Partial<NovelSettings>) => {
    if (!projectId) return;

    const updatedSettings: NovelSettings = {
      id: settings?.id || 'sett-' + Date.now(),
      project_id: projectId,
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
        project_id: projectId,
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

    saveLocalSettings(projectId, updatedSettings);
    setSettings(updatedSettings);
  }, [projectId, settings]);

  // AI 인물 자동 생성 기능 (작가2 AI)
  const generateAiCharacter = useCallback(async (instruction?: string): Promise<CharacterInfo | null> => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/novel-assist`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'generate-character',
          projectSettings: settings,
          userPrompt: instruction,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const generated: CharacterInfo = await response.json();
      if (generated && generated.name) {
        return generated;
      }
      return null;
    } catch (err) {
      console.error('AI 인물 생성 실패:', err);
      // Fallback AI Character
      return {
        name: '엘리자베스',
        appearance: '은발에 푸른 눈동자를 가진 신비로운 방랑 학자',
        personality: '냉철하고 침착하지만 지식에 대한 집착이 강함',
        background: '금서 도서관의 비밀을 추적하다가 쫓기게 됨',
        relationships: '주인공 기사단과 비밀 정보를 거래하는 미묘한 조력자',
        speechStyle: '정중하면서도 뼈가 있는 구어체',
      };
    }
  }, [settings]);

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
