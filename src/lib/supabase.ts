import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Create an untyped client for tables not yet in the generated types
export const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
}) as SupabaseClient<any>;

// Type definitions for our custom tables
export interface Profile {
  id: string;
  email: string;
  phone: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'user' | 'admin' | 'master';
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'deposit' | 'withdrawal' | 'bet' | 'win' | 'ai_fee' | 'refund';
  amount: number;
  fee: number;
  net_amount: number;
  description: string | null;
  reference_id: string | null;
  status: string;
  created_at: string;
}

export interface Bet {
  id: string;
  user_id: string;
  match_id: string;
  match_data: any;
  selections: any;
  stake: number;
  total_odds: number;
  potential_win: number;
  status: 'pending' | 'won' | 'lost' | 'cancelled' | 'cashout';
  result_data: any;
  created_at: string;
  settled_at: string | null;
}

export interface AIUsage {
  id: string;
  user_id: string;
  prompt: string;
  response: string | null;
  tokens_used: number;
  fee_charged: number;
  created_at: string;
}
