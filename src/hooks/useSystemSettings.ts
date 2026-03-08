import { useEffect, useState } from 'react';
import { db } from '@/lib/supabase';

export interface SystemSettings {
  betting_enabled: boolean;
  deposits_enabled: boolean;
  withdrawals_enabled: boolean;
  deposit_fee_percentage: number;
  withdrawal_fee_percentage: number;
  min_bet_amount: number;
  max_bet_amount: number;
}

const DEFAULTS: SystemSettings = {
  betting_enabled: true,
  deposits_enabled: true,
  withdrawals_enabled: true,
  deposit_fee_percentage: 5,
  withdrawal_fee_percentage: 5,
  min_bet_amount: 1,
  max_bet_amount: 10000,
};

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await db.from('system_settings').select('key, value');
      if (data && data.length > 0) {
        const merged = { ...DEFAULTS };
        for (const row of data as { key: string; value: any }[]) {
          if (row.key in merged) {
            (merged as any)[row.key] = row.value;
          }
        }
        setSettings(merged);
      }
      setIsLoading(false);
    };
    fetch();
  }, []);

  return { settings, isLoading };
}
