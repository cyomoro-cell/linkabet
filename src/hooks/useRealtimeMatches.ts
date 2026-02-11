import { useEffect, useRef, useCallback, useState } from 'react';
import { Match } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useMatches } from './useMatches';

/**
 * Extends useMatches with:
 * 1. More frequent polling for live matches (every 10s)
 * 2. Client-side odds fluctuation simulation for live matches
 * 3. Supabase Realtime broadcast channel for cross-client sync
 */
export function useRealtimeMatches() {
  const { data: apiMatches, isLoading, error, refetch } = useMatches();
  const [matches, setMatches] = useState<Match[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync API matches into local state
  useEffect(() => {
    if (apiMatches) {
      setMatches(apiMatches);
    }
  }, [apiMatches]);

  // Simulate live odds fluctuation every 3 seconds for live matches
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setMatches(prev => prev.map(match => {
        if (!match.isLive) return match;

        // Small random odds shift ±0.01–0.05
        const shift = () => {
          const delta = (Math.random() - 0.5) * 0.1;
          return parseFloat(Math.max(1.01, delta).toFixed(2));
        };

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
          // Occasionally update scores for live matches
          homeTeam: {
            ...match.homeTeam,
            score: match.homeTeam.score !== undefined
              ? match.homeTeam.score + (Math.random() > 0.995 ? 1 : 0)
              : match.homeTeam.score,
          },
          awayTeam: {
            ...match.awayTeam,
            score: match.awayTeam.score !== undefined
              ? match.awayTeam.score + (Math.random() > 0.995 ? 1 : 0)
              : match.awayTeam.score,
          },
        };
      }));
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // More frequent API polling for live data
  useEffect(() => {
    const livePolling = setInterval(() => {
      refetch();
    }, 15000);

    return () => clearInterval(livePolling);
  }, [refetch]);

  // Subscribe to Supabase Realtime broadcast channel
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    matches,
    isLoading,
    error,
    liveCount: matches.filter(m => m.isLive).length,
  };
}
