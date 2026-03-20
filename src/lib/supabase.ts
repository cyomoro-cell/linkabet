import { createClient } from '@supabase/supabase-js';
import { Database } from '../integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// Create a typed client
export const db = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Type definitions for our custom tables from the Database type
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type UserRole = Database['public']['Tables']['user_roles']['Row'];
export type Wallet = Database['public']['Tables']['wallets']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type Bet = Database['public']['Tables']['bets']['Row'];
export type AIUsage = Database['public']['Tables']['ai_usage']['Row'];
export type SystemSetting = Database['public']['Tables']['system_settings']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
