import { useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/supabase';
import { getCurrencySymbol } from '@/lib/currency';

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'EUR', name: 'Euro' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'RWF', name: 'Rwandan Franc' },
  { code: 'ETB', name: 'Ethiopian Birr' },
  { code: 'XAF', name: 'CFA Franc (Central)' },
  { code: 'XOF', name: 'CFA Franc (West)' },
  { code: 'CDF', name: 'Congolese Franc' },
  { code: 'MZN', name: 'Mozambican Metical' },
  { code: 'ZMW', name: 'Zambian Kwacha' },
  { code: 'MWK', name: 'Malawian Kwacha' },
  { code: 'BWP', name: 'Botswana Pula' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'EGP', name: 'Egyptian Pound' },
  { code: 'MAD', name: 'Moroccan Dirham' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'RUB', name: 'Russian Ruble' },
  { code: 'TRY', name: 'Turkish Lira' },
];

export function CurrencySwitcher() {
  const { wallet, user, refreshWallet } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const currentCurrency = wallet?.currency || 'USD';

  const handleChange = async (newCurrency: string) => {
    if (!user || newCurrency === currentCurrency) return;

    setIsLoading(true);
    try {
      const { error } = await db
        .from('wallets')
        .update({ currency: newCurrency, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;

      await refreshWallet();
      toast({
        title: 'Currency updated',
        description: `Wallet currency changed to ${newCurrency} (${getCurrencySymbol(newCurrency)})`,
      });
    } catch (error: any) {
      toast({ title: 'Failed to update currency', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Globe className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold">Wallet Currency</p>
          <p className="text-xs text-muted-foreground">Change your display currency</p>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin ml-auto text-muted-foreground" />}
      </div>

      <Select value={currentCurrency} onValueChange={handleChange} disabled={isLoading}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CURRENCIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {getCurrencySymbol(c.code)} {c.code} — {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
