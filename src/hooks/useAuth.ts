import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getUserRole, getUserWallet, getUserProfile } from '@/lib/auth';
import { Wallet, Profile } from '@/lib/supabase';

export type AppRole = 'user' | 'admin' | 'master';

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole;
  profile: Profile | null;
  wallet: Wallet | null;
  isLoading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: 'user',
    profile: null,
    wallet: null,
    isLoading: true,
  });

  const fetchUserData = useCallback(async (userId: string) => {
    const [role, profile, wallet] = await Promise.all([
      getUserRole(userId),
      getUserProfile(userId),
      getUserWallet(userId),
    ]);

    setState((prev) => ({
      ...prev,
      role: role as AppRole,
      profile,
      wallet,
    }));
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setState((prev) => ({
          ...prev,
          session,
          user: session?.user ?? null,
          isLoading: false,
        }));

        // Defer fetching user data to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setState((prev) => ({
            ...prev,
            role: 'user',
            profile: null,
            wallet: null,
          }));
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
        isLoading: false,
      }));

      if (session?.user) {
        fetchUserData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const refreshWallet = useCallback(async () => {
    if (state.user) {
      const wallet = await getUserWallet(state.user.id);
      setState((prev) => ({ ...prev, wallet }));
    }
  }, [state.user]);

  return {
    ...state,
    isAuthenticated: !!state.user,
    isAdmin: state.role === 'admin' || state.role === 'master',
    isMaster: state.role === 'master',
    refreshWallet,
  };
}
