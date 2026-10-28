import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SportsDataType = 'scores' | 'standings' | 'news';

export interface Game {
  id: string; home_team: string; away_team: string; home_score: number | null; away_score: number | null;
  league: string; game_date: string; status: 'live' | 'final' | 'scheduled'; clock: string;
}
export interface StandingRow {
  position: number; team: string; played: number | null; won: number | null; drawn: number | null;
  lost: number | null; points: number | null; league: string;
}
export interface Article { title: string; summary: string; url: string }

interface Result {
  ok: boolean;
  error?: string;
  source?: string;
  fetched_at?: string;
  items?: unknown[];
  cached?: boolean;
  stale?: boolean;
}

export function useSportsData(sport: string, type: SportsDataType) {
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const mounted = useRef(false);
  const hasData = useRef(false);

  const load = useCallback(async (refresh = false) => {
    const id = ++requestId.current;
    if (refresh) setRefreshing(true);
    else if (!hasData.current) setLoading(true);

    try {
      const { data: response, error } = await supabase.functions.invoke('sports-data', {
        body: { sport, type, refresh },
      });

      if (!mounted.current || id !== requestId.current) return;

      if (error || !response?.ok) {
        const message = response?.error ?? error?.message ?? 'Could not load sports data.';
        // Keep the last successful response visible if a refresh fails.
        setData((previous) => previous?.ok
          ? { ...previous, stale: true, error: message }
          : { ok: false, error: message });
        return;
      }

      hasData.current = response.ok === true && Array.isArray(response.items);
      setData(response as Result);
    } catch {
      if (!mounted.current || id !== requestId.current) return;
      setData((previous) => previous?.ok
        ? { ...previous, stale: true, error: 'Refresh failed. Showing the last available data.' }
        : { ok: false, error: 'Could not reach the sports data server.' });
    } finally {
      if (mounted.current && id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [sport, type]);

  useEffect(() => {
    mounted.current = true;
    setData(null);
    hasData.current = false;
    setLoading(true);
    setRefreshing(false);
    void load();

    const interval = window.setInterval(() => {
      void load();
    }, 60_000);

    return () => {
      mounted.current = false;
      requestId.current += 1;
      window.clearInterval(interval);
    };
  }, [load]);

  return { data, loading, refreshing, refresh: () => load(true) };
}
