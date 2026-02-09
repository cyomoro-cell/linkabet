import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Match, Sport } from '@/types';

interface APIMatch {
  id: string;
  sport: string;
  league: string;
  homeTeam: { id: string; name: string; score?: number };
  awayTeam: { id: string; name: string; score?: number };
  odds: { home: number; draw?: number; away: number };
  startTime: string;
  isLive: boolean;
  minute?: number;
}

function mapAPIMatch(m: APIMatch): Match {
  return {
    id: m.id,
    sport: m.sport as Sport,
    league: m.league,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    odds: m.odds,
    startTime: new Date(m.startTime),
    isLive: m.isLive,
    minute: m.minute,
  };
}

async function fetchMatches(): Promise<Match[]> {
  const { data, error } = await supabase.functions.invoke('fetch-matches');
  if (error) throw error;
  return (data?.matches || []).map(mapAPIMatch);
}

export function useMatches() {
  return useQuery({
    queryKey: ['matches'],
    queryFn: fetchMatches,
    refetchInterval: 30000, // Refresh every 30s for live data
    staleTime: 10000,
  });
}
