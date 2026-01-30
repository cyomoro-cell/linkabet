import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Trophy, Bot, RefreshCw } from 'lucide-react';
import { db, Transaction } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

const typeIcons: Record<string, any> = {
  deposit: ArrowDownLeft,
  withdrawal: ArrowUpRight,
  bet: Trophy,
  win: Trophy,
  ai_fee: Bot,
  refund: RefreshCw,
};

const typeColors: Record<string, string> = {
  deposit: 'text-success',
  withdrawal: 'text-destructive',
  bet: 'text-warning',
  win: 'text-success',
  ai_fee: 'text-primary',
  refund: 'text-primary',
};

export function TransactionHistory() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchTransactions = async () => {
      const { data, error } = await db
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setTransactions(data as Transaction[]);
      }
      setIsLoading(false);
    };

    fetchTransactions();
  }, [user]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-bold text-lg mb-4">Transaction History</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-secondary/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="font-bold text-lg mb-4">Transaction History</h3>
        <p className="text-muted-foreground text-center py-8">
          No transactions yet
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="font-bold text-lg mb-4">Transaction History</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {transactions.map((tx) => {
          const Icon = typeIcons[tx.type] || ArrowDownLeft;
          const colorClass = typeColors[tx.type] || 'text-foreground';
          const isPositive = ['deposit', 'win', 'refund'].includes(tx.type);

          return (
            <div
              key={tx.id}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-secondary ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium capitalize">{tx.type.replace('_', ' ')}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold ${isPositive ? 'text-success' : 'text-destructive'}`}>
                  {isPositive ? '+' : '-'}${Math.abs(tx.net_amount).toFixed(2)}
                </p>
                {tx.fee > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Fee: ${tx.fee.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
