import { Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/currency';

export function WalletCard() {
  const { wallet } = useAuth();
  const currency = wallet?.currency || 'USD';
  const balance = Number(wallet?.balance ?? 0);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Wallet className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Virtual points balance</p>
          <p className="text-2xl font-bold">{formatCurrency(balance, currency)}</p>
        </div>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        Linkabet is a simulated entertainment experience. Virtual points have no cash value and cannot be deposited or withdrawn.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="hero" className="w-full" disabled>
          <ArrowDownLeft className="h-4 w-4" />
          Deposit disabled
        </Button>
        <Button variant="outline" className="w-full" disabled>
          <ArrowUpRight className="h-4 w-4" />
          Withdraw disabled
        </Button>
      </div>
    </div>
  );
}
