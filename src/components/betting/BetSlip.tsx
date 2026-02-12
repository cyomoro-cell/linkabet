import { useState } from 'react';
import { useBetSlip } from '@/hooks/useBetSlip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/currency';

export function BetSlip() {
  const { 
    selections, stake, removeSelection, clearAll, 
    setStake, getTotalOdds, getPotentialWin 
  } = useBetSlip();
  const { user, wallet, isAuthenticated, refreshWallet } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isPlacing, setIsPlacing] = useState(false);

  const totalOdds = getTotalOdds();
  const potentialWin = getPotentialWin();
  const currency = wallet?.currency || 'USD';
  const balance = wallet?.balance ? Number(wallet.balance) : 0;

  const handlePlaceBet = async () => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }

    if (stake <= 0 || selections.length === 0) {
      toast({ title: 'Invalid bet', description: 'Add selections and enter a stake.', variant: 'destructive' });
      return;
    }

    if (stake > balance) {
      toast({ title: 'Insufficient balance', description: `Your balance is ${formatCurrency(balance, currency)}`, variant: 'destructive' });
      return;
    }

    setIsPlacing(true);
    try {
      // Create bet record for each selection (or accumulator)
      const firstSelection = selections[0];
      const { error: betError } = await db.from('bets').insert({
        user_id: user!.id,
        match_id: firstSelection.matchId,
        match_data: {
          homeTeam: firstSelection.match.homeTeam,
          awayTeam: firstSelection.match.awayTeam,
          league: firstSelection.match.league,
          sport: firstSelection.match.sport,
        },
        selections: selections.map(s => ({
          matchId: s.matchId,
          selection: s.selection,
          odds: s.odds,
          homeTeam: s.match.homeTeam.name,
          awayTeam: s.match.awayTeam.name,
        })),
        stake,
        total_odds: totalOdds,
        potential_win: potentialWin,
      });

      if (betError) throw betError;

      // Create transaction
      const { error: txError } = await db.from('transactions').insert({
        user_id: user!.id,
        type: 'bet',
        amount: stake,
        fee: 0,
        net_amount: stake,
        description: `Bet on ${firstSelection.match.homeTeam.name} vs ${firstSelection.match.awayTeam.name}`,
      });

      if (txError) throw txError;

      // Deduct balance
      const newBalance = balance - stake;
      const { error: walletError } = await db
        .from('wallets')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('user_id', user!.id);

      if (walletError) throw walletError;

      await refreshWallet();
      clearAll();
      toast({ title: 'Bet placed!', description: `${formatCurrency(stake, currency)} staked at ${totalOdds.toFixed(2)} odds` });
    } catch (error: any) {
      toast({ title: 'Failed to place bet', description: error.message, variant: 'destructive' });
    } finally {
      setIsPlacing(false);
    }
  };

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
      <div className="flex items-center justify-between px-4 py-3 bg-secondary/50 border-b border-border">
        <h3 className="font-bold">
          Bet Slip <span className="text-primary">({selections.length})</span>
        </h3>
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <Trash2 className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

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
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{currency}</span>
            <Input
              type="number"
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              className="pl-7"
              min={1}
            />
          </div>
          {isAuthenticated && (
            <p className="text-xs text-muted-foreground">Balance: {formatCurrency(balance, currency)}</p>
          )}
        </div>

        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-primary/10 border border-primary/20">
          <span className="font-medium">Potential Win</span>
          <span className="text-xl font-bold text-primary">{formatCurrency(potentialWin, currency)}</span>
        </div>

        <Button 
          variant="hero" 
          size="lg" 
          className="w-full" 
          onClick={handlePlaceBet}
          disabled={isPlacing}
        >
          {isPlacing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              {isAuthenticated ? 'Place Bet' : 'Sign In to Bet'}
              <ChevronRight className="h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
