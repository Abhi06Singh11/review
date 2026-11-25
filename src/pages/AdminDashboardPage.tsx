import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  QrCode,
  Building2,
  Link2,
  Palette,
  BookOpen,
  LogOut,
  ExternalLink,
  Save,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Monitor,
  RotateCcw,
  Lock,
} from 'lucide-react';
import {
  DEFAULT_BUSINESS_CONFIG,
  DEFAULT_GOOGLE_REVIEW_URL,
  getContrastRatio,
  getContrastTextColor,
  validateGoogleReviewUrl,
  validateHexColor,
  type BusinessConfig,
  type PublicConfigResponse,
} from '../../shared/config.ts';
import {
  changeAdminPassword,
  removeBusinessLogo,
  updateBusinessConfig,
  uploadBusinessLogo,
} from '../lib/api.ts';
import { BrandMark } from '../components/BrandMark.tsx';
import { CustomerLandingCard } from '../components/CustomerLandingCard.tsx';
import { QrCodeSection } from '../components/QrCodeSection.tsx';

export type AdminTab = 'qr' | 'business' | 'google-url' | 'branding' | 'guide';

interface AdminDashboardPageProps {
  initialData: PublicConfigResponse;
  token: string;
  envManaged: boolean;
  initialTab?: AdminTab;
  onConfigUpdated: (updated: PublicConfigResponse) => void;
  onSignOut: () => void;
  onNavigateHome: () => void;
}

const COLOR_PRESETS = [
  {
    name: 'Classic Cobalt',
    primaryColor: '#0F172A',
    secondaryColor: '#F1F5F9',
    ctaColor: '#1D4ED8',
  },
  {
    name: 'Forest Slate',
    primaryColor: '#14532D',
    secondaryColor: '#F0FDF4',
    ctaColor: '#15803D',
  },
  {
    name: 'Warm Espresso',
    primaryColor: '#292524',
    secondaryColor: '#F5F5F4',
    ctaColor: '#B45309',
  },
  {
    name: 'Charcoal Minimal',
    primaryColor: '#18181B',
    secondaryColor: '#F4F4F5',
    ctaColor: '#18181B',
  },
];

