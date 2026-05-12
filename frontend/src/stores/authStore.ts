import { create } from 'zustand';
import type { User } from '../types/auth';
import { authService } from '../services/authService';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setSubmitting: (value: boolean) => void;
  setError: (error: string | null) => void;

  // Async actions
  login: (username: string, password: string) => Promise<void>;
  ldapLogin: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Check if there's a token on initialization
  const hasToken = !!localStorage.getItem('access_token');

  // Debug: Track state changes
  const trackStateChange = (newState: Partial<AuthState>) => {
    if ('error' in newState) {
      console.log('[authStore] Error state changed:', {
        oldError: get().error,
        newError: newState.error,
        timestamp: new Date().toISOString()
      });
    }
  };

  return {
    user: null,
    isAuthenticated: false,
    isLoading: hasToken, // If has token, start in loading state
    isSubmitting: false,
    error: null,

    setUser: (user) => set({ user }),
    setAuthenticated: (value) => set({ isAuthenticated: value }),
    setLoading: (value) => set({ isLoading: value }),
    setSubmitting: (value) => {
      console.log('[authStore] setSubmitting called:', value);
      set({ isSubmitting: value });
    },
    setError: (error) => {
      console.log('[authStore] setError called:', error);
      trackStateChange({ error });
      set({ error });
    },
    clearError: () => {
      console.log('[authStore] clearError called');
      trackStateChange({ error: null });
      set({ error: null });
    },

    login: async (username, password) => {
      console.log('[authStore] login started');
      set({ isSubmitting: true });
      try {
        await authService.login({ username, password });
        const user = await authService.getCurrentUser();
        console.log('[authStore] Login successful, clearing error');
        trackStateChange({ error: null });
        set({ user, isAuthenticated: true, isSubmitting: false, error: null });
      } catch (err: any) {
        console.log('[authStore] login failed:', err);
        let errorMessage = 'Login failed';
        
        // 尝试从多个可能的位置提取错误信息
        if (err.response) {
          if (err.response.data) {
            errorMessage = err.response.data.error || err.response.data.message || errorMessage;
          } else if (typeof err.response === 'string') {
            errorMessage = err.response;
          }
        } else if (err.message) {
          errorMessage = err.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        }
        
        console.log('[authStore] Setting error message:', errorMessage);
        trackStateChange({ error: errorMessage });
        set({
          error: errorMessage,
          isSubmitting: false,
          isAuthenticated: false
        });
        console.log('[authStore] Error state after set:', { errorMessage, isSubmitting: false });
        throw err;
      }
    },

    ldapLogin: async (username, password) => {
      console.log('[authStore] ldapLogin started');
      set({ isSubmitting: true });
      try {
        await authService.ldapLogin({ username, password });
        const user = await authService.getCurrentUser();
        console.log('[authStore] LDAP login successful, clearing error');
        trackStateChange({ error: null });
        set({ user, isAuthenticated: true, isSubmitting: false, error: null });
      } catch (err: any) {
        console.log('[authStore] ldapLogin failed:', err);
        let errorMessage = 'LDAP login failed';
        
        // 尝试从多个可能的位置提取错误信息
        if (err.response) {
          if (err.response.data) {
            errorMessage = err.response.data.error || err.response.data.message || errorMessage;
          } else if (typeof err.response === 'string') {
            errorMessage = err.response;
          }
        } else if (err.message) {
          errorMessage = err.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        }
        
        console.log('[authStore] Setting error message:', errorMessage);
        trackStateChange({ error: errorMessage });
        set({
          error: errorMessage,
          isSubmitting: false,
          isAuthenticated: false
        });
        console.log('[authStore] Error state after set:', { errorMessage, isSubmitting: false });
        throw err;
      }
    },

    register: async (username, email, password) => {
      set({ isSubmitting: true, error: null });
      try {
        await authService.register({ username, email, password });
        // Auto login after registration
        await authService.login({ username, password });
        const user = await authService.getCurrentUser();
        set({ user, isAuthenticated: true, isSubmitting: false });
      } catch (err: any) {
        let errorMessage = 'Registration failed';
        
        // 尝试从多个可能的位置提取错误信息
        if (err.response) {
          if (err.response.data) {
            errorMessage = err.response.data.error || err.response.data.message || errorMessage;
          } else if (typeof err.response === 'string') {
            errorMessage = err.response;
          }
        } else if (err.message) {
          errorMessage = err.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        }
        
        set({
          error: errorMessage,
          isSubmitting: false
        });
        throw err;
      }
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        await authService.logout();
      } finally {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          isSubmitting: false,
          error: null
        });
      }
    },

    fetchCurrentUser: async () => {
      set({ isLoading: true });
      const token = localStorage.getItem('access_token');
      if (!token) {
        set({ isAuthenticated: false, user: null, isLoading: false });
        return;
      }

      try {
        const user = await authService.getCurrentUser();
        set({ user, isAuthenticated: true, isLoading: false });
      } catch (err) {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false
        });
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    },
  };
});