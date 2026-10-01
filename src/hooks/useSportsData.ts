import { useCallback, useEffect, useState } from 'react';
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

interface Result { ok: boolean; error?: string; source?: string; fetched_at?: string; items?: unknown[]; stale?: boolean }

export function useSportsData(sport: string, type: SportsDataType) {
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    const { data: res, error } = await supabase.functions.invoke('sports-data', { body: { sport, type, refresh } });
    setData(error ? { ok: false, error: 'Could not reach the server.' } : (res as Result));
    setLoading(false);
    setRefreshing(false);
  }, [sport, type]);

  useEffect(() => {
    setData(null);
    load();
    const t = setInterval(() => load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  return { data, loading, refreshing, refresh: () => load(true) };
}
