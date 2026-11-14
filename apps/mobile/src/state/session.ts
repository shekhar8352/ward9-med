import { create } from 'zustand';
import { supabase, supabaseConfigured } from '../data/supabase';
import { setCurrentUser, getState } from '../data/memoryStore';
import { kvDel, kvGet, kvSet } from '../security/kv';

const LOCK_AT = 'ward9.lock.at';
const USER_KEY = 'ward9.session.user';
const LOCK_MS = 15 * 60 * 1000;

type SessionState = {
  ready: boolean;
  phone: string | null;
  userId: string | null;
  locked: boolean;
  boot: () => Promise<void>;
  setPhone: (phone: string) => void;
  completeLogin: (userId: string) => Promise<void>;
  lock: () => void;
  unlock: () => void;
  noteBackground: () => Promise<void>;
  noteForeground: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useSession = create<SessionState>((set, get) => ({
  ready: false,
  phone: null,
  userId: null,
  locked: true,
  boot: async () => {
    if (supabaseConfigured && supabase) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setCurrentUser(data.session.user.id);
        set({ userId: data.session.user.id, locked: true, ready: true });
        return;
      }
    }
    const stored = await kvGet(USER_KEY);
    if (stored) {
      setCurrentUser(stored);
      set({ userId: stored, locked: true, ready: true });
      return;
    }
    set({ ready: true });
  },
  setPhone: (phone) => set({ phone }),
  completeLogin: async (userId) => {
    setCurrentUser(userId);
    await kvSet(USER_KEY, userId);
    set({ userId, locked: false });
  },
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false }),
  noteBackground: async () => {
    await kvSet(LOCK_AT, String(Date.now()));
  },
  noteForeground: async () => {
    const raw = await kvGet(LOCK_AT);
    if (raw && Date.now() - Number(raw) >= LOCK_MS) {
      get().lock();
    }
  },
  logout: async () => {
    if (supabase) await supabase.auth.signOut();
    await kvDel(USER_KEY);
    set({ userId: null, locked: true, phone: null });
  },
}));

export function demoUserForPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  const user = getState().users.find((u) => u.phone.replace(/\D/g, '').endsWith(digits.slice(-10)));
  return user?.id ?? (digits.endsWith('000001') ? 'user-admin' : digits.endsWith('000002') ? 'user-res-a' : digits.endsWith('000003') ? 'user-res-b' : null);
}
