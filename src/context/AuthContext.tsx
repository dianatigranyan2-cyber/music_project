'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '../lib/supabase/client';

export interface Profile {
  id: string;
  username: string;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkUsernameTaken: (username: string) => Promise<boolean>;
  updateProfile: (updates: {
    username?: string;
    display_name?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
  }) => Promise<{ error?: string }>;
  uploadAvatar: (file: File) => Promise<{ url?: string; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, fallbackUsername?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data as Profile);
      } else if (fallbackUsername) {
        // Fallback: If authenticated user exists but profile row missing, insert now
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .upsert({ id: userId, username: fallbackUsername }, { onConflict: 'id' })
          .select()
          .single();

        if (!insertError && newProfile) {
          setProfile(newProfile as Profile);
        } else {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      const fallbackName = user.user_metadata?.username || user.email?.split('@')[0];
      await fetchProfile(user.id, fallbackName);
    }
  };

  const checkUsernameTaken = async (username: string): Promise<boolean> => {
    if (!username || !username.trim()) return false;
    try {
      const cleanUsername = username.trim();
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (!data) return false;
      // If the row belongs to current logged in user, it's not "taken" by someone else
      return data.id !== user?.id;
    } catch {
      return false;
    }
  };

  const updateProfile = async (updates: {
    username?: string;
    display_name?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
  }) => {
    if (!user?.id) return { error: 'Вы не авторизованы' };

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        const errLower = error.message.toLowerCase();
        if (
          error.code === '23505' ||
          errLower.includes('unique constraint') ||
          errLower.includes('profiles_username_lower_idx') ||
          errLower.includes('profiles_username_key')
        ) {
          return { error: 'Это имя пользователя уже занято. Попробуйте другое.' };
        }
        return { error: error.message };
      }

      if (data) {
        setProfile(data as Profile);
      }

      return {};
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка при обновлении профиля';
      return { error: message };
    }
  };

  const uploadAvatar = async (file: File): Promise<{ url?: string; error?: string }> => {
    if (!user?.id) return { error: 'Вы не авторизованы' };

    // Validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return { error: 'Допустимы только изображения в формате JPEG, PNG или WebP' };
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      return { error: 'Размер файла не должен превышать 5 МБ' };
    }

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        return { error: uploadError.message };
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      // Update profile in database
      const updateResult = await updateProfile({ avatar_url: publicUrl });
      if (updateResult.error) {
        return { error: updateResult.error };
      }

      return { url: publicUrl };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка при загрузке аватарки';
      return { error: message };
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user?.id) {
          const fallbackName = session.user.user_metadata?.username || session.user.email?.split('@')[0];
          await fetchProfile(session.user.id, fallbackName);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        const fallbackName = session.user.user_metadata?.username || session.user.email?.split('@')[0];
        await fetchProfile(session.user.id, fallbackName);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signUp = async (email: string, password: string, username: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });

      if (authError) {
        return { error: authError.message };
      }

      if (!authData.user) {
        return { error: 'Не удалось создать аккаунт' };
      }

      return {};
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Произошла непредвиденная ошибка';
      return { error: message };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        const fallbackName = data.user.user_metadata?.username || data.user.email?.split('@')[0];
        await fetchProfile(data.user.id, fallbackName);
      }

      return {};
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Произошла непредвиденная ошибка';
      return { error: message };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        checkUsernameTaken,
        updateProfile,
        uploadAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
