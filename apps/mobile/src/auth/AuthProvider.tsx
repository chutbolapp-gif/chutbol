// Login state: the Supabase session (phone OTP), kept in AsyncStorage across restarts.
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthCtx {
  /** false until the saved session was read from storage */
  ready: boolean;
  session: Session | null;
  userId: string | null;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let live = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    ready,
    session,
    userId: session?.user.id ?? null,
    signOut: async () => { await supabase.auth.signOut(); },
  }), [ready, session]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