export function AdminDashboardPage({
  initialData,
  token,
  envManaged,
  initialTab = 'qr',
  onConfigUpdated,
  onSignOut,
  onNavigateHome,
}: AdminDashboardPageProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [draft, setDraft] = useState<BusinessConfig>(initialData.config);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [previewViewport, setPreviewViewport] = useState<'mobile' | 'desktop'>('mobile');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(
    null
  );
  const [changingPassword, setChangingPassword] = useState(false);

  const landingUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/';
    return `${window.location.origin}/`;
  }, []);

  const urlValidation = useMemo(
    () => validateGoogleReviewUrl(draft.googleReviewUrl),
    [draft.googleReviewUrl]
  );

  const savedUrlValidation = useMemo(
    () => validateGoogleReviewUrl(initialData.config.googleReviewUrl),
    [initialData.config.googleReviewUrl]
  );

  const hasUnsavedChanges = useMemo(() => {
    const a = draft;
    const b = initialData.config;
    return (
      a.businessName !== b.businessName ||
      a.welcomeMessage !== b.welcomeMessage ||
      a.googleReviewUrl !== b.googleReviewUrl ||
      a.heading !== b.heading ||
      a.supportingText !== b.supportingText ||
      a.feedbackLabel !== b.feedbackLabel ||
      a.buttonText !== b.buttonText ||
      a.privacyNote !== b.privacyNote ||
      a.primaryColor !== b.primaryColor ||
      a.secondaryColor !== b.secondaryColor ||
      a.ctaColor !== b.ctaColor
    );
  }, [draft, initialData.config]);

  const ctaTextColor = getContrastTextColor(
    validateHexColor(draft.ctaColor) ? draft.ctaColor : '#1D4ED8'
  );
  const ctaContrastRatio = getContrastRatio(
    ctaTextColor,
    validateHexColor(draft.ctaColor) ? draft.ctaColor : '#1D4ED8'
  );

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(null);

    if (!urlValidation.valid) {
      setSaveError(urlValidation.error || 'Please enter a valid Google Review URL before saving.');
      setActiveTab('google-url');
      return;
    }

    if (
      !validateHexColor(draft.primaryColor) ||
      !validateHexColor(draft.secondaryColor) ||
      !validateHexColor(draft.ctaColor)
    ) {
      setSaveError('All brand colors must be valid 6-digit hex codes (e.g. #1D4ED8).');
      setActiveTab('branding');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateBusinessConfig(token, draft);
      setDraft(updated.config);
      onConfigUpdated(updated);
      setSaveSuccess('Settings saved and published to your customer landing page.');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setLogoError('Please choose a PNG, JPEG, or WebP image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Logo image must be 2 MB or smaller.');
      return;
    }

    setUploadingLogo(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await uploadBusinessLogo(token, dataUrl);
      setDraft((prev) => ({ ...prev, logoUrl: res.logoUrl, updatedAt: res.config.updatedAt }));
      onConfigUpdated({
        ...initialData,
        config: { ...initialData.config, logoUrl: res.logoUrl, updatedAt: res.config.updatedAt },
      });
      setSaveSuccess('Business logo updated.');
      setTimeout(() => setSaveSuccess(null), 3500);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Failed to upload logo.');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    setLogoError(null);
    setUploadingLogo(true);
    try {
      const res = await removeBusinessLogo(token);
      setDraft((prev) => ({ ...prev, logoUrl: null, updatedAt: res.config.updatedAt }));
      onConfigUpdated({
        ...initialData,
        config: { ...initialData.config, logoUrl: null, updatedAt: res.config.updatedAt },
      });
      setSaveSuccess('Business logo removed. Using emblem placeholder.');
      setTimeout(() => setSaveSuccess(null), 3500);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Failed to remove logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);
    if (newPassword.length < 8) {
      setPasswordStatus({ type: 'err', msg: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordStatus({ type: 'err', msg: 'New passwords do not match.' });
      return;
    }
    setChangingPassword(true);
    try {
      await changeAdminPassword(token, currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordStatus({ type: 'ok', msg: 'Admin password updated successfully.' });
    } catch (err) {
      setPasswordStatus({
        type: 'err',
        msg: err instanceof Error ? err.message : 'Could not update password.',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const navItems: Array<{ id: AdminTab; label: string; icon: typeof QrCode }> = [
    { id: 'qr', label: 'QR Code & Link', icon: QrCode },
    { id: 'business', label: 'Business & Copy', icon: Building2 },
    { id: 'google-url', label: 'Google Review URL', icon: Link2 },
    { id: 'branding', label: 'Colors & Preview', icon: Palette },
    { id: 'guide', label: 'Setup Guide & Security', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Print-Only Counter Poster */}
      <div className="hidden print-only p-12 text-center">
        <div className="max-w-md mx-auto border border-slate-300 rounded-3xl p-10 flex flex-col items-center">
          <BrandMark
            logoUrl={draft.logoUrl}
            businessName={draft.businessName}
            primaryColor={draft.primaryColor}
            ctaColor={draft.ctaColor}
            size="lg"
          />
          <h1
            className="mt-4 font-display text-2xl font-bold"
            style={{ color: draft.primaryColor }}
          >
            {draft.businessName}
          </h1>
          <p className="mt-2 text-base font-medium text-slate-700">{draft.heading}</p>
          <img
            src="/api/qr.png"
            alt={`QR code for ${draft.businessName}`}
            className="mt-6 w-64 h-64 object-contain"
          />
          <p className="mt-6 text-sm font-semibold text-slate-900">
            Scan with your phone camera to share an honest Google Review
          </p>
          <p className="mt-1 text-xs text-slate-500">{draft.privacyNote}</p>
        </div>
      </div>

      {/* Main Dashboard Layout */}
      <div className="no-print min-h-screen flex flex-col lg:flex-row">
        {/* Desktop Sidebar */}
        <aside className="lg:w-64 lg:shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col">
          <div className="px-5 py-5 border-b border-slate-100 flex items-center gap-3">
            <BrandMark
              logoUrl={draft.logoUrl}
              businessName={draft.businessName}
              primaryColor={draft.primaryColor}
              ctaColor={draft.ctaColor}
              size="sm"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{draft.businessName}</p>
              <p className="text-xs text-slate-500">Admin Console</p>
            </div>
          </div>

          <nav
            aria-label="Admin sections"
            className="p-3 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-[42px] px-3.5 py-2 rounded-xl text-sm font-medium flex items-center gap-2.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="hidden lg:block mt-auto p-4 border-t border-slate-100 space-y-2">
            <button
              type="button"
              onClick={onNavigateHome}
              className="w-full min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>View Customer Page</span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="w-full min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Viewport */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          <header className="bg-white border-b border-slate-200 px-5 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Quick Google Review</span>
                <span aria-hidden="true">/</span>
                <span>{navItems.find((i) => i.id === activeTab)?.label}</span>
              </div>
              <h1 className="mt-0.5 font-display text-xl font-bold text-slate-900">
                {navItems.find((i) => i.id === activeTab)?.label}
              </h1>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onNavigateHome}
                className="lg:hidden min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Customer Page</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-60 inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>
                  {saving
                    ? 'Saving...'
                    : hasUnsavedChanges
                      ? 'Save Changes'
                      : 'Saved'}
                </span>
              </button>

              <button
                type="button"
                onClick={onSignOut}
                className="lg:hidden min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          {/* Status Banners */}
          <div className="px-5 sm:px-8 pt-5 space-y-3 max-w-6xl w-full mx-auto">
            {!savedUrlValidation.valid && (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3 text-sm text-red-900"
              >
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <p className="font-semibold">Customer Google Review button is currently disabled</p>
                  <p className="text-xs text-red-700 mt-0.5">
                    {savedUrlValidation.error || 'The Google Review URL is missing or invalid.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('google-url')}
                  className="text-xs font-semibold underline underline-offset-2 shrink-0 cursor-pointer"
                >
                  Fix URL
                </button>
              </div>
            )}

            {saveError && (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2.5 text-sm text-red-800"
              >
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" aria-hidden="true" />
                <span>{saveError}</span>
              </div>
            )}

            {saveSuccess && (
              <div
                role="status"
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2.5 text-sm text-emerald-900"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>{saveSuccess}</span>
              </div>
            )}
          </div>

          {/* Active Workspace Content */}
          <main className="flex-1 px-5 sm:px-8 py-6 max-w-6xl w-full mx-auto space-y-6">
            {activeTab === 'qr' && (
              <div className="space-y-6">
                {/* Summary Strip */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs font-medium text-slate-500">Google Review Link</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      {savedUrlValidation.valid ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
                          <span className="text-sm font-semibold text-slate-900">Verified &amp; Active</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" aria-hidden="true" />
                          <span className="text-sm font-semibold text-red-700">Needs Attention</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs font-medium text-slate-500">Official Destination</p>
                    <p className="mt-1.5 text-xs font-mono text-slate-800 truncate">
                      {initialData.config.googleReviewUrl}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs font-medium text-slate-500">Fairness Guarantee</p>
                    <p className="mt-1.5 text-sm font-semibold text-slate-900">
                      Unfiltered for all ratings (1–5)
                    </p>
                  </div>
                </div>

                <QrCodeSection config={draft} landingUrl={landingUrl} />
              </div>
            )}

            {activeTab === 'business' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Logo Upload Card */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">Business Logo</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Upload a PNG, JPEG, or WebP logo (max 2 MB). A clean emblem placeholder shows when none is uploaded.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 pt-2">
                    <BrandMark
                      logoUrl={draft.logoUrl}
                      businessName={draft.businessName}
                      primaryColor={draft.primaryColor}
                      ctaColor={draft.ctaColor}
                      size="lg"
                    />
                    <div className="space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleLogoFileChange}
                        className="sr-only"
                        id="logo-file-input"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          htmlFor="logo-file-input"
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 inline-flex items-center gap-2 cursor-pointer"
                        >
                          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{uploadingLogo ? 'Uploading...' : draft.logoUrl ? 'Replace Logo' : 'Upload Logo'}</span>
                        </label>

                        {draft.logoUrl && (
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            disabled={uploadingLogo}
                            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {logoError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                      {logoError}
                    </div>
                  )}
                </div>

                {/* Business Copy Card */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      Business Info &amp; Landing Copy
                    </h2>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          heading: DEFAULT_BUSINESS_CONFIG.heading,
                          supportingText: DEFAULT_BUSINESS_CONFIG.supportingText,
                          feedbackLabel: DEFAULT_BUSINESS_CONFIG.feedbackLabel,
                          buttonText: DEFAULT_BUSINESS_CONFIG.buttonText,
                          privacyNote: DEFAULT_BUSINESS_CONFIG.privacyNote,
                        }))
                      }
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Reset Default Copy</span>
                    </button>
                  </div>

                  <div>
                    <label htmlFor="cfg-business-name" className="block text-sm font-medium text-slate-700 mb-1">
                      Business Name
                    </label>
                    <input
                      id="cfg-business-name"
                      type="text"
                      maxLength={100}
                      value={draft.businessName}
                      onChange={(e) => setDraft({ ...draft, businessName: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="cfg-welcome-msg" className="block text-sm font-medium text-slate-700 mb-1">
                      Optional Welcome Message
                    </label>
                    <input
                      id="cfg-welcome-msg"
                      type="text"
                      maxLength={240}
                      value={draft.welcomeMessage}
                      onChange={(e) => setDraft({ ...draft, welcomeMessage: e.target.value })}
                      placeholder="Leave blank to hide welcome message"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="cfg-heading" className="block text-sm font-medium text-slate-700 mb-1">
                      Landing Page Heading
                    </label>
                    <input
                      id="cfg-heading"
                      type="text"
                      maxLength={120}
                      value={draft.heading}
                      onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="cfg-supporting" className="block text-sm font-medium text-slate-700 mb-1">
                      Supporting Text
                    </label>
                    <textarea
                      id="cfg-supporting"
                      rows={2}
                      maxLength={260}
                      value={draft.supportingText}
                      onChange={(e) => setDraft({ ...draft, supportingText: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="cfg-feedback-label" className="block text-sm font-medium text-slate-700 mb-1">
                        Optional Textarea Label
                      </label>
                      <input
                        id="cfg-feedback-label"
                        type="text"
                        maxLength={120}
                        value={draft.feedbackLabel}
                        onChange={(e) => setDraft({ ...draft, feedbackLabel: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="cfg-button-text" className="block text-sm font-medium text-slate-700 mb-1">
                        Google Review Button Text
                      </label>
                      <input
                        id="cfg-button-text"
                        type="text"
                        maxLength={60}
                        value={draft.buttonText}
                        onChange={(e) => setDraft({ ...draft, buttonText: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="cfg-privacy-note" className="block text-sm font-medium text-slate-700 mb-1">
                      Supporting Privacy Note
                    </label>
                    <input
                      id="cfg-privacy-note"
                      type="text"
                      maxLength={200}
                      value={draft.privacyNote}
                      onChange={(e) => setDraft({ ...draft, privacyNote: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'google-url' && (
              <div className="max-w-3xl space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      Official Google Business Review URL
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Every customer clicking &ldquo;{draft.buttonText}&rdquo; is directed to this exact link regardless of star rating.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="cfg-google-url" className="block text-sm font-medium text-slate-700 mb-1.5">
                      Active Google Review Destination
                    </label>
                    <input
                      id="cfg-google-url"
                      type="url"
                      value={draft.googleReviewUrl}
                      onChange={(e) => setDraft({ ...draft, googleReviewUrl: e.target.value })}
                      placeholder={DEFAULT_GOOGLE_REVIEW_URL}
                      className={`w-full rounded-xl border px-4 py-3 text-sm font-mono focus:outline-none ${
                        urlValidation.valid
                          ? 'border-slate-200 bg-white text-slate-900 focus:border-slate-900'
                          : 'border-red-300 bg-red-50/40 text-red-900 focus:border-red-600'
                      }`}
                    />
                  </div>

                  {urlValidation.valid ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5 text-sm text-emerald-900">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
                        <span>Valid official Google Business review URL.</span>
                      </div>
                      <a
                        href={urlValidation.normalizedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-emerald-900 underline underline-offset-2 inline-flex items-center gap-1 shrink-0"
                      >
                        <span>Test Link</span>
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </div>
                  ) : (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2.5 text-sm text-red-800"
                    >
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{urlValidation.error}</span>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500">
                        Preconfigured Original Business URL
                      </p>
                      <p className="mt-0.5 text-xs font-mono text-slate-800 break-all">
                        {DEFAULT_GOOGLE_REVIEW_URL}
                      </p>
                    </div>
                    {draft.googleReviewUrl !== DEFAULT_GOOGLE_REVIEW_URL && (
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, googleReviewUrl: DEFAULT_GOOGLE_REVIEW_URL })}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Restore Original URL
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'branding' && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Color Controls */}
                <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      Brand Colors &amp; Contrast
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Customize your primary accent, background tint, and CTA button color.
                    </p>
                  </div>

                  {/* Presets */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-2">Quick Palettes</p>
                    <div className="grid grid-cols-2 gap-2">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              primaryColor: preset.primaryColor,
                              secondaryColor: preset.secondaryColor,
                              ctaColor: preset.ctaColor,
                            })
                          }
                          className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-400 bg-white text-left flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer transition-colors"
                        >
                          <span
                            className="h-4 w-4 rounded-full border border-slate-200 shrink-0"
                            style={{ backgroundColor: preset.ctaColor }}
                            aria-hidden="true"
                          />
                          <span className="truncate">{preset.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-2 border-t border-slate-100">
                    <ColorField
                      id="color-primary"
                      label="Primary Color (Headings &amp; Brand)"
                      value={draft.primaryColor}
                      onChange={(val) => setDraft({ ...draft, primaryColor: val })}
                    />
                    <ColorField
                      id="color-secondary"
                      label="Secondary Color (Page Canvas)"
                      value={draft.secondaryColor}
                      onChange={(val) => setDraft({ ...draft, secondaryColor: val })}
                    />
                    <ColorField
                      id="color-cta"
                      label="Main CTA Button Color"
                      value={draft.ctaColor}
                      onChange={(val) => setDraft({ ...draft, ctaColor: val })}
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between text-xs">
                    <span className="text-slate-600">Button Text Contrast</span>
                    <span className="font-mono font-medium tabular-nums text-slate-900">
                      {ctaContrastRatio.toFixed(1)}:1 · {ctaContrastRatio >= 4.5 ? 'AA Pass' : 'Low Contrast'}
                    </span>
                  </div>
                </div>

                {/* Live Mobile / Desktop Preview */}
                <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-slate-900">
                        Live Landing Page Preview
                      </h2>
                      <p className="text-xs text-slate-500">
                        Interactive preview updates in real time as you edit.
                      </p>
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setPreviewViewport('mobile')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                          previewViewport === 'mobile'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Mobile</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewViewport('desktop')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                          previewViewport === 'desktop'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Desktop</span>
                      </button>
                    </div>
                  </div>

                  <div
                    className="rounded-2xl border border-slate-200 p-4 sm:p-6 flex justify-center overflow-hidden transition-colors"
                    style={{
                      backgroundColor: validateHexColor(draft.secondaryColor)
                        ? draft.secondaryColor
                        : '#F1F5F9',
                    }}
                  >
                    <div
                      className={`w-full transition-all duration-200 ${
                        previewViewport === 'mobile' ? 'max-w-[375px]' : 'max-w-[520px]'
                      }`}
                    >
                      <CustomerLandingCard
                        config={draft}
                        isPreview
                        compact={previewViewport === 'mobile'}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'guide' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* 7-Step Owner Setup Guide */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6">
                  <h2 className="font-display text-lg font-semibold text-slate-900">
                    Owner Setup &amp; Deployment Guide
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Follow these steps to customize, verify, and display your Quick Google Review station.
                  </p>

                  <ol className="mt-6 space-y-5">
                    {[
                      {
                        title: '01. Log into the Admin Dashboard',
                        body: 'Visit /admin on your website and sign in with your admin password. Only authenticated owners can modify business settings, colors, logos, or the Google Review URL.',
                      },
                      {
                        title: '02. Update Business Information',
                        body: 'Open Business & Copy to set your official business name, optional welcome message, and customer-facing copy. Click Save Changes in the top bar to publish updates.',
                      },
                      {
                        title: '03. Upload Your Business Logo',
                        body: 'In Business & Copy, upload a crisp PNG, JPEG, or WebP logo (up to 2 MB). It appears automatically on both your customer landing page and printable QR display.',
                      },
                      {
                        title: '04. Verify the Preconfigured Google Review URL',
                        body: `Your original review destination (${DEFAULT_GOOGLE_REVIEW_URL}) is preconfigured and validated by default. Check Google Review URL anytime to test or update it.`,
                      },
                      {
                        title: '05. Publish the Website',
                        body: 'Use your live public URL as your published customer destination. Every customer sees the exact same Google review button regardless of rating.',
                      },
                      {
                        title: '06. Generate and Download the QR Code',
                        body: 'Open QR Code & Link to download a high-resolution PNG (1200×1200) or vector SVG. The QR code always points to your landing page so future updates stay connected automatically.',
                      },
                      {
                        title: '07. Print and Display at Your Business Location',
                        body: 'Click Print Counter Display Stand or use the downloaded PNG/SVG on table tents, checkout counters, receipts, or front-desk signage.',
                      },
                    ].map((step) => (
                      <li key={step.title} className="pb-4 border-b border-slate-100 last:border-b-0 last:pb-0">
                        <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
                        <p className="mt-1 text-sm text-slate-600 leading-relaxed">{step.body}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Admin Password Security Card */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="flex items-center gap-2.5">
                    <Lock className="h-5 w-5 text-slate-700" aria-hidden="true" />
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      Admin Password Security
                    </h2>
                  </div>

                  {envManaged ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 leading-relaxed">
                      Your admin password is managed securely via the <code className="font-mono text-slate-900">ADMIN_PASSCODE</code> server environment secret. Update it in your deployment Secrets settings.
                    </div>
                  ) : (
                    <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
                      <p className="text-sm text-slate-600">
                        Update your server-hashed admin password. For production deployments, you can also set <code className="font-mono text-xs text-slate-800">ADMIN_PASSCODE</code> in environment secrets.
                      </p>

                      {passwordStatus && (
                        <div
                          role={passwordStatus.type === 'err' ? 'alert' : 'status'}
                          className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                            passwordStatus.type === 'err'
                              ? 'border-red-200 bg-red-50 text-red-800'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {passwordStatus.msg}
                        </div>
                      )}

                      <div>
                        <label htmlFor="sec-current-pw" className="block text-xs font-medium text-slate-700 mb-1">
                          Current Password
                        </label>
                        <input
                          id="sec-current-pw"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          required
                          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-slate-900 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="sec-new-pw" className="block text-xs font-medium text-slate-700 mb-1">
                          New Password (8+ characters)
                        </label>
                        <input
                          id="sec-new-pw"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-slate-900 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="sec-confirm-pw" className="block text-xs font-medium text-slate-700 mb-1">
                          Confirm New Password
                        </label>
                        <input
                          id="sec-confirm-pw"
                          type="password"
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          required
                          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-slate-900 focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={changingPassword}
                        className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                      >
                        {changingPassword ? 'Updating...' : 'Update Admin Password'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorField({ id, label, value, onChange }: ColorFieldProps) {
  const safePickerValue = validateHexColor(value) ? value : '#0F172A';

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2.5">
        <input
          type="color"
          aria-label={`${label} color picker`}
          value={safePickerValue}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 rounded-xl border border-slate-200 bg-white p-1 cursor-pointer shrink-0"
        />
        <input
          id={id}
          type="text"
          maxLength={7}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
        />
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read selected file.'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read selected file.'));
    reader.readAsDataURL(file);
  });
}
