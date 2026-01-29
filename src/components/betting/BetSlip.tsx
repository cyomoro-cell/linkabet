import { useBetSlip } from '@/hooks/useBetSlip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Trash2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function BetSlip() {
  const { 
    selections, 
    stake, 
    removeSelection, 
    clearAll, 
    setStake, 
    getTotalOdds, 
    getPotentialWin 
  } = useBetSlip();

  const totalOdds = getTotalOdds();
  const potentialWin = getPotentialWin();

  if (selections.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-bold text-lg mb-2">Bet Slip</h3>
        <p className="text-muted-foreground text-sm">
          Click on odds to add selections to your bet slip.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-secondary/50 border-b border-border">
        <h3 className="font-bold">
          Bet Slip <span className="text-primary">({selections.length})</span>
        </h3>
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <Trash2 className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      {/* Selections */}
      <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {selections.map((selection) => (
            <motion.div
              key={selection.matchId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-start justify-between gap-3 p-3 rounded-lg bg-secondary/30"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {selection.match.homeTeam.name} vs {selection.match.awayTeam.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selection.selection === 'home' 
                    ? selection.match.homeTeam.name 
                    : selection.selection === 'away'
                    ? selection.match.awayTeam.name
                    : 'Draw'} to win
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary">{selection.odds.toFixed(2)}</span>
                <button
                  onClick={() => removeSelection(selection.matchId)}
                  className="p-1 rounded hover:bg-secondary transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Stake & Totals */}
      <div className="p-4 border-t border-border space-y-4">
        {selections.length > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Odds</span>
            <span className="font-bold">{totalOdds.toFixed(2)}</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Stake</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              type="number"
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              className="pl-7"
              min={1}
            />
          </div>
        </div>

        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-primary/10 border border-primary/20">
          <span className="font-medium">Potential Win</span>
          <span className="text-xl font-bold text-primary">${potentialWin.toFixed(2)}</span>
        </div>

        <Button variant="hero" size="lg" className="w-full">
          Place Bet
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
