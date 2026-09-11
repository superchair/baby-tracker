import { lazy, Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Auth0Provider } from '@auth0/auth0-react';
import type { AppState } from '@auth0/auth0-react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AUTH0_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_DOMAIN } from './authConfig';
import { getRuntimeConfig, resetRuntimeConfig } from './api/runtimeConfig';
import { FullScreenError } from './components/FullScreenError';
import { Layout } from './components/Layout';
import { LoadingScreen } from './components/LoadingScreen';
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

// Route-level code splitting: each page (and its dependencies, e.g. Recharts
// for Stats) loads on demand instead of all being in the initial bundle.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const History = lazy(() => import('./pages/History'));
const Login = lazy(() => import('./pages/Login'));
const Settings = lazy(() => import('./pages/Settings'));
const Stats = lazy(() => import('./pages/Stats'));

/** Wires Auth0's post-login redirect back into React Router. Must live
 * inside BrowserRouter (needs useNavigate) and outside our own AuthProvider
 * (which consumes the SDK's context). */
function Auth0ProviderWithNavigate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: AUTH0_AUDIENCE,
        scope: 'openid profile email offline_access',
      }}
      useRefreshTokens
      cacheLocation="localstorage"
      onRedirectCallback={(appState?: AppState) => {
        navigate(appState?.returnTo ?? '/', { replace: true });
      }}
    >
      {children}
    </Auth0Provider>
  );
}

type GateState = 'loading' | 'ready' | 'error';

/**
 * Resolves the runtime /config.json (or the VITE_API_URL dev fallback) once,
 * before anything that might make an API call renders.
 */
function ConfigGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>('loading');
  const [message, setMessage] = useState('');

  function attempt() {
    setState('loading');
    getRuntimeConfig()
      .then(() => setState('ready'))
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : 'Failed to load app configuration.');
        setState('error');
      });
  }

  useEffect(() => {
    attempt();
  }, []);

  if (state === 'loading') {
    return <LoadingScreen label="Starting up…" />;
  }
  if (state === 'error') {
    return (
      <FullScreenError
        title="Could not connect"
        message={message}
        onRetry={() => {
          resetRuntimeConfig();
          attempt();
        }}
      />
    );
  }
  return <>{children}</>;
}

function App() {
  return (
    <ConfigGate>
      <BrowserRouter>
        <Auth0ProviderWithNavigate>
          <AuthProvider>
            <Suspense fallback={<LoadingScreen label="Loading…" />}>
              <Routes>
                <Route element={<PublicOnlyRoute />}>
                  <Route path="/login" element={<Login />} />
                </Route>
                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/stats" element={<Stats />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </Auth0ProviderWithNavigate>
      </BrowserRouter>
    </ConfigGate>
  );
}

export default App;
