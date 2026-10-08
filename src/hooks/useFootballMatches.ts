import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SportsMatch } from '@/components/sports/MatchRow';

interface Raw {
  id: string; league: string; home: string; away: string; startTime: string; live: boolean;
  minute?: number; homeScore?: number; awayScore?: number;
  odds: { home: number; draw?: number; away: number } | null;
}

export function useFootballMatches() {
  return useQuery({
    queryKey: ['football-matches'],
    queryFn: async (): Promise<SportsMatch[]> => {
      const { data, error } = await supabase.functions.invoke('football-proxy', { body: {} });
      if (error || !data?.ok) throw new Error(data?.error ?? 'Could not load matches');
      return (data.matches as Raw[]).map((m) => ({
        id: m.id, sport: 'football', league: m.league, home: m.home, away: m.away,
        startTime: new Date(m.startTime), live: m.live, minute: m.minute,
        homeScore: m.homeScore, awayScore: m.awayScore,
        odds: m.odds ?? undefined,
      })) as SportsMatch[];
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}
