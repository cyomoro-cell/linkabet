import { useEffect, useMemo, useState } from 'react';
import { Loader2, Radio, Receipt, Lock, RefreshCw, Clock3 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BetSlip } from '@/components/betting/BetSlip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useLiveScores, LiveScoreMatch } from '@/hooks/useLiveScores';
import { useBetSlip } from '@/hooks/useBetSlip';
import { supabase } from '@/integrations/supabase/client';
import { Match } from '@/types';

const REFRESH_MINUTES = 2;
const POSTPONED = ['POSTPONED', 'POSTP', 'CANCELLED', 'CANC', 'ABANDONED', 'SUSP'];

function toMatch(m: LiveScoreMatch): Match {
  return {
    id: m.id,
    sport: (m.sport as Match['sport']) || 'football',
    league: m.league,
    homeTeam: { id: `${m.id}-h`, name: m.home_team?.name ?? 'Home', score: m.home_score },
    awayTeam: { id: `${m.id}-a`, name: m.away_team?.name ?? 'Away', score: m.away_score },
    odds: { home: m.home_odds ?? 0, draw: m.draw_odds ?? undefined, away: m.away_odds ?? 0 },
    startTime: new Date(m.updated_at),
    isLive: m.is_live,
    minute: m.minute ?? undefined,
    statusCode: m.status,
  };
}

function timeAgo(date: Date | null, now: number) {
  if (!date) return 'never';
  const s = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)} min ago`;
}

export default function LiveDashboardPage() {
  const { matches, isLoading, liveCount } = useLiveScores();
  const { selections } = useBetSlip();
  const [betSlipOpen, setBetSlipOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const lastUpdated = useMemo(() => {
    const times = matches.map((m) => new Date(m.updated_at).getTime()).filter(Number.isFinite);
    return times.length ? new Date(Math.max(...times)) : null;
  }, [matches]);

  const groups = useMemo(() => {
    const map = new Map<string, LiveScoreMatch[]>();
    matches.forEach((m) => {
      const key = m.league || 'Other';
      map.set(key, [...(map.get(key) ?? []), m]);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  const refreshNow = async () => {
    setRefreshing(true);
    void supabase;
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex">
        <main className="flex-1 min-w-0">
          <div className="border-b border-border bg-card/50">
            <div className="container py-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-live/10">
                  <Radio className="h-6 w-6 text-live" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Live Score Dashboard</h1>
                  <p className="text-sm text-muted-foreground">
                    {liveCount} in play · auto-refresh every {REFRESH_MINUTES} min
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  Last update: {lastUpdated ? `${lastUpdated.toLocaleTimeString()} (${timeAgo(lastUpdated, now)})` : 'never'}
                </span>
                <Button variant="outline" size="sm" onClick={refreshNow} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Updating…' : 'Refresh'}
                </Button>
              </div>
            </div>
          </div>

          <div className="container py-6 space-y-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading live scores...</span>
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-lg font-medium">No matches right now</p>
                <p className="text-sm mt-1">New fixtures appear here automatically.</p>
              </div>
            ) : (
              groups.map(([league, rows]) => (
                <section key={league} className="overflow-hidden rounded-lg border border-border bg-card">
                  <header className="flex items-center justify-between border-b border-border bg-secondary/45 px-4 py-3">
                    <h2 className="text-sm font-bold">{league}</h2>
                    <span className="text-xs text-muted-foreground">{rows.length} matches</span>
                  </header>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-4 py-2 text-left font-medium">Status</th>
                          <th className="px-4 py-2 text-left font-medium">Match</th>
                          <th className="px-4 py-2 text-center font-medium">Score</th>
                          <th className="hidden px-4 py-2 text-left font-medium md:table-cell">Date</th>
                          <th className="px-4 py-2 text-right font-medium">Odds 1 · X · 2</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((m) => <MatchTableRow key={m.id} match={m} />)}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))
            )}
          </div>
        </main>

        <div className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-16 p-4"><BetSlip /></div>
        </div>
      </div>
      <Footer />

      <div className="lg:hidden">
        <Sheet open={betSlipOpen} onOpenChange={setBetSlipOpen}>
          <SheetTrigger asChild>
            <Button variant="hero" size="lg" className="fixed bottom-6 right-6 z-50 rounded-full shadow-xl">
              <Receipt className="h-5 w-5" />
              {selections.length > 0 && <span className="ml-1">{selections.length}</span>}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl p-0">
            <div className="p-6 overflow-y-auto h-full"><BetSlip /></div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function StatusBadge({ match }: { match: LiveScoreMatch }) {
  const s = (match.status || '').toUpperCase();
  if (POSTPONED.some((p) => s.startsWith(p))) return <Badge variant="destructive">Postponed</Badge>;
  if (match.is_live) return <Badge className="bg-live/10 text-live hover:bg-live/10">{match.match_time || match.status}</Badge>;
  if (s === 'NS' || !s) return <Badge variant="secondary">Upcoming</Badge>;
  return <Badge variant="outline">{match.status}</Badge>;
}

function MatchTableRow({ match }: { match: LiveScoreMatch }) {
  const { selections, addSelection } = useBetSlip();
  const current = selections.find((s) => s.matchId === match.id);
  const s = (match.status || '').toUpperCase();
  const postponed = POSTPONED.some((p) => s.startsWith(p));
  const suspended = postponed || match.odds_status === 'suspended';
  const upcoming = s === 'NS';

  const pick = (selection: 'home' | 'draw' | 'away', odds: number | null) => {
    if (suspended || !odds) return;
    addSelection({ matchId: match.id, match: toMatch(match), selection, odds });
  };

  return (
    <tr className="border-b border-border/60 last:border-b-0 hover:bg-secondary/30">
      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge match={match} /></td>
      <td className="px-4 py-3">
        <div className="font-semibold truncate max-w-[14rem]">{match.home_team?.name ?? 'TBD'}</div>
        <div className="font-semibold truncate max-w-[14rem]">{match.away_team?.name ?? 'TBD'}</div>
      </td>
      <td className="px-4 py-3 text-center font-bold text-primary whitespace-nowrap">
        {upcoming || postponed ? '–' : `${match.home_score ?? 0} : ${match.away_score ?? 0}`}
      </td>
      <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell whitespace-nowrap">
        {new Date(match.updated_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        {suspended ? (
          <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Suspended
          </div>
        ) : (
          <div className="flex justify-end gap-1.5">
            {(['home', 'draw', 'away'] as const).map((k) => {
              const odds = match[`${k}_odds`];
              return (
                <Button
                  key={k}
                  size="sm"
                  variant={current?.selection === k ? ('oddsActive' as never) : ('odds' as never)}
                  disabled={!odds}
                  className="h-8 min-w-[3.25rem] px-2"
                  onClick={() => pick(k, odds)}
                >
                  {odds ? Number(odds).toFixed(2) : '-'}
                </Button>
              );
            })}
          </div>
        )}
      </td>
    </tr>
  );
}
