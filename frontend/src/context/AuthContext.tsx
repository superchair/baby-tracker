import { useAuth0 } from '@auth0/auth0-react';
import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { UNAUTHORIZED_EVENT } from '../api/client';
import { setTokenGetter } from '../api/authToken';
import { setCaregiverName } from '../api/caregiverName';

interface AuthContextValue {
  name: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Set when Auth0 itself reports a login/callback failure (e.g. bad audience, denied consent). */
  error: string | null;
  login: (returnTo?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0();

  // Bridge the SDK's token getter into the plain-function API client, which
  // can't call useAuth0() directly.
  useEffect(() => {
    setTokenGetter(async () => {
      if (!isAuthenticated) return null;
      try {
        return await getAccessTokenSilently();
      } catch {
        return null;
      }
    });
  }, [isAuthenticated, getAccessTokenSilently]);

  // Keep the API client's caregiver-name header (used for event attribution)
  // in sync with the authenticated user's profile.
  useEffect(() => {
    setCaregiverName(isAuthenticated ? (user?.name ?? user?.email ?? null) : null);
  }, [isAuthenticated, user]);

  const logout = useMemo(
    () => () => auth0Logout({ logoutParams: { returnTo: window.location.origin } }),
    [auth0Logout],
  );

  // If the API ever rejects a token outright (not just "needs a silent
  // refresh"), force a full re-login rather than looping.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  const login = useMemo(
    () => (returnTo?: string) => loginWithRedirect({ appState: { returnTo } }),
    [loginWithRedirect],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      name: user?.name ?? user?.email ?? null,
      isAuthenticated,
      isLoading,
      error: error?.message ?? null,
      login,
      logout,
    }),
    [user, isAuthenticated, isLoading, error, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
