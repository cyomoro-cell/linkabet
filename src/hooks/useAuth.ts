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
  hasLoadedUserData: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: 'user',
    profile: null,
    wallet: null,
    isLoading: true,
    hasLoadedUserData: false,
  });

  const fetchUserData = useCallback(async (userId: string) => {
    setState((prev) => ({ ...prev, isLoading: true, hasLoadedUserData: false }));

    // Ensure the user's profile/wallet/role records exist in our database.
    // This is idempotent and safe to call on every sign-in.
    try {
      await supabase.functions.invoke('bootstrap-user', { body: {} });
    } catch (e) {
      console.warn('bootstrap-user failed (continuing):', e);
    }

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
      isLoading: false,
      hasLoadedUserData: true,
    }));
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;

      if (!user) {
        setState((prev) => ({
          ...prev,
          session: null,
          user: null,
          role: 'user',
          profile: null,
          wallet: null,
          isLoading: false,
          hasLoadedUserData: false,
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        session,
        user,
        isLoading: true,
        hasLoadedUserData: false,
      }));

      // Defer fetching user data to avoid deadlock
      setTimeout(() => {
        fetchUserData(user.id);
      }, 0);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;

      if (!user) {
        setState((prev) => ({
          ...prev,
          session: null,
          user: null,
          isLoading: false,
          hasLoadedUserData: false,
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        session,
        user,
        isLoading: true,
        hasLoadedUserData: false,
      }));

      fetchUserData(user.id);
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
