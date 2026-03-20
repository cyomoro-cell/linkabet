import { supabase } from '@/integrations/supabase/client';
import { Profile, Wallet } from '@/lib/supabase';
import { z } from 'zod';

// Password validation schema - Medium security (6+ chars with at least one number)
export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .regex(/\d/, 'Password must contain at least one number');

export const emailSchema = z.string().email('Invalid email address');

export const phoneSchema = z
  .string()
  .min(7, 'Phone number must be at least 7 digits')
  .regex(/^[\d\s-]+$/, 'Enter your phone number without country code');

export const signUpSchema = z.object({
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export type SignUpFormData = z.infer<typeof signUpSchema>;
export type SignInFormData = z.infer<typeof signInSchema>;

export async function signUp(data: SignUpFormData) {
  const { email, phone, password } = data;
  
  const { data: authData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: {
        phone,
      },
    },
  });

  if (error) {
    throw error;
  }

  return authData;
}

export async function signIn(data: SignInFormData) {
  const { email, password } = data;
  
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return authData;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserRole(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching user role:', error);
    return 'user';
  }

  return data?.role || 'user';
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data;
}

export async function getUserWallet(userId: string): Promise<Wallet | null> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching wallet:', error);
    return null;
  }

  return data;
}
