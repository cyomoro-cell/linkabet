import { useState } from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/supabase';

const FEE_PERCENTAGE = 0.05; // 5% fee

export function WalletCard() {
  const { wallet, user, refreshWallet } = useAuth();
  const { toast } = useToast();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleDeposit = async () => {
    if (!user || !amount) return;
    
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const fee = depositAmount * FEE_PERCENTAGE;
      const netAmount = depositAmount - fee;

      // Create transaction
      const { error: txError } = await db
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'deposit',
          amount: depositAmount,
          fee: fee,
          net_amount: netAmount,
          description: `Deposit of $${depositAmount.toFixed(2)} (5% fee: $${fee.toFixed(2)})`,
        });

      if (txError) throw txError;

      // Update wallet balance
      const currentBal = wallet?.balance ? Number(wallet.balance) : 0;
      const newBalance = currentBal + netAmount;
      const { error: walletError } = await db
        .from('wallets')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (walletError) throw walletError;

      await refreshWallet();
      setDepositOpen(false);
      setAmount('');
      toast({
        title: 'Deposit successful!',
        description: `$${netAmount.toFixed(2)} added to your wallet (after 5% fee)`,
      });
    } catch (error: any) {
      toast({
        title: 'Deposit failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user || !amount) return;
    
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }

    const currentBalance = wallet?.balance ? Number(wallet.balance) : 0;
    if (withdrawAmount > currentBalance) {
      toast({ title: 'Insufficient balance', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const fee = withdrawAmount * FEE_PERCENTAGE;
      const netAmount = withdrawAmount - fee;

      // Create transaction
      const { error: txError } = await db
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'withdrawal',
          amount: withdrawAmount,
          fee: fee,
          net_amount: netAmount,
          description: `Withdrawal of $${withdrawAmount.toFixed(2)} (5% fee: $${fee.toFixed(2)})`,
        });

      if (txError) throw txError;

      // Update wallet balance
      const newBalance = currentBalance - withdrawAmount;
      const { error: walletError } = await db
        .from('wallets')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (walletError) throw walletError;

      await refreshWallet();
      setWithdrawOpen(false);
      setAmount('');
      toast({
        title: 'Withdrawal successful!',
        description: `$${netAmount.toFixed(2)} will be sent (after 5% fee)`,
      });
    } catch (error: any) {
      toast({
        title: 'Withdrawal failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const balance = wallet?.balance ? Number(wallet.balance) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Wallet className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Available Balance</p>
          <p className="text-2xl font-bold">${balance.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" className="w-full">
              <ArrowDownLeft className="h-4 w-4" />
              Deposit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deposit Funds</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                />
              </div>
              {amount && parseFloat(amount) > 0 && (
                <div className="p-3 rounded-lg bg-secondary/50 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span>${parseFloat(amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-destructive">
                    <span>Fee (5%)</span>
                    <span>-${(parseFloat(amount) * 0.05).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-border pt-1">
                    <span>You receive</span>
                    <span className="text-primary">${(parseFloat(amount) * 0.95).toFixed(2)}</span>
                  </div>
                </div>
              )}
              <Button onClick={handleDeposit} variant="hero" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Deposit'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <ArrowUpRight className="h-4 w-4" />
              Withdraw
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw Funds</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  max={balance}
                />
                <p className="text-xs text-muted-foreground">
                  Available: ${balance.toFixed(2)}
                </p>
              </div>
              {amount && parseFloat(amount) > 0 && (
                <div className="p-3 rounded-lg bg-secondary/50 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span>${parseFloat(amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-destructive">
                    <span>Fee (5%)</span>
                    <span>-${(parseFloat(amount) * 0.05).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-border pt-1">
                    <span>You receive</span>
                    <span className="text-primary">${(parseFloat(amount) * 0.95).toFixed(2)}</span>
                  </div>
                </div>
              )}
              <Button onClick={handleWithdraw} variant="hero" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Withdrawal'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
