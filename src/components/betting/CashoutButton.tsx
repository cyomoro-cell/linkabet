import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DollarSign, Loader2 } from 'lucide-react';
import { db, Bet } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface CashoutButtonProps {
  bet: Bet;
  onCashout: () => void;
}

/**
 * Calculate cashout value: reduced payout based on time elapsed.
 * Formula: stake + (potential_win - stake) * cashout_factor
 * cashout_factor diminishes over time (simulated as 0.5–0.85 of potential win)
 */
function getCashoutValue(bet: Bet): number {
  const elapsed = Date.now() - new Date(bet.created_at).getTime();
  const hoursSinceBet = elapsed / (1000 * 60 * 60);
  // More time = lower cashout. Factor ranges from 0.85 (fresh) to 0.40 (old)
  const factor = Math.max(0.40, 0.85 - hoursSinceBet * 0.05);
  const cashoutValue = bet.stake + (bet.potential_win - bet.stake) * factor;
  return parseFloat(Math.max(bet.stake * 0.5, cashoutValue).toFixed(2));
}

export function CashoutButton({ bet, onCashout }: CashoutButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { user, refreshWallet, wallet } = useAuth();
  const { toast } = useToast();

  if (bet.status !== 'pending') return null;

  const cashoutValue = getCashoutValue(bet);

  const handleCashout = async () => {
    if (!user) return;
    setIsProcessing(true);

    try {
      // 1. Update bet status to cashout
      const { error: betError } = await db
        .from('bets')
        .update({
          status: 'cashout',
          settled_at: new Date().toISOString(),
          result_data: { cashout_value: cashoutValue },
        })
        .eq('id', bet.id)
        .eq('user_id', user.id);

      if (betError) throw betError;

      // 2. Create cashout transaction (refund type)
      const { error: txError } = await db.from('transactions').insert({
        user_id: user.id,
        type: 'refund',
        amount: cashoutValue,
        fee: 0,
        net_amount: cashoutValue,
        description: `Cashout: ${bet.match_data?.homeTeam?.name || 'Match'} vs ${bet.match_data?.awayTeam?.name || 'Match'}`,
      });

      if (txError) throw txError;

      // 3. Credit wallet
      const currentBalance = Number(wallet?.balance || 0);
      const { error: walletError } = await db
        .from('wallets')
        .update({ balance: currentBalance + cashoutValue, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (walletError) throw walletError;

      await refreshWallet();
      onCashout();
      toast({
        title: 'Cashed out!',
        description: `$${cashoutValue.toFixed(2)} has been added to your wallet.`,
      });
    } catch (error: any) {
      toast({
        title: 'Cashout failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-primary/30 text-primary hover:bg-primary/10"
        >
          <DollarSign className="h-3 w-3 mr-1" />
          Cash Out ${cashoutValue.toFixed(2)}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cash Out This Bet?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              You'll receive <span className="font-bold text-primary">${cashoutValue.toFixed(2)}</span> now
              instead of waiting for the full potential win of ${bet.potential_win.toFixed(2)}.
            </p>
            <p className="text-xs">
              Original stake: ${bet.stake.toFixed(2)} • Odds: {bet.total_odds.toFixed(2)}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Bet</AlertDialogCancel>
          <AlertDialogAction onClick={handleCashout} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Cash Out ${cashoutValue.toFixed(2)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
