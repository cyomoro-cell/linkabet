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
import { useSystemSettings } from '@/hooks/useSystemSettings';

export function BetSlip() {
  const { 
    selections, stake, removeSelection, clearAll, 
    setStake, getTotalOdds, getPotentialWin 
  } = useBetSlip();
  const { user, wallet, isAuthenticated, refreshWallet } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { settings } = useSystemSettings();
  const [isPlacing, setIsPlacing] = useState(false);

  const totalOdds = getTotalOdds();
  const potentialWin = getPotentialWin();
  const currency = wallet?.currency || 'USD';
  const balance = wallet?.balance ? Number(wallet.balance) : 0;

  const handlePlaceBet = async () => {
    if (!isAuthenticated || !user) {
      navigate('/auth');
      return;
    }
    if (!settings.betting_enabled) {
      toast({ title: 'Betting is currently disabled', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(stake) || stake <= 0 || selections.length === 0) {
      toast({ title: 'Invalid bet', description: 'Add selections and enter a valid stake.', variant: 'destructive' });
      return;
    }
    if (stake > balance) {
      toast({ title: 'Insufficient virtual points', description: 'Your virtual-point balance is too low.', variant: 'destructive' });
      return;
    }

    setIsPlacing(true);
    try {
      const { error } = await db.rpc('place_bet', {
        p_selections: selections.map((s) => ({
          matchId: s.matchId,
          selection: s.selection,
        })),
        p_stake: stake,
        p_mode: selections.length > 1 ? 'Accumulator' : 'Singles',
        p_idempotency_key: crypto.randomUUID(),
      });
      if (error) throw error;
      await refreshWallet();
      clearAll();
      toast({ title: 'Bet placed!', description: `${formatCurrency(stake, currency)} virtual points staked. Virtual points have no cash value.` });
    } catch (error: any) {
      toast({ title: 'Could not place bet', description: error.message ?? 'Please try again.', variant: 'destructive' });
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
              min={settings.min_bet_amount}
              max={settings.max_bet_amount}
            />
          </div>
          {isAuthenticated && (
            <p className="text-xs text-muted-foreground">
              Balance: {formatCurrency(balance, currency)} • Min: {formatCurrency(settings.min_bet_amount, currency)} • Max: {formatCurrency(settings.max_bet_amount, currency)}
            </p>
          )}
        </div>

        {!settings.betting_enabled && (
          <p className="text-xs text-destructive text-center">Betting is currently disabled</p>
        )}

        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-primary/10 border border-primary/20">
          <span className="font-medium">Potential Win</span>
          <span className="text-xl font-bold text-primary">{formatCurrency(potentialWin, currency)}</span>
        </div>

        <Button 
          variant="hero" 
          size="lg" 
          className="w-full" 
          onClick={handlePlaceBet}
          disabled={isPlacing || !settings.betting_enabled}
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
