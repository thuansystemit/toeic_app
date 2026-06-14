import { create } from 'zustand';
import type { PublicUser } from '../types/user';

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  // True until the initial silent-refresh on page load resolves. Guards routes
  // from redirecting to /login before the session has had a chance to restore.
  isBootstrapping: boolean;
  setAuth: (user: PublicUser, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  updateUser: (patch: Partial<PublicUser>) => void;
  finishBootstrap: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isBootstrapping: true,
  setAuth: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true }),
  setAccessToken: (accessToken) => set({ accessToken }),
  updateUser: (patch) =>
    set((state) => ({ user: state.user ? { ...state.user, ...patch } : null })),
  finishBootstrap: () => set({ isBootstrapping: false }),
  clear: () => set({ user: null, accessToken: null, isAuthenticated: false }),
}));
