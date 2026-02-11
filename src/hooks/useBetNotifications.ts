import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

/**
 * Subscribes to realtime changes on the user's bets table
 * and shows toast notifications when bet status changes
 * (e.g. won, lost, cancelled).
 */
export function useBetNotifications() {
  const { user, isAuthenticated, refreshWallet } = useAuth();
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const channel = supabase
      .channel('bet-results')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bets',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const bet = payload.new as any;
          const oldBet = payload.old as any;

          // Only notify on status change, and only once per bet
          if (bet.status === oldBet.status) return;
          if (processedRef.current.has(bet.id + bet.status)) return;
          processedRef.current.add(bet.id + bet.status);

          const matchName = bet.match_data?.homeTeam?.name && bet.match_data?.awayTeam?.name
            ? `${bet.match_data.homeTeam.name} vs ${bet.match_data.awayTeam.name}`
            : 'your bet';

          switch (bet.status) {
            case 'won':
              toast({
                title: '🎉 You Won!',
                description: `${matchName} — $${Number(bet.potential_win).toFixed(2)} has been credited to your wallet.`,
              });
              refreshWallet();
              break;
            case 'lost':
              toast({
                title: '😞 Bet Lost',
                description: `${matchName} — Better luck next time!`,
                variant: 'destructive',
              });
              break;
            case 'cancelled':
              toast({
                title: '🔄 Bet Cancelled',
                description: `${matchName} — Your stake of $${Number(bet.stake).toFixed(2)} has been refunded.`,
              });
              refreshWallet();
              break;
            case 'cashout':
              // Cashout toasts are handled by the CashoutButton itself
              break;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id]);
}
