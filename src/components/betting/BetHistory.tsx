import { useEffect, useState } from 'react';
import { Trophy, Clock, CheckCircle, XCircle, Timer } from 'lucide-react';
import { db, Bet } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { CashoutButton } from './CashoutButton';

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Timer, color: 'bg-warning/10 text-warning', label: 'Pending' },
  won: { icon: CheckCircle, color: 'bg-success/10 text-success', label: 'Won' },
  lost: { icon: XCircle, color: 'bg-destructive/10 text-destructive', label: 'Lost' },
  cancelled: { icon: Clock, color: 'bg-muted text-muted-foreground', label: 'Cancelled' },
  cashout: { icon: Trophy, color: 'bg-primary/10 text-primary', label: 'Cashed Out' },
};

export function BetHistory() {
  const { user } = useAuth();
  const [bets, setBets] = useState<Bet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBets = async () => {
    if (!user) return;
    const { data, error } = await db
      .from('bets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) setBets(data as Bet[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchBets();
  }, [user]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-bold text-lg mb-4">Bet History</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-secondary/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (bets.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-lg">Bet History</h3>
        </div>
        <div className="text-center py-12">
          <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No bets placed yet</p>
          <p className="text-sm text-muted-foreground mt-1">Start betting to see your history here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-lg">Bet History</h3>
        <Badge variant="secondary" className="ml-auto">{bets.length} bets</Badge>
      </div>

      <div className="space-y-4 max-h-[500px] overflow-y-auto">
        {bets.map((bet) => {
          const status = statusConfig[bet.status] || statusConfig.pending;
          const StatusIcon = status.icon;
          const matchData = bet.match_data;

          return (
            <div
              key={bet.id}
              className="p-4 rounded-lg bg-secondary/30 border border-border hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium">
                    {matchData?.homeTeam?.name || 'Team A'} vs {matchData?.awayTeam?.name || 'Team B'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {matchData?.league || 'Unknown League'} • {formatDistanceToNow(new Date(bet.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Badge className={status.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Selection</p>
                  <p className="font-medium capitalize">{bet.selections?.selection || 'Home'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Odds</p>
                  <p className="font-medium">{bet.total_odds.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Stake</p>
                  <p className="font-medium">${bet.stake.toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {bet.status === 'cashout'
                    ? `Cashed out: $${(bet.result_data?.cashout_value ?? 0).toFixed(2)}`
                    : `Potential Win`}
                </span>
                <div className="flex items-center gap-2">
                  {bet.status === 'pending' && (
                    <CashoutButton bet={bet} onCashout={fetchBets} />
                  )}
                  <span className={`font-bold ${bet.status === 'won' ? 'text-success' : ''}`}>
                    ${bet.potential_win.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
