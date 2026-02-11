import { Match } from '@/types';
import { Button } from '@/components/ui/button';
import { useBetSlip } from '@/hooks/useBetSlip';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface MatchMarketsProps {
  match: Match;
}

interface MarketOption {
  label: string;
  odds: number;
  selection: 'home' | 'draw' | 'away';
  marketKey: string;
}

interface Market {
  name: string;
  description: string;
  options: MarketOption[];
}

export function MatchMarkets({ match }: MatchMarketsProps) {
  const { selections, addSelection } = useBetSlip();

  const markets = useMemo(() => generateMarkets(match), [match.id, match.odds.home, match.odds.away, match.odds.draw]);

  return (
    <div className="space-y-4">
      {markets.map((market) => (
        <div key={market.name} className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3">
            <h3 className="font-bold text-sm">{market.name}</h3>
            <p className="text-xs text-muted-foreground">{market.description}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {market.options.map((opt) => {
              const isActive = selections.some(
                s => s.matchId === `${match.id}_${opt.marketKey}` && s.selection === opt.selection
              );
              return (
                <Button
                  key={`${opt.marketKey}_${opt.selection}`}
                  variant={isActive ? 'oddsActive' : 'odds'}
                  size="sm"
                  className="flex flex-col gap-0.5 h-auto py-2.5 relative"
                  onClick={() =>
                    addSelection({
                      matchId: `${match.id}_${opt.marketKey}`,
                      match,
                      selection: opt.selection,
                      odds: opt.odds,
                    })
                  }
                >
                  <span className="text-[10px] text-muted-foreground truncate max-w-full">{opt.label}</span>
                  <motion.span
                    key={opt.odds.toFixed(2)}
                    initial={match.isLive ? { color: 'hsl(142, 76%, 50%)' } : {}}
                    animate={{ color: 'inherit' }}
                    transition={{ duration: 1.5 }}
                    className="font-bold"
                  >
                    {opt.odds.toFixed(2)}
                  </motion.span>
                  {match.isLive && (
                    <span className="absolute top-0.5 right-0.5 flex h-1.5 w-1.5 rounded-full bg-live animate-pulse" />
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function generateMarkets(match: Match): Market[] {
  const h = match.odds.home;
  const a = match.odds.away;
  const d = match.odds.draw;
  const hasDraw = d !== undefined;

  const markets: Market[] = [
    {
      name: 'Match Result',
      description: 'Who will win the match?',
      options: [
        { label: match.homeTeam.name, odds: h, selection: 'home', marketKey: 'result' },
        ...(hasDraw ? [{ label: 'Draw', odds: d!, selection: 'draw' as const, marketKey: 'result' }] : []),
        { label: match.awayTeam.name, odds: a, selection: 'away', marketKey: 'result' },
      ],
    },
    {
      name: 'Double Chance',
      description: 'Two outcomes covered in one bet',
      options: [
        { label: `${match.homeTeam.name} or Draw`, odds: pf(1 / (1/h + (hasDraw ? 1/d! : 0)) * 0.9), selection: 'home', marketKey: 'dc' },
        { label: `${match.awayTeam.name} or Draw`, odds: pf(1 / (1/a + (hasDraw ? 1/d! : 0)) * 0.9), selection: 'away', marketKey: 'dc' },
        { label: `${match.homeTeam.name} or ${match.awayTeam.name}`, odds: pf(1 / (1/h + 1/a) * 0.9), selection: 'draw', marketKey: 'dc' },
      ],
    },
    {
      name: 'Over/Under 2.5 Goals',
      description: 'Total goals scored in the match',
      options: [
        { label: 'Over 2.5', odds: pf(1.6 + Math.random() * 0.5), selection: 'home', marketKey: 'ou25' },
        { label: 'Under 2.5', odds: pf(2.0 + Math.random() * 0.5), selection: 'away', marketKey: 'ou25' },
      ],
    },
    {
      name: 'Over/Under 1.5 Goals',
      description: 'Will there be 2 or more goals?',
      options: [
        { label: 'Over 1.5', odds: pf(1.2 + Math.random() * 0.3), selection: 'home', marketKey: 'ou15' },
        { label: 'Under 1.5', odds: pf(3.5 + Math.random() * 1.0), selection: 'away', marketKey: 'ou15' },
      ],
    },
    {
      name: 'Both Teams to Score',
      description: 'Will both teams find the net?',
      options: [
        { label: 'Yes', odds: pf(1.7 + Math.random() * 0.4), selection: 'home', marketKey: 'btts' },
        { label: 'No', odds: pf(1.9 + Math.random() * 0.4), selection: 'away', marketKey: 'btts' },
      ],
    },
    {
      name: 'Handicap (-1)',
      description: `${match.homeTeam.name} starts with -1 goal advantage`,
      options: [
        { label: `${match.homeTeam.name} -1`, odds: pf(h * 1.6), selection: 'home', marketKey: 'hcap1' },
        ...(hasDraw ? [{ label: 'Draw', odds: pf(d! * 0.9), selection: 'draw' as const, marketKey: 'hcap1' }] : []),
        { label: `${match.awayTeam.name} +1`, odds: pf(a * 0.65), selection: 'away', marketKey: 'hcap1' },
      ],
    },
    {
      name: 'Half-Time Result',
      description: 'Score at half time',
      options: [
        { label: match.homeTeam.name, odds: pf(h * 1.3), selection: 'home', marketKey: 'ht' },
        ...(hasDraw ? [{ label: 'Draw', odds: pf(d! * 0.75), selection: 'draw' as const, marketKey: 'ht' }] : []),
        { label: match.awayTeam.name, odds: pf(a * 1.3), selection: 'away', marketKey: 'ht' },
      ],
    },
    {
      name: 'Correct Score',
      description: 'Predict the exact final score',
      options: [
        { label: '1-0', odds: pf(5 + Math.random() * 3), selection: 'home', marketKey: 'cs10' },
        { label: '2-1', odds: pf(7 + Math.random() * 3), selection: 'home', marketKey: 'cs21' },
        { label: '0-0', odds: pf(8 + Math.random() * 4), selection: 'draw', marketKey: 'cs00' },
        { label: '1-1', odds: pf(5 + Math.random() * 2), selection: 'draw', marketKey: 'cs11' },
        { label: '0-1', odds: pf(6 + Math.random() * 3), selection: 'away', marketKey: 'cs01' },
        { label: '1-2', odds: pf(8 + Math.random() * 3), selection: 'away', marketKey: 'cs12' },
      ],
    },
  ];

  return markets;
}

function pf(n: number): number {
  return parseFloat(Math.max(1.01, n).toFixed(2));
}
