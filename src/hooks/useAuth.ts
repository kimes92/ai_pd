import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const DEMO_USER_KEY = 'novelai_demo_user';

// Mock user for offline / instant demo mode
const createDemoUser = (): User => ({
  id: 'demo-user-123',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'demo@novelai.local',
  phone: '',
  role: 'authenticated',
  updated_at: new Date().toISOString(),
});

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: ensure isLoading is never stuck on true > 2.5s
    const timeout = setTimeout(() => {
      if (isMounted && isLoading) {
        // Check local demo user fallback
        const savedDemo = localStorage.getItem(DEMO_USER_KEY);
        if (savedDemo) {
          setUser(createDemoUser());
        }
        setIsLoading(false);
      }
    }, 2500);

    // 1. Check local demo user first
    const savedDemo = localStorage.getItem(DEMO_USER_KEY);
    if (savedDemo) {
      setUser(createDemoUser());
      setIsLoading(false);
    }

    // 2. Set up Supabase auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          setSession(session);
          setUser(session.user);
        } else if (!localStorage.getItem(DEMO_USER_KEY)) {
          setSession(null);
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    // 3. Check Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        setSession(session);
        setUser(session.user);
      } else if (!localStorage.getItem(DEMO_USER_KEY)) {
        setSession(null);
        setUser(null);
      }
      setIsLoading(false);
    }).catch((err) => {
      console.warn('Supabase auth session check warning:', err);
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    localStorage.removeItem(DEMO_USER_KEY);
    setUser(null);
    setSession(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore network errors on signout
    }
  };

  const loginAsDemo = () => {
    localStorage.setItem(DEMO_USER_KEY, 'true');
    setUser(createDemoUser());
    setIsLoading(false);
  };

  return { user, session, isLoading, signOut, loginAsDemo };
};
