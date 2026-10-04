import { create } from "zustand";
import { clearSession, getAccessToken, login, logout, type User } from "@/lib/api";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: getAccessToken(),
  signIn: async (email, password) => {
    const user = await login(email, password);
    set({ user, accessToken: getAccessToken() });
  },
  signOut: async () => {
    await logout();
    clearSession();
    set({ user: null, accessToken: null });
  }
}));
