import { useEffect, useRef, useState, useCallback } from 'react';
import { Match, Sport } from '@/types';
import { db } from '@/lib/supabase';
import { supabase } from '@/integrations/supabase/client';
import { useMatches } from './useMatches';
import { toast } from '@/hooks/use-toast';

interface DBMatch {
  id: string;
  sport: string;
  league: string;
  home_team: { id: string; name: string; score?: number };
  away_team: { id: string; name: string; score?: number };
  odds: { home: number; draw?: number; away: number };
  start_time: string;
  is_live: boolean;
  minute: number | null;
  updated_at: string;
}

function dbToMatch(row: DBMatch): Match {
  return {
    id: row.id,
    sport: row.sport as Sport,
    league: row.league,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    odds: row.odds,
    startTime: new Date(row.start_time),
    isLive: row.is_live,
    minute: row.minute ?? undefined,
  };
}

export function useRealtimeMatches() {
  const { data: apiMatches, isLoading, error, refetch } = useMatches();
  const [matches, setMatches] = useState<Match[]>([]);
  const prevScoresRef = useRef<Map<string, { home: number; away: number }>>(new Map());

  // Load initial matches from DB
  useEffect(() => {
    const loadFromDB = async () => {
      const { data } = await db
        .from('matches')
        .select('*')
        .order('is_live', { ascending: false })
        .order('start_time', { ascending: true })
        .limit(100);

      if (data && data.length > 0) {
        const parsed = (data as unknown as DBMatch[]).map(dbToMatch);
        setMatches(parsed);
        parsed.forEach(m => {
          if (m.isLive && m.homeTeam.score !== undefined && m.awayTeam.score !== undefined) {
            prevScoresRef.current.set(m.id, { home: m.homeTeam.score, away: m.awayTeam.score });
          }
        });
      }
    };
    loadFromDB();
  }, []);

  // Fallback: also use API matches if DB is empty
  useEffect(() => {
    if (apiMatches && apiMatches.length > 0) {
      setMatches(prev => {
        if (prev.length === 0) return apiMatches;
        // Merge: prefer DB data but fill gaps
        const ids = new Set(prev.map(m => m.id));
        const newOnes = apiMatches.filter(m => !ids.has(m.id));
        return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
      });
    }
  }, [apiMatches]);

  // Subscribe to Realtime changes on matches table
  useEffect(() => {
    const channel = supabase
      .channel('db-matches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as DBMatch;
            const updated = dbToMatch(row);

            setMatches(prev => {
              const idx = prev.findIndex(m => m.id === updated.id);

              // Score change detection for toast
              if (updated.isLive && updated.homeTeam.score !== undefined && updated.awayTeam.score !== undefined) {
                const prevScore = prevScoresRef.current.get(updated.id);
                if (prevScore) {
                  if (updated.homeTeam.score > prevScore.home) {
                    toast({
                      title: `⚽ GOAL! ${updated.homeTeam.name}`,
                      description: `${updated.homeTeam.name} ${updated.homeTeam.score} - ${updated.awayTeam.score} ${updated.awayTeam.name} (${updated.minute}')`,
                    });
                  }
                  if (updated.awayTeam.score > prevScore.away) {
                    toast({
                      title: `⚽ GOAL! ${updated.awayTeam.name}`,
                      description: `${updated.homeTeam.name} ${updated.homeTeam.score} - ${updated.awayTeam.score} ${updated.awayTeam.name} (${updated.minute}')`,
                    });
                  }
                }
                prevScoresRef.current.set(updated.id, { home: updated.homeTeam.score, away: updated.awayTeam.score });
              }

              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updated;
                return next;
              }
              return [updated, ...prev];
            });
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as any).id;
            setMatches(prev => prev.filter(m => m.id !== id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Periodic edge function call to refresh data (triggers DB upsert → Realtime)
  useEffect(() => {
    // Initial fetch
    refetch();

    const polling = setInterval(() => {
      refetch();
    }, 15000); // Every 15s triggers the edge function which upserts into DB

    return () => clearInterval(polling);
  }, [refetch]);

  return {
    matches,
    isLoading: isLoading && matches.length === 0,
    error,
    liveCount: matches.filter(m => m.isLive).length,
  };
}
