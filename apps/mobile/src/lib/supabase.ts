// The one Supabase client. Only the public (anon / publishable) key is ever in the app; access is
// enforced by Postgres RLS. Values come from apps/mobile/.env (gitignored, see .env.example).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/** False when .env is missing: the app shows a setup message instead of failing requests. */
export const supabaseConfigured = !!url && !!key;

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: {
    // the session survives app restarts (Expo Go friendly: no native module beyond AsyncStorage)
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

// refresh the token only while the app is in the foreground
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', state => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
