/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import type { AuthStatusResponse, PublicConfigResponse } from '../shared/config.ts';
import { fetchAuthStatus, fetchPublicConfig, logoutAdmin } from './lib/api.ts';
import { LandingPage } from './pages/LandingPage.tsx';
import { AdminLoginPage } from './pages/AdminLoginPage.tsx';
import { AdminDashboardPage, type AdminTab } from './pages/AdminDashboardPage.tsx';

function getInitialTabFromSearch(search: string): AdminTab {
  const params = new URLSearchParams(search);
  const tab = params.get('tab');
  if (tab === 'business' || tab === 'google-url' || tab === 'branding' || tab === 'guide') {
    return tab;
  }
  return 'qr';
}

export default function App() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname);
  const [search, setSearch] = useState<string>(() => window.location.search);

  const [configData, setConfigData] = useState<PublicConfigResponse | null>(null);
  const [configLoading, setConfigLoading] = useState<boolean>(true);
  const [configError, setConfigError] = useState<string | null>(null);

  // Admin session Bearer token kept strictly in React memory (never localStorage/sessionStorage)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      const res = await fetchPublicConfig();
      setConfigData(res);
      document.title = res.config.businessName || 'Quick Google Review';
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Unable to load application data.');
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const loadAuthStatus = useCallback(async (tokenToVerify: string | null) => {
    setAuthLoading(true);
    try {
      const status = await fetchAuthStatus(tokenToVerify);
      setAuthStatus(status);
      if (!status.authenticated && tokenToVerify) {
        setAdminToken(null);
      }
    } catch {
      setAuthStatus({ initialized: true, envManaged: false, authenticated: false });
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const isAdminRoute = pathname.startsWith('/admin');

  useEffect(() => {
    if (isAdminRoute) {
      loadAuthStatus(adminToken);
    }
  }, [isAdminRoute, adminToken, loadAuthStatus]);

  const navigate = useCallback((to: string) => {
    const url = new URL(to, window.location.origin);
    window.history.pushState({}, '', url.pathname + url.search);
    setPathname(url.pathname);
    setSearch(url.search);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const handleAuthenticated = (newToken: string) => {
    setAdminToken(newToken);
    setAuthStatus({
      initialized: true,
      envManaged: authStatus?.envManaged ?? false,
      authenticated: true,
    });
  };

  const handleSignOut = async () => {
    const current = adminToken;
    setAdminToken(null);
    setAuthStatus((prev) => (prev ? { ...prev, authenticated: false } : null));
    await logoutAdmin(current);
  };

  if (isAdminRoute) {
    if (authLoading || !authStatus || !configData) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="text-sm text-slate-500">Loading admin workspace...</div>
        </div>
      );
    }

    if (!adminToken || !authStatus.authenticated) {
      return (
        <AdminLoginPage
          initialized={authStatus.initialized}
          envManaged={authStatus.envManaged}
          businessName={configData.config.businessName}
          onAuthenticated={handleAuthenticated}
          onNavigateHome={() => navigate('/')}
        />
      );
    }

    return (
      <AdminDashboardPage
        initialData={configData}
        token={adminToken}
        envManaged={authStatus.envManaged}
        initialTab={getInitialTabFromSearch(search)}
        onConfigUpdated={(updated) => {
          setConfigData(updated);
          document.title = updated.config.businessName || 'Quick Google Review';
        }}
        onSignOut={handleSignOut}
        onNavigateHome={() => navigate('/')}
      />
    );
  }

  return (
    <LandingPage
      data={configData}
      loading={configLoading}
      error={configError}
      onRetry={loadConfig}
      onNavigate={navigate}
    />
  );
}
