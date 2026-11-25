import { useState, type FormEvent } from 'react';
import { Lock, Eye, EyeOff, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { loginAdmin, setupAdminPassword } from '../lib/api.ts';

interface AdminLoginPageProps {
  initialized: boolean;
  envManaged: boolean;
  businessName: string;
  onAuthenticated: (token: string) => void;
  onNavigateHome: () => void;
}

export function AdminLoginPage({
  initialized,
  envManaged,
  businessName,
  onAuthenticated,
  onNavigateHome,
}: AdminLoginPageProps) {
  const isSetupMode = !initialized && !envManaged;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSetupMode) {
      if (password.length < 8) {
        setError('Please choose a password of at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await setupAdminPassword(password);
        onAuthenticated(res.token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to save admin password.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!password) {
      setError('Enter your admin password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginAdmin(password);
      onAuthenticated(res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between px-4 py-8">
      <div className="max-w-md w-full mx-auto">
        <button
          type="button"
          onClick={onNavigateHome}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Customer Page</span>
        </button>
      </div>

      <main className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-7 sm:p-8 shadow-sm">
          <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            {isSetupMode ? (
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Lock className="h-5 w-5" aria-hidden="true" />
            )}
          </div>

          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-slate-900">
            {isSetupMode ? 'Claim Business Admin Access' : 'Business Admin Sign In'}
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            {isSetupMode
              ? `Create an admin password for ${businessName}. This secures your logo, Google Review URL, colors, and QR generator.`
              : `Enter your admin password to manage ${businessName} settings, branding, and QR codes.`}
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2.5 text-sm text-red-800"
            >
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="admin-password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                {isSetupMode ? 'Create Admin Password' : 'Admin Password'}
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSetupMode ? 'new-password' : 'current-password'}
                  placeholder={isSetupMode ? 'At least 8 characters' : 'Enter password'}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {isSetupMode && (
              <div>
                <label
                  htmlFor="admin-confirm-password"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Confirm Password
                </label>
                <input
                  id="admin-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {submitting
                ? isSetupMode
                  ? 'Securing Dashboard...'
                  : 'Signing In...'
                : isSetupMode
                  ? 'Set Password & Open Dashboard'
                  : 'Sign In to Dashboard'}
            </button>
          </form>

          {isSetupMode && (
            <p className="mt-4 text-xs text-slate-500 leading-relaxed">
              Your password is hashed on the server with a unique salt. You can also override it anytime using the{' '}
              <code className="font-mono text-slate-700">ADMIN_PASSCODE</code> environment secret.
            </p>
          )}
        </div>
      </main>

      <div className="max-w-md w-full mx-auto text-center text-xs text-slate-400">
        Quick Google Review · Protected Owner Area
      </div>
    </div>
  );
}
