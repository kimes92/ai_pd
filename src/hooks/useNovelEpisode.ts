import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NovelEpisode {
  id: string;
  project_id: string;
  episode_number: number;
  title: string;
  content: string;
  char_count: number;
  status: 'draft' | 'corrected' | 'finalized';
  ai_generated_ratio: number;
  created_at: string;
  updated_at: string;
}

const getLocalEpisodes = (projectId?: string): NovelEpisode[] => {
  if (!projectId) return [];
  try {
    const raw = localStorage.getItem(`novelai_episodes_${projectId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalEpisodes = (projectId: string, episodes: NovelEpisode[]) => {
  try {
    localStorage.setItem(`novelai_episodes_${projectId}`, JSON.stringify(episodes));
  } catch (e) {
    console.error('Local episodes save error:', e);
  }
};

export function useNovelEpisode(projectId?: string) {
  const [episodes, setEpisodes] = useState<NovelEpisode[]>(getLocalEpisodes(projectId));
  const [currentEpisode, setCurrentEpisode] = useState<NovelEpisode | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEpisodes = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('novel_episodes')
        .select('*')
        .eq('project_id', projectId)
        .order('episode_number', { ascending: true });

      if (error) throw error;
      setEpisodes(data || []);
      saveLocalEpisodes(projectId, data || []);
    } catch (err) {
      console.warn('Supabase episodes fetch warning, using LocalStorage:', err);
      setEpisodes(getLocalEpisodes(projectId));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) fetchEpisodes();
  }, [projectId, fetchEpisodes]);

  const loadEpisode = useCallback(async (id: string): Promise<NovelEpisode | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('novel_episodes')
        .select('*')
        .eq('id', id)
        .single();
      if (!error && data) {
        setCurrentEpisode(data);
        return data;
      }
    } catch {
      // Fallback
    }

    const localList = getLocalEpisodes(projectId);
    const found = localList.find((e) => e.id === id);
    if (found) setCurrentEpisode(found);
    setIsLoading(false);
    return found || null;
  }, [projectId]);

  const getNextEpisodeNumber = useCallback((): number => {
    const list = episodes.length > 0 ? episodes : getLocalEpisodes(projectId);
    if (list.length === 0) return 1;
    return Math.max(...list.map((e) => e.episode_number)) + 1;
  }, [episodes, projectId]);

  const createEpisode = useCallback(async (title?: string): Promise<NovelEpisode> => {
    if (!projectId) throw new Error('프로젝트 ID가 필요합니다');
    const episodeNumber = getNextEpisodeNumber();
    const newEp: NovelEpisode = {
      id: 'ep-' + Date.now(),
      project_id: projectId,
      episode_number: episodeNumber,
      title: title || `에피소드 ${episodeNumber}`,
      content: '',
      char_count: 0,
      status: 'draft',
      ai_generated_ratio: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await (supabase as any)
        .from('novel_episodes')
        .insert({
          project_id: projectId,
          episode_number: episodeNumber,
          title: newEp.title,
          content: '',
          char_count: 0,
          status: 'draft',
        })
        .select()
        .single();

      if (!error && data) {
        newEp.id = data.id;
      }
    } catch (err) {
      console.warn('Supabase episode insert warning, saved locally:', err);
    }

    const current = getLocalEpisodes(projectId);
    const updated = [...current, newEp];
    saveLocalEpisodes(projectId, updated);
    setEpisodes(updated);
    setCurrentEpisode(newEp);

    return newEp;
  }, [projectId, getNextEpisodeNumber]);

  const updateEpisode = useCallback(async (id: string, updates: Partial<NovelEpisode>) => {
    if (!projectId) return;
    const updatesWithCount = { ...updates };
    if (updates.content !== undefined) {
      updatesWithCount.char_count = updates.content.length;
    }

    try {
      await (supabase as any)
        .from('novel_episodes')
        .update(updatesWithCount)
        .eq('id', id);
    } catch {
      // Ignore
    }

    const current = getLocalEpisodes(projectId);
    const updated = current.map((e) =>
      e.id === id ? { ...e, ...updatesWithCount, updated_at: new Date().toISOString() } : e
    );
    saveLocalEpisodes(projectId, updated);
    setEpisodes(updated);
    if (currentEpisode?.id === id) {
      setCurrentEpisode((prev) => (prev ? { ...prev, ...updatesWithCount } : null));
    }
  }, [projectId, currentEpisode]);

  const deleteEpisode = useCallback(async (id: string) => {
    if (!projectId) return;
    try {
      await (supabase as any).from('novel_episodes').delete().eq('id', id);
    } catch {
      // Ignore
    }

    const current = getLocalEpisodes(projectId);
    const updated = current.filter((e) => e.id !== id);
    saveLocalEpisodes(projectId, updated);
    setEpisodes(updated);
    if (currentEpisode?.id === id) setCurrentEpisode(null);
  }, [projectId, currentEpisode]);

  return {
    episodes,
    isLoading,
    currentEpisode,
    fetchEpisodes,
    loadEpisode,
    createEpisode,
    updateEpisode,
    deleteEpisode,
    getNextEpisodeNumber,
  };
}
