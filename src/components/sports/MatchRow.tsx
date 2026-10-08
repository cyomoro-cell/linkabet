import { useEffect, useState } from 'react';
import { Star, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OddsButton } from './OddsButton';
import { useBetSlip } from '@/hooks/useBetSlip';
import { Match } from '@/types';

export interface SportsMatch {
  id: string;
  sport: Match['sport'];
  league: string;
  country?: string;
  home: string;
  away: string;
  startTime: Date;
  live: boolean;
  minute?: number;
  homeScore?: number;
  awayScore?: number;
  odds?: { home: number; draw?: number; away: number };
}

function TeamLogo({ name }: { name: string }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground">
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

const jitter = (v: number) => Math.max(1.01, Math.round((v + (Math.random() - 0.5) * 0.2) * 100) / 100);

export function toBetMatch(m: SportsMatch, odds = m.odds ?? { home: 0, away: 0 }): Match {
  return {
    id: m.id, sport: m.sport, league: m.league,
    homeTeam: { id: `${m.id}-h`, name: m.home, score: m.homeScore },
    awayTeam: { id: `${m.id}-a`, name: m.away, score: m.awayScore },
    odds, startTime: m.startTime, isLive: m.live, minute: m.minute,
  };
}

export function MatchRow({ match, view = 'list' }: { match: SportsMatch; view?: 'list' | 'grid' }) {
  const { selections, addSelection } = useBetSlip();
  const [odds, setOdds] = useState(match.odds);
  const [fav, setFav] = useState(false);
  const current = selections.find((s) => s.matchId === match.id);

  // Simulated live odds — will be replaced by real data later.
  useEffect(() => {
    if (!match.live || !match.odds) return;
    const t = setInterval(() => {
      setOdds((o) => o && ({ home: jitter(o.home), draw: o.draw ? jitter(o.draw) : undefined, away: jitter(o.away) }));
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(t);
  }, [match.live]);

  useEffect(() => { setOdds(match.odds); }, [match.odds]);
  const opts = odds ? [
    { key: 'home' as const, label: '1', v: odds.home },
    ...(odds.draw ? [{ key: 'draw' as const, label: 'X', v: odds.draw }] : []),
    { key: 'away' as const, label: '2', v: odds.away },
  ] : [];

  const time = match.live ? null : (() => {
    const d = match.startTime;
    const today = new Date().toDateString() === d.toDateString();
    return `${today ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  })();

  return (
    <div className={cn(
      'flex gap-3 px-4 py-3 transition-colors hover:bg-secondary/30',
      view === 'grid' ? 'flex-col rounded-xl border border-border bg-card' : 'flex-col border-t border-border/60 first:border-t-0 sm:flex-row sm:items-center',
    )}>
      <div className="w-20 shrink-0 text-xs">
        {match.live ? (
          <span className="flex items-center gap-1.5 font-bold text-live">
            <span className="relative flex h-2 w-2"><span className="absolute h-full w-full animate-ping rounded-full bg-live" /><span className="relative h-2 w-2 rounded-full bg-live" /></span>
            {match.minute}'
          </span>
        ) : (
          <span className="font-semibold">{time}</span>
        )}
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{match.league}</p>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5 text-sm font-semibold">
        {[[match.home, match.homeScore], [match.away, match.awayScore]].map(([name, score]) => (
          <div key={name as string} className="flex items-center gap-2">
            <TeamLogo name={name as string} />
            <span className="truncate">{name}</span>
            {match.live && <span className="ml-auto pr-2 font-black">{score ?? 0}</span>}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {opts.length === 0 && <span className="px-2 text-xs text-muted-foreground">Odds soon</span>}
        {opts.map((o) => (
          <OddsButton key={o.key} label={o.label} odds={o.v} selected={current?.selection === o.key}
            onClick={() => addSelection({ matchId: match.id, match: toBetMatch(match, odds), selection: o.key, odds: o.v })} />
        ))}
        {match.live && (
          <button aria-label="Watch live" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-primary">
            <Tv className="h-4 w-4" />
          </button>
        )}
        <button aria-label="Favorite" onClick={() => setFav((f) => !f)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-accent">
          <Star className={cn('h-4 w-4', fav && 'fill-accent text-accent')} />
        </button>
      </div>
    </div>
  );
}
