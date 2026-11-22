import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase/client';

export interface Profile {
  id: string;
  fullName: string;
  businessName: string;
  avatarUrl?: string;
  phone?: string;
  website?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    businessName: string,
  ) => Promise<{ error: string | null; message?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null; message?: string }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Clear any legacy demo token
  useEffect(() => {
    localStorage.removeItem('bizora_demo_mode');
  }, []);

  // Fetch profile from Supabase profiles table
  const fetchProfile = async (currentUser: User) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (!error && data) {
        setProfile({
          id: data.id,
          fullName: data.full_name || currentUser.user_metadata?.full_name || '',
          businessName: data.business_name || currentUser.user_metadata?.business_name || '',
          avatarUrl: data.avatar_url,
          phone: data.phone,
          website: data.website,
        });
      } else {
        setProfile({
          id: currentUser.id,
          fullName: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'User',
          businessName: currentUser.user_metadata?.business_name || 'My Studio',
        });
      }
    } catch {
      setProfile({
        id: currentUser.id,
        fullName: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'User',
        businessName: currentUser.user_metadata?.business_name || 'My Studio',
      });
    }
  };

  useEffect(() => {
    let mounted = true;

    // 1. Initial session check directly from Supabase Auth
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!mounted) return;
      if (currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);
        fetchProfile(currentSession.user);
      } else {
        setUser(null);
        setSession(null);
        setProfile(null);
      }
      setLoading(false);
    });

    // 2. Real-time auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        setUser(newSession.user);
        await fetchProfile(newSession.user);
      } else {
        setUser(null);
        setSession(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setLoading(false);
        return { error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        await fetchProfile(data.user);
      }
      setLoading(false);
      return { error: null };
    } catch (err: any) {
      setLoading(false);
      return { error: err.message || 'An unexpected error occurred during sign in.' };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    businessName: string,
  ): Promise<{ error: string | null; message?: string }> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            business_name: businessName.trim(),
          },
        },
      });

      if (error) {
        setLoading(false);
        return { error: error.message };
      }

      if (data.session && data.user) {
        setUser(data.user);
        setSession(data.session);
        await fetchProfile(data.user);
        setLoading(false);
        return { error: null };
      }

      setLoading(false);
      return {
        error: null,
        message: 'Account created! Please verify your email or sign in.',
      };
    } catch (err: any) {
      setLoading(false);
      return { error: err.message || 'Failed to create account.' };
    }
  };

  const signOut = async () => {
    setLoading(true);
    setUser(null);
    setProfile(null);
    setSession(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore offline error
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string): Promise<{ error: string | null; message?: string }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      if (error) return { error: error.message };
      return {
        error: null,
        message: 'Password reset link sent! Check your email inbox.',
      };
    } catch (err: any) {
      return { error: err.message || 'Unable to request password reset.' };
    }
  };

  const updateProfile = async (updates: Partial<Profile>): Promise<{ error: string | null }> => {
    if (!user) return { error: 'No authenticated user found' };
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: updates.fullName,
        business_name: updates.businessName,
        phone: updates.phone,
        website: updates.website,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        await supabase.auth.updateUser({
          data: {
            full_name: updates.fullName,
            business_name: updates.businessName,
          },
        });
      }

      setProfile((prev) => (prev ? { ...prev, ...updates } : null));
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Failed to update profile' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
