import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { authService, type LoginProvider, type LoginConfig } from '../../services/authService';
import LanguageSwitcher from '../../components/LanguageSwitcher';

interface LoginCredentials {
  username: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const [credentials, setCredentials] = useState<LoginCredentials>({ username: '', password: '' });
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [loginConfig, setLoginConfig] = useState<LoginConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isLoading, setUser, setAuthenticated } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await authService.getLoginConfig();
        console.log('Login config fetched:', config);
        setLoginConfig(config);
        
        if (config.providers.length > 0) {
          setSelectedProvider(config.providers[0].id);
        } else {
          console.warn('No providers found in login config');
        }
      } catch (err) {
        console.error('Failed to fetch login config:', err);
        setLoginConfig({
          providers: [
            { id: 'local', name: 'Local', type: 'local', enabled: true },
          ],
          allow_username_or_email_login: true,
        });
        setSelectedProvider('local');
      } finally {
        setConfigLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const enabledProviders = loginConfig?.providers.filter(p => p.enabled) || [];
  const selectedProviderData = enabledProviders.find(p => p.id === selectedProvider);
  const showPasswordForm = selectedProviderData?.type === 'local' || selectedProviderData?.type === 'ldap';
  const showOAuthButton = selectedProviderData?.type === 'oauth2' || selectedProviderData?.type === 'saml';

  const getTranslatedErrorMessage = (error: any): string => {
    let rawError = 'Login failed';
    if (error.response?.data?.error) {
      rawError = error.response.data.error;
    } else if (error.response?.data?.message) {
      rawError = error.response.data.message;
    } else if (error.message) {
      rawError = error.message;
    } else if (typeof error === 'string') {
      rawError = error;
    }

    if (rawError.includes('PENDING_APPROVAL:')) {
      return t('auth.pendingApproval') || 'Your account is pending approval.';
    }

    const errorLower = rawError.toLowerCase();
    if (errorLower.includes('invalid') || errorLower.includes('password') || errorLower.includes('credentials')) {
      return t('auth.invalidCredentials') || 'Invalid username or password';
    }

    const defaultError = t('auth.loginFailed');
    return defaultError && defaultError !== 'auth.loginFailed' ? defaultError : rawError;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!credentials.username.trim()) {
      setError(t('auth.usernameRequired') || 'Username is required');
      return;
    }
    if (!credentials.password) {
      setError(t('auth.passwordRequired') || 'Password is required');
      return;
    }

    if (!selectedProvider) return;

    setIsSubmitting(true);
    try {
      await authService.loginWithProvider(selectedProvider, credentials);
      const user = await authService.getCurrentUser();
      setUser(user);
      setAuthenticated(true);
      navigate('/dashboard');
    } catch (err: any) {
      setError(getTranslatedErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthLogin = async (providerId: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await authService.loginWithProvider(providerId, {});
      const user = await authService.getCurrentUser();
      setUser(user);
      setAuthenticated(true);
      navigate('/dashboard');
    } catch (err: any) {
      setError(getTranslatedErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProviderIcon = (provider: LoginProvider): string => {
    switch (provider.type) {
      case 'local':
        return '🔐';
      case 'ldap':
        return '📁';
      case 'oauth2':
        if (provider.id === 'google') return 'Google';
        if (provider.id === 'github') return 'GitHub';
        if (provider.id === 'azure') return 'Azure';
        return '🌐';
      case 'saml':
        return '🏢';
      default:
        return '🔑';
    }
  };

  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-4">
      <div className="app-panel-warm relative w-full max-w-md space-y-8 p-8">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>

        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            {t('auth.signInTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('auth.subtitle')}
          </p>
        </div>

        {enabledProviders.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {enabledProviders.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => {
                  setError(null);
                  setSelectedProvider(provider.id);
                }}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  selectedProvider === provider.id
                    ? 'bg-gradient-to-r from-[#ef6b4a] to-[#dc2626] text-white shadow-md'
                    : 'bg-[rgba(255,248,245,0.5)] text-gray-600 hover:text-gray-900 border border-[#ead8cf]'
                }`}
              >
                <span>{getProviderIcon(provider)}</span>
                <span>{provider.label || t(`auth.${provider.id}Login`) || provider.name}</span>
              </button>
            ))}
          </div>
        )}

        {enabledProviders.length === 1 && selectedProviderData && (
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,248,245,0.9)] px-4 py-1.5 text-sm font-semibold text-[#dc2626] border border-[#ead8cf]">
              <span>{getProviderIcon(selectedProviderData)}</span>
              <span>{selectedProviderData.label || t(`auth.${selectedProviderData.id}Login`) || selectedProviderData.name}</span>
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {configLoading ? (
          <div className="mt-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#dc2626]"></div>
          </div>
        ) : enabledProviders.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-yellow-200 bg-yellow-50 px-6 py-4 text-center text-yellow-800">
            <p className="font-medium">Login temporarily unavailable</p>
            <p className="mt-1 text-sm">Please contact the administrator.</p>
          </div>
        ) : showPasswordForm ? (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  {t('auth.username')}
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={credentials.username}
                  onChange={(e) => {
                    if (error) setError(null);
                    setCredentials(prev => ({ ...prev, username: e.target.value }));
                  }}
                  autoComplete="username"
                  className="app-input mt-1 block w-full"
                  placeholder={t('auth.usernamePlaceholder')}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  {t('auth.password')}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={credentials.password}
                  onChange={(e) => {
                    if (error) setError(null);
                    setCredentials(prev => ({ ...prev, password: e.target.value }));
                  }}
                  autoComplete="current-password"
                  className="app-input mt-1 block w-full"
                  placeholder={t('auth.passwordPlaceholder')}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="app-button-primary flex w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
              </button>
            </div>
          </form>
        ) : showOAuthButton && selectedProviderData ? (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => handleOAuthLogin(selectedProviderData.id)}
              disabled={isSubmitting || isLoading}
              className="app-button-primary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{getProviderIcon(selectedProviderData)}</span>
              <span>{isSubmitting ? t('auth.signingIn') : t('auth.signInWith', { provider: selectedProviderData.name })}</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default LoginPage;
