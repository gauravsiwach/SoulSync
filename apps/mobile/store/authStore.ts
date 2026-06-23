import { create } from 'zustand';

interface AuthState {
  token: string | null;
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setToken: (token: string) => void;
  setUser: (user: any) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const TOKEN_KEY = 'soulsync_token';
const USER_KEY = 'soulsync_user';

// Helper functions for localStorage storage
const storage = {
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  },
  
  async getItem(key: string): Promise<string | null> {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  
  async deleteItem(key: string): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setToken: async (token: string) => {
    try {
      await storage.setItem(TOKEN_KEY, token);
      set({ token, isAuthenticated: true });
    } catch (error) {
      console.error('[AUTH_STORE] Error saving token:', error);
    }
  },

  setUser: async (user: any) => {
    try {
      await storage.setItem(USER_KEY, JSON.stringify(user));
      set({ user });
    } catch (error) {
      console.error('[AUTH_STORE] Error saving user:', error);
    }
  },

  logout: async () => {
    try {
      await storage.deleteItem(TOKEN_KEY);
      await storage.deleteItem(USER_KEY);
      set({ token: null, user: null, isAuthenticated: false });
    } catch (error) {
      console.error('[AUTH_STORE] Error during logout:', error);
    }
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true });
      const token = await storage.getItem(TOKEN_KEY);
      const userStr = await storage.getItem(USER_KEY);
      
      if (token) {
        const user = userStr ? JSON.parse(userStr) : null;
        set({ token, user, isAuthenticated: true, isLoading: false });
      } else {
        set({ token: null, user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      console.error('[AUTH_STORE] Error checking auth:', error);
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
