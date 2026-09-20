import type {Session, User} from '@supabase/supabase-js';
import {create} from 'zustand';
import {
  getSession,
  onAuthStateChange,
  signInWithPassword,
  signOut as supabaseSignOut,
  signUpWithPassword,
} from './supabaseClient';

export type AuthStatus = 'idle' | 'loading' | 'ready';

type AuthState = {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  /** True only while sign-in / sign-up / sign-out is in flight (not bootstrap). */
  pending: boolean;
  error: string | null;
  /** True after first session resolution (including anonymous). */
  bootstrapped: boolean;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

let unsubscribeAuth: (() => void) | null = null;

function applySession(
  set: (partial: Partial<AuthState>) => void,
  session: Session | null,
) {
  set({
    session,
    user: session?.user ?? null,
    status: 'ready',
    bootstrapped: true,
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  status: 'idle',
  pending: false,
  error: null,
  bootstrapped: false,

  clearError: () => set({error: null}),

  bootstrap: async () => {
    if (get().bootstrapped && unsubscribeAuth) {
      return;
    }
    // Do not set pending — that greys out the Sign in button.
    set({status: 'loading', error: null});
    try {
      const session = await getSession();
      applySession(set, session);
    } catch (err) {
      set({
        session: null,
        user: null,
        status: 'ready',
        bootstrapped: true,
        error: null,
      });
    }
    if (unsubscribeAuth) {
      unsubscribeAuth();
    }
    unsubscribeAuth = onAuthStateChange(session => {
      applySession(set, session);
    });
  },

  signIn: async (email, password) => {
    set({pending: true, error: null});
    try {
      const {session, error} = await signInWithPassword(email, password);
      if (error) {
        set({pending: false, status: 'ready', error});
        return false;
      }
      applySession(set, session);
      set({pending: false, error: null});
      return true;
    } catch (err) {
      set({
        pending: false,
        status: 'ready',
        error: err instanceof Error ? err.message : 'Sign in failed',
      });
      return false;
    }
  },

  signUp: async (email, password) => {
    set({pending: true, error: null});
    try {
      const {session, error} = await signUpWithPassword(email, password);
      if (error) {
        set({pending: false, status: 'ready', error});
        return false;
      }
      // Email confirmation may leave session null until verified.
      if (session) {
        applySession(set, session);
        set({pending: false, error: null});
        return true;
      }
      set({
        pending: false,
        status: 'ready',
        error:
          'Account created. Check your email to confirm, then sign in.',
      });
      return false;
    } catch (err) {
      set({
        pending: false,
        status: 'ready',
        error: err instanceof Error ? err.message : 'Sign up failed',
      });
      return false;
    }
  },

  signOut: async () => {
    set({pending: true, error: null});
    try {
      await supabaseSignOut();
      set({
        session: null,
        user: null,
        status: 'ready',
        pending: false,
        error: null,
      });
    } catch (err) {
      set({
        pending: false,
        status: 'ready',
        error: err instanceof Error ? err.message : 'Sign out failed',
      });
    }
  },
}));
