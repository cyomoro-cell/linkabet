import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Radio, Receipt, Lock } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BetSlip } from '@/components/betting/BetSlip';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useLiveScores, LiveScoreMatch } from '@/hooks/useLiveScores';
import { useBetSlip } from '@/hooks/useBetSlip';
import { Match } from '@/types';

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

export default function LiveDashboardPage() {
  const { matches, isLoading, liveCount } = useLiveScores();
  const { selections } = useBetSlip();
  const [betSlipOpen, setBetSlipOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex">
        <main className="flex-1 min-w-0">
          <div className="border-b border-border bg-card/50">
            <div className="container py-6 flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-live/10">
                <Radio className="h-6 w-6 text-live" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-live" />
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">Live Score Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  {liveCount} in play · scores and odds update automatically
                </p>
              </div>
            </div>
          </div>

          <div className="container py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading live scores...</span>
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-lg font-medium">No active games right now</p>
                <p className="text-sm mt-1">New fixtures appear here automatically.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {matches.map((m) => (
                  <LiveMatchCard key={m.id} match={m} />
                ))}
              </div>
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

function LiveMatchCard({ match }: { match: LiveScoreMatch }) {
  const { selections, addSelection } = useBetSlip();
  const current = selections.find((s) => s.matchId === match.id);
  const suspended = match.odds_status === 'suspended';

  const pick = (selection: 'home' | 'draw' | 'away', odds: number | null) => {
    if (suspended || !odds) return;
    addSelection({ matchId: match.id, match: toMatch(match), selection, odds });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 card-hover"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground truncate">{match.league}</span>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            match.is_live ? 'bg-live/10 text-live' : 'bg-muted text-muted-foreground'
          }`}
        >
          {match.is_live ? match.match_time || match.status : match.status === 'NS' ? 'Upcoming' : match.status}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold truncate">{match.home_team?.name}</span>
          <motion.span key={`h${match.home_score}`} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="font-bold text-primary">
            {match.home_score}
          </motion.span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold truncate">{match.away_team?.name}</span>
          <motion.span key={`a${match.away_score}`} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="font-bold text-primary">
            {match.away_score}
          </motion.span>
        </div>
      </div>

      {suspended ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Betting suspended
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <OddsButton label="1" odds={match.home_odds} active={current?.selection === 'home'} onClick={() => pick('home', match.home_odds)} />
          <OddsButton label="X" odds={match.draw_odds} active={current?.selection === 'draw'} onClick={() => pick('draw', match.draw_odds)} />
          <OddsButton label="2" odds={match.away_odds} active={current?.selection === 'away'} onClick={() => pick('away', match.away_odds)} />
        </div>
      )}
    </motion.div>
  );
}

function OddsButton({
  label,
  odds,
  active,
  onClick,
}: {
  label: string;
  odds: number | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? ('oddsActive' as never) : ('odds' as never)}
      size="sm"
      disabled={!odds}
      className="flex flex-col gap-0.5 h-auto py-2"
      onClick={onClick}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <motion.span key={String(odds)} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} className="font-bold">
        {odds ? Number(odds).toFixed(2) : '-'}
      </motion.span>
    </Button>
  );
}
