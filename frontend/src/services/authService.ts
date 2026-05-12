import api from './api';
import type { 
  LoginRequest, 
  RegisterRequest, 
  RefreshTokenRequest,
  AuthResponse,
  User,
  TokenPair 
} from '../types/auth';

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface LoginProvider {
  id: string;
  name: string;
  type: 'local' | 'ldap' | 'oauth2' | 'saml' | string;
  enabled: boolean;
  icon?: string;
  label?: string;
  config?: Record<string, unknown>;
}

export interface LoginConfig {
  providers: LoginProvider[];
  allow_username_or_email_login: boolean;
}

export const authService = {
  getLoginConfig: async (): Promise<LoginConfig> => {
    const response = await api.get('/auth/config');
    return response.data.data;
  },

  loginWithProvider: async (providerId: string, data: Record<string, unknown>): Promise<AuthResponse> => {
    let endpoint = `/auth/login/${providerId}`;
    if (providerId === 'local') {
      endpoint = '/auth/login';
    } else if (providerId === 'ldap') {
      endpoint = '/auth/login/ldap';
    }
    
    const response = await api.post(endpoint, data);
    if (response.data.data) {
      const { access_token, refresh_token, user } = response.data.data as TokenPair;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
    }
    return response.data;
  },

  ldapLogin: async (data: LoginRequest): Promise<AuthResponse> => {
    return authService.loginWithProvider('ldap', data as unknown as Record<string, unknown>);
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    return authService.loginWithProvider('local', data as unknown as Record<string, unknown>);
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  refreshToken: async (data: RefreshTokenRequest): Promise<AuthResponse> => {
    const response = await api.post('/auth/refresh', data);
    if (response.data.data) {
      const { access_token, refresh_token } = response.data.data as unknown as { access_token: string; refresh_token: string };
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
    }
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data.data;
  },

  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    await api.post('/auth/change-password', data);
  },
};
