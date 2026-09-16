import { Match } from '@/types';
import { Button } from '@/components/ui/button';
import { useBetSlip } from '@/hooks/useBetSlip';
import { sportIcons } from '@/data/mockData';
import { ChevronRight, Clock3, MapPin, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface LeagueMatchListProps {
  matches: Match[];
}

interface LeagueGroup {
  country: string;
  league: string;
  matches: Match[];
}

const leagueCountries: Record<string, string> = {
  'Premier League': 'England',
  'La Liga': 'Spain',
  LaLiga: 'Spain',
  Bundesliga: 'Germany',
  'Serie A': 'Italy',
  'Ligue 1': 'France',
  'Champions League': 'Europe',
  'Europa League': 'Europe',
  NBA: 'United States',
  NHL: 'United States & Canada',
  MLB: 'United States',
  'ATP Masters': 'International',
  'LoL Worlds': 'International',
};

function groupByLeague(matches: Match[]): LeagueGroup[] {
  const groups = new Map<string, LeagueGroup>();

  matches.forEach((match) => {
    const country = match.country || leagueCountries[match.league] || 'International';
    const key = `${country}::${match.league}`;
    const existing = groups.get(key);
    if (existing) existing.matches.push(match);
    else groups.set(key, { country, league: match.league, matches: [match] });
  });

  return [...groups.values()].map((group) => ({
    ...group,
    matches: [...group.matches].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
  }));
}

function MatchStatus({ match }: { match: Match }) {
  if (match.isLive) {
    return (
      <div className="flex items-center gap-1.5 font-semibold text-live">
        <Radio className="h-3.5 w-3.5 animate-pulse" />
        <span>{match.minute ? `${match.minute}'` : 'Live'}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start sm:items-center">
      <span className="flex items-center gap-1.5 font-semibold text-foreground">
        <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
        {new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(match.startTime)}
      </span>
      <span className="text-[11px] text-muted-foreground">Upcoming</span>
    </div>
  );
}

function MatchRow({ match }: { match: Match }) {
  const { selections, addSelection } = useBetSlip();
  const currentSelection = selections.find((selection) => selection.matchId === match.id);
  const options = [
    { key: 'home' as const, label: '1', odds: match.odds.home },
    ...(match.odds.draw === undefined ? [] : [{ key: 'draw' as const, label: 'X', odds: match.odds.draw }]),
    { key: 'away' as const, label: '2', odds: match.odds.away },
  ];

  return (
    <motion.article initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="group relative border-t border-border/70 first:border-t-0">
      <Link
        to={`/match/${match.id}`}
        aria-label={`View ${match.homeTeam.name} versus ${match.awayTeam.name}`}
        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
      <div className="relative grid min-h-24 grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-3 px-3 py-3 transition-colors group-hover:bg-secondary/30 sm:grid-cols-[5.5rem_minmax(13rem,1fr)_minmax(15rem,0.85fr)_1.25rem] sm:px-4">
        <div className="text-xs"><MatchStatus match={match} /></div>
        <div className="min-w-0 space-y-2 text-sm font-semibold">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate">{match.homeTeam.name}</span>
            {match.isLive && <span className="text-base font-bold">{match.homeTeam.score ?? 0}</span>}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="truncate">{match.awayTeam.name}</span>
            {match.isLive && <span className="text-base font-bold">{match.awayTeam.score ?? 0}</span>}
          </div>
        </div>
        <div className="relative z-10 col-span-2 grid grid-cols-3 gap-2 sm:col-span-1">
          {options.map((option) => (
            <Button
              key={option.key}
              type="button"
              variant={currentSelection?.selection === option.key ? 'oddsActive' : 'odds'}
              size="sm"
              className="h-11 min-w-0 justify-between px-2.5"
              aria-label={`Select ${option.label} at ${option.odds.toFixed(2)}`}
              onClick={() => addSelection({ matchId: match.id, match, selection: option.key, odds: option.odds })}
            >
              <span className="text-[10px] font-medium opacity-70">{option.label}</span>
              <span>{option.odds.toFixed(2)}</span>
            </Button>
          ))}
        </div>
        <ChevronRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground sm:block" />
      </div>
    </motion.article>
  );
}

export function LeagueMatchList({ matches }: LeagueMatchListProps) {
  return (
    <div className="space-y-5">
      {groupByLeague(matches).map((group) => (
        <section key={`${group.country}-${group.league}`} className="overflow-hidden rounded-lg border border-border bg-card">
          <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border bg-secondary/45 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-base">
                {sportIcons[group.matches[0]?.sport || 'football'] || '🏆'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <MapPin className="h-3 w-3" /><span className="truncate">{group.country}</span>
                </div>
                <h3 className="truncate text-sm font-bold">{group.league}</h3>
              </div>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {group.matches.length} {group.matches.length === 1 ? 'match' : 'matches'}
            </span>
          </header>
          <div>{group.matches.map((match) => <MatchRow key={match.id} match={match} />)}</div>
        </section>
      ))}
    </div>
  );
}