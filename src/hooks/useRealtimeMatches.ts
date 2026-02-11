import { useEffect, useRef, useState } from 'react';
import { Match } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useMatches } from './useMatches';
import { toast } from '@/hooks/use-toast';

export function useRealtimeMatches() {
  const { data: apiMatches, isLoading, error, refetch } = useMatches();
  const [matches, setMatches] = useState<Match[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevScoresRef = useRef<Map<string, { home: number; away: number }>>(new Map());

  // Sync API matches into local state
  useEffect(() => {
    if (apiMatches) {
      setMatches(apiMatches);
      // Initialize score tracking
      apiMatches.forEach(m => {
        if (m.isLive && m.homeTeam.score !== undefined && m.awayTeam.score !== undefined) {
          prevScoresRef.current.set(m.id, { home: m.homeTeam.score, away: m.awayTeam.score });
        }
      });
    }
  }, [apiMatches]);

  // Simulate live odds fluctuation + score changes with toast notifications
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setMatches(prev => prev.map(match => {
        if (!match.isLive) return match;

        const homeGoal = Math.random() > 0.995 ? 1 : 0;
        const awayGoal = Math.random() > 0.995 ? 1 : 0;
        const newHomeScore = match.homeTeam.score !== undefined ? match.homeTeam.score + homeGoal : match.homeTeam.score;
        const newAwayScore = match.awayTeam.score !== undefined ? match.awayTeam.score + awayGoal : match.awayTeam.score;

        // Fire toast on score change
        if (homeGoal) {
          toast({
            title: `⚽ GOAL! ${match.homeTeam.name}`,
            description: `${match.homeTeam.name} ${newHomeScore} - ${newAwayScore} ${match.awayTeam.name} (${match.minute}')`,
          });
        }
        if (awayGoal) {
          toast({
            title: `⚽ GOAL! ${match.awayTeam.name}`,
            description: `${match.homeTeam.name} ${newHomeScore} - ${newAwayScore} ${match.awayTeam.name} (${match.minute}')`,
          });
        }

        return {
          ...match,
          odds: {
            home: parseFloat(Math.max(1.01, match.odds.home + (Math.random() - 0.5) * 0.06).toFixed(2)),
            away: parseFloat(Math.max(1.01, match.odds.away + (Math.random() - 0.5) * 0.06).toFixed(2)),
            ...(match.odds.draw !== undefined
              ? { draw: parseFloat(Math.max(1.01, match.odds.draw + (Math.random() - 0.5) * 0.06).toFixed(2)) }
              : {}),
          },
          minute: match.minute ? match.minute + 1 : 1,
          homeTeam: { ...match.homeTeam, score: newHomeScore },
          awayTeam: { ...match.awayTeam, score: newAwayScore },
        };
      }));
    }, 3000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // More frequent API polling
  useEffect(() => {
    const livePolling = setInterval(() => refetch(), 15000);
    return () => clearInterval(livePolling);
  }, [refetch]);

  // Supabase Realtime broadcast for cross-client odds sync
  useEffect(() => {
    const channel = supabase
      .channel('live-odds')
      .on('broadcast', { event: 'odds-update' }, (payload) => {
        const update = payload.payload as { matchId: string; odds: Match['odds']; minute?: number };
        setMatches(prev => prev.map(m =>
          m.id === update.matchId
            ? { ...m, odds: update.odds, minute: update.minute ?? m.minute }
            : m
        ));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { matches, isLoading, error, liveCount: matches.filter(m => m.isLive).length };
}
