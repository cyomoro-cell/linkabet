import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/supabase';

export interface LiveScoreMatch {
  id: string;
  external_id: string | null;
  league: string;
  sport: string;
  home_team: { name: string };
  away_team: { name: string };
  home_score: number;
  away_score: number;
  status: string;
  match_time: string | null;
  minute: number | null;
  is_live: boolean;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  odds_status: string;
  updated_at: string;
}

const FINISHED = ['FT', 'AET', 'PEN', 'Cancelled', 'Postponed', 'Postp'];

export function useLiveScores() {
  const [matches, setMatches] = useState<LiveScoreMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data } = await db
        .from('matches')
        .select('*')
        .order('is_live', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(100);
      if (!active) return;
      setMatches(((data ?? []) as unknown as LiveScoreMatch[]).filter((m) => !FINISHED.includes(m.status)));
      setIsLoading(false);
    };
    load();

    const channel = supabase
      .channel('live-scores-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
        setMatches((prev) => {
          if (payload.eventType === 'DELETE') {
            return prev.filter((m) => m.id !== (payload.old as { id: string }).id);
          }
          const row = payload.new as unknown as LiveScoreMatch;
          if (FINISHED.includes(row.status)) return prev.filter((m) => m.id !== row.id);
          const idx = prev.findIndex((m) => m.id === row.id);
          if (idx === -1) return [row, ...prev];
          const next = [...prev];
          next[idx] = row;
          return next;
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { matches, isLoading, liveCount: matches.filter((m) => m.is_live).length };
}
