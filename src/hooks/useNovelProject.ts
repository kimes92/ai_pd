import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NovelProject {
  id: string;
  user_id: string;
  title: string;
  genre: string;
  status: 'in_progress' | 'completed' | 'paused';
  cover_color: string;
  created_at: string;
  updated_at: string;
  episode_count?: number;
}

const LOCAL_PROJECTS_KEY = 'novelai_projects_store';

const getLocalProjects = (): NovelProject[] => {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalProjects = (projects: NovelProject[]) => {
  try {
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Local projects save error:', e);
  }
};

export function useNovelProject() {
  const [projects, setProjects] = useState<NovelProject[]>(getLocalProjects());
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('novel_projects')
        .select('*, novel_episodes(count)')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((p: any) => ({
        ...p,
        episode_count: p.novel_episodes?.[0]?.count ?? 0,
      }));
      setProjects(formatted);
      saveLocalProjects(formatted);
    } catch (err) {
      console.warn('Supabase DB load failed, using LocalStorage fallback:', err);
      setProjects(getLocalProjects());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const getProject = useCallback(async (id: string): Promise<NovelProject | null> => {
    try {
      const { data, error } = await (supabase as any)
        .from('novel_projects')
        .select('*, novel_episodes(count)')
        .eq('id', id)
        .single();

      if (!error && data) {
        return {
          ...data,
          episode_count: data.novel_episodes?.[0]?.count ?? 0,
        } as NovelProject;
      }
    } catch {
      // Fallback
    }

    const localList = getLocalProjects();
    const found = localList.find((p) => p.id === id);
    return found || null;
  }, []);

  const createProject = useCallback(async (title: string, genre: string = ''): Promise<NovelProject> => {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'demo-user-123';

    const newProj: NovelProject = {
      id: 'proj-' + Date.now(),
      user_id: userId,
      title,
      genre: genre || '판타지',
      status: 'in_progress',
      cover_color: '#6366f1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      episode_count: 0,
    };

    try {
      const { data, error } = await (supabase as any)
        .from('novel_projects')
        .insert({ title, genre, user_id: userId })
        .select()
        .single();

      if (!error && data) {
        newProj.id = data.id;
      }
    } catch (err) {
      console.warn('Supabase insert warning, saved to LocalStorage:', err);
    }

    const current = getLocalProjects();
    const updated = [newProj, ...current.filter((p) => p.id !== newProj.id)];
    saveLocalProjects(updated);
    setProjects(updated);

    return newProj;
  }, []);

  const updateProject = useCallback(async (id: string, updates: Partial<NovelProject>) => {
    try {
      await (supabase as any)
        .from('novel_projects')
        .update(updates)
        .eq('id', id);
    } catch {
      // Ignore
    }

    const current = getLocalProjects();
    const updated = current.map((p) =>
      p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
    );
    saveLocalProjects(updated);
    setProjects(updated);
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    try {
      await (supabase as any).from('novel_projects').delete().eq('id', id);
    } catch {
      // Ignore
    }

    const current = getLocalProjects();
    const updated = current.filter((p) => p.id !== id);
    saveLocalProjects(updated);
    setProjects(updated);
  }, []);

  return { projects, isLoading, fetchProjects, getProject, createProject, updateProject, deleteProject };
}
