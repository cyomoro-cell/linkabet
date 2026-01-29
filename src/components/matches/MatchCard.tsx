import { Match } from '@/types';
import { Button } from '@/components/ui/button';
import { useBetSlip } from '@/hooks/useBetSlip';
import { sportIcons } from '@/data/mockData';
import { motion } from 'framer-motion';
import { Clock, Zap } from 'lucide-react';
import { format } from 'date-fns';

interface MatchCardProps {
  match: Match;
}

export function MatchCard({ match }: MatchCardProps) {
  const { selections, addSelection } = useBetSlip();
  
  const currentSelection = selections.find((s) => s.matchId === match.id);

  const handleOddsClick = (selection: 'home' | 'draw' | 'away', odds: number) => {
    addSelection({
      matchId: match.id,
      match,
      selection,
      odds,
    });
  };

  const getOddsButtonVariant = (selection: 'home' | 'draw' | 'away') => {
    return currentSelection?.selection === selection ? 'oddsActive' : 'odds';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-xl border border-border bg-card p-4 card-hover"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{sportIcons[match.sport]}</span>
          <span className="text-xs text-muted-foreground font-medium">{match.league}</span>
        </div>
        {match.isLive ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-live/10 text-live">
            <Zap className="h-3 w-3 fill-current" />
            <span className="text-xs font-bold">{match.minute}'</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="text-xs">{format(match.startTime, 'HH:mm')}</span>
          </div>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{match.homeTeam.name}</span>
          {match.isLive && (
            <span className="font-bold text-primary">{match.homeTeam.score}</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold">{match.awayTeam.name}</span>
          {match.isLive && (
            <span className="font-bold text-primary">{match.awayTeam.score}</span>
          )}
        </div>
      </div>

      {/* Odds */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant={getOddsButtonVariant('home')}
          size="sm"
          className="flex flex-col gap-0.5 h-auto py-2"
          onClick={() => handleOddsClick('home', match.odds.home)}
        >
          <span className="text-xs text-muted-foreground">1</span>
          <span className="font-bold">{match.odds.home.toFixed(2)}</span>
        </Button>
        
        {match.odds.draw !== undefined && (
          <Button
            variant={getOddsButtonVariant('draw')}
            size="sm"
            className="flex flex-col gap-0.5 h-auto py-2"
            onClick={() => handleOddsClick('draw', match.odds.draw!)}
          >
            <span className="text-xs text-muted-foreground">X</span>
            <span className="font-bold">{match.odds.draw.toFixed(2)}</span>
          </Button>
        )}
        
        <Button
          variant={getOddsButtonVariant('away')}
          size="sm"
          className={`flex flex-col gap-0.5 h-auto py-2 ${!match.odds.draw ? 'col-span-1' : ''}`}
          onClick={() => handleOddsClick('away', match.odds.away)}
        >
          <span className="text-xs text-muted-foreground">2</span>
          <span className="font-bold">{match.odds.away.toFixed(2)}</span>
        </Button>
      </div>
    </motion.div>
  );
}
