import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Shortcut {
  id: string;
  trigger: string;
  expansion: string;
}

/**
 * Loads the user's text-expansion shortcuts and provides CRUD helpers
 * plus a fast lookup map keyed by trigger.
 */
export function useShortcuts() {
  const { user } = useAuth();
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("shortcuts")
      .select("id, trigger, expansion")
      .order("trigger", { ascending: true });
    if (!error && data) setShortcuts(data as Shortcut[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Cross-instance sync: any upsert/remove in any hook instance triggers
  // every other instance to refetch so the lookup map stays current.
  useEffect(() => {
    const handler = () => {
      refresh();
    };
    window.addEventListener("shortcuts:changed", handler);
    return () => window.removeEventListener("shortcuts:changed", handler);
  }, [refresh]);

  const map = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of shortcuts) m.set(s.trigger, s.expansion);
    return m;
  }, [shortcuts]);

  const upsert = useCallback(
    async (trigger: string, expansion: string, id?: string) => {
      if (!user) return { error: new Error("not authenticated") };
      const t = trigger.trim();
      const e = expansion;
      if (!t || !e) return { error: new Error("empty") };
      if (id) {
        const { error } = await supabase
          .from("shortcuts")
          .update({ trigger: t, expansion: e })
          .eq("id", id);
        if (!error) {
          await refresh();
          window.dispatchEvent(new Event("shortcuts:changed"));
        }
        return { error };
      }
      const { error } = await supabase
        .from("shortcuts")
        .insert({ user_id: user.id, trigger: t, expansion: e });
      if (!error) {
        await refresh();
        window.dispatchEvent(new Event("shortcuts:changed"));
      }
      return { error };
    },
    [user, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("shortcuts").delete().eq("id", id);
      if (!error) {
        await refresh();
        window.dispatchEvent(new Event("shortcuts:changed"));
      }
      return { error };
    },
    [refresh],
  );

  return { shortcuts, map, loading, refresh, upsert, remove };
}

/**
 * If `text` ends with a trigger word followed by a single space,
 * replace that word with its expansion. Returns possibly-updated text.
 */
export function expandTrailingTrigger(text: string, map: Map<string, string>): string {
  if (map.size === 0) return text;
  if (!text.endsWith(" ")) return text;
  const stripped = text.slice(0, -1);
  const match = stripped.match(/(\S+)$/);
  if (!match) return text;
  const word = match[1];
  const exp = map.get(word);
  if (!exp) return text;
  return stripped.slice(0, stripped.length - word.length) + exp + " ";
}

/**
 * Expand the trailing word (no trailing space required). Used right before
 * Enter commits a line.
 */
export function expandLastWord(text: string, map: Map<string, string>): string {
  if (map.size === 0) return text;
  const match = text.match(/(\S+)$/);
  if (!match) return text;
  const word = match[1];
  const exp = map.get(word);
  if (!exp) return text;
  return text.slice(0, text.length - word.length) + exp;
}