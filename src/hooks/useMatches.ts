import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Match, Sport } from '@/types';

interface APIMatch {
  id: string;
  sport: string;
  league: string;
  country?: string;
  homeTeam: { id: string; name: string; score?: number };
  awayTeam: { id: string; name: string; score?: number };
  odds: { home: number; draw?: number; away: number };
  startTime: string;
  isLive: boolean;
  minute?: number;
  statusCode?: string;
}

function mapAPIMatch(m: APIMatch): Match {
  return {
    id: m.id,
    sport: m.sport as Sport,
    league: m.league,
    country: m.country,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    odds: m.odds,
    startTime: new Date(m.startTime),
    isLive: m.isLive,
    minute: m.minute,
    statusCode: m.statusCode,
  };
}

// No match source connected yet — returns an empty list.
async function fetchMatches(): Promise<Match[]> {
  void supabase;
  return ([] as any[]).map(mapAPIMatch);
}

export function useMatches() {
  return useQuery({
    queryKey: ['matches'],
    queryFn: fetchMatches,
    refetchInterval: 30000, // Refresh every 30s for live data
    staleTime: 10000,
  });
}
