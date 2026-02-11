import { Match } from '@/types';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
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
    addSelection({ matchId: match.id, match, selection, odds });
  };

  const getOddsButtonVariant = (selection: 'home' | 'draw' | 'away') =>
    currentSelection?.selection === selection ? 'oddsActive' : 'odds';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-xl border border-border bg-card p-4 card-hover relative"
    >
      <Link to={`/match/${match.id}`} className="absolute inset-0 z-0" />
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

      {/* Odds - with live indicator */}
      <div className="grid grid-cols-3 gap-2 relative z-10">
        <OddsButton
          label="1"
          odds={match.odds.home}
          isLive={match.isLive}
          variant={getOddsButtonVariant('home')}
          onClick={() => handleOddsClick('home', match.odds.home)}
        />
        {match.odds.draw !== undefined && (
          <OddsButton
            label="X"
            odds={match.odds.draw}
            isLive={match.isLive}
            variant={getOddsButtonVariant('draw')}
            onClick={() => handleOddsClick('draw', match.odds.draw!)}
          />
        )}
        <OddsButton
          label="2"
          odds={match.odds.away}
          isLive={match.isLive}
          variant={getOddsButtonVariant('away')}
          onClick={() => handleOddsClick('away', match.odds.away)}
        />
      </div>
    </motion.div>
  );
}

function OddsButton({
  label,
  odds,
  isLive,
  variant,
  onClick,
}: {
  label: string;
  odds: number;
  isLive: boolean;
  variant: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant={variant as any}
      size="sm"
      className="flex flex-col gap-0.5 h-auto py-2 relative overflow-hidden"
      onClick={onClick}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <motion.span
        key={odds.toFixed(2)}
        initial={isLive ? { color: 'hsl(142, 76%, 50%)' } : {}}
        animate={{ color: 'inherit' }}
        transition={{ duration: 1.5 }}
        className="font-bold"
      >
        {odds.toFixed(2)}
      </motion.span>
      {isLive && (
        <span className="absolute top-0.5 right-0.5 flex h-1.5 w-1.5 rounded-full bg-live animate-pulse" />
      )}
    </Button>
  );
}
