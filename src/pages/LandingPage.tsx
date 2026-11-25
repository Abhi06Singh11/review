import { RefreshCw, AlertTriangle } from 'lucide-react';
import type { PublicConfigResponse } from '../../shared/config.ts';
import { CustomerLandingCard } from '../components/CustomerLandingCard.tsx';

interface LandingPageProps {
  data: PublicConfigResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onNavigate: (path: string) => void;
}

export function LandingPage({
  data,
  loading,
  error,
  onRetry,
  onNavigate,
}: LandingPageProps) {
  const secondaryBg = data?.config.secondaryColor || '#F1F5F9';

  return (
    <div
      className="min-h-screen flex flex-col justify-between transition-colors duration-200"
      style={{ backgroundColor: secondaryBg }}
    >
      {/* Subtle Desktop Top Bar (keeps mobile 100% focused on the review card) */}
      <header className="hidden sm:flex items-center justify-between gap-8 max-w-5xl w-full mx-auto px-6 pt-5 pb-2">
        <span className="text-sm font-semibold tracking-tight text-slate-800 whitespace-nowrap shrink-0">
          {data?.config.businessName || 'Quick Google Review'}
        </span>
        <nav className="flex items-center gap-6 text-xs font-medium text-slate-600">
          <button
            type="button"
            onClick={() => onNavigate('/admin?tab=guide')}
            className="hover:text-slate-900 underline-offset-4 hover:underline transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Setup Guide
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/admin')}
            className="hover:text-slate-900 underline-offset-4 hover:underline transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Owner Admin
          </button>
        </nav>
      </header>

      {/* Main Focal Customer Review Card */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 sm:py-8">
        <div className="w-full max-w-[520px]">
          {loading && !data ? (
            <div
              className="w-full bg-white rounded-3xl border border-slate-200 p-7 sm:p-8 shadow-sm animate-pulse"
              aria-busy="true"
              aria-label="Loading review page"
            >
              <div className="flex flex-col items-center">
                <div className="h-16 w-16 rounded-2xl bg-slate-200" />
                <div className="mt-3 h-4 w-36 rounded bg-slate-200" />
                <div className="mt-6 h-7 w-64 rounded bg-slate-200" />
                <div className="mt-2 h-4 w-72 rounded bg-slate-100" />
              </div>
              <div className="mt-6 flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="h-14 w-12 rounded-2xl bg-slate-100" />
                ))}
              </div>
              <div className="mt-6 h-20 w-full rounded-2xl bg-slate-100" />
              <div className="mt-5 h-13 w-full rounded-2xl bg-slate-200" />
            </div>
          ) : error && !data ? (
            <div className="w-full bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-sm">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="mt-4 font-display text-xl font-semibold text-slate-900">
                Unable to load review page
              </h1>
              <p className="mt-2 text-sm text-slate-600">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Try Again</span>
              </button>
            </div>
          ) : data ? (
            <CustomerLandingCard config={data.config} />
          ) : null}
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="max-w-5xl w-full mx-auto px-6 py-4 flex flex-wrap items-center justify-center sm:justify-between gap-x-4 gap-y-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>No account required</span>
          <span aria-hidden="true">·</span>
          <span>Unfiltered honest feedback</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/admin?tab=guide')}
            className="sm:hidden hover:text-slate-800 underline-offset-4 hover:underline cursor-pointer"
          >
            Setup Guide
          </button>
          <span className="sm:hidden" aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => onNavigate('/admin')}
            className="hover:text-slate-800 underline-offset-4 hover:underline cursor-pointer"
          >
            Business Admin
          </button>
        </div>
      </footer>
    </div>
  );
}
