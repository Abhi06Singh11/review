import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Copy,
  Check,
  Download,
  Printer,
  ExternalLink,
  QrCode as QrIcon,
} from 'lucide-react';
import type { BusinessConfig } from '../../shared/config.ts';
import { BrandMark } from './BrandMark.tsx';

interface QrCodeSectionProps {
  config: BusinessConfig;
  landingUrl: string;
}

export function QrCodeSection({ config, landingUrl }: QrCodeSectionProps) {
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [pngPreviewUrl, setPngPreviewUrl] = useState<string>('');
  const [copiedLanding, setCopiedLanding] = useState(false);
  const [copiedQrImage, setCopiedQrImage] = useState(false);

  const qrPngEndpointUrl = `${landingUrl.replace(/\/$/, '')}/api/qr.png`;

  useEffect(() => {
    let cancelled = false;

    async function buildQr() {
      try {
        const [svg, dataUrl] = await Promise.all([
          QRCode.toString(landingUrl, {
            type: 'svg',
            width: 320,
            margin: 2,
            errorCorrectionLevel: 'H',
            color: { dark: '#0F172A', light: '#FFFFFF' },
          }),
          QRCode.toDataURL(landingUrl, {
            width: 1200,
            margin: 3,
            errorCorrectionLevel: 'H',
            color: { dark: '#0F172A', light: '#FFFFFF' },
          }),
        ]);
        if (!cancelled) {
          setSvgMarkup(svg);
          setPngPreviewUrl(dataUrl);
        }
      } catch {
        // Fallback handled gracefully in render
      }
    }

    buildQr();
    return () => {
      cancelled = true;
    };
  }, [landingUrl]);

  const handleCopy = async (text: string, type: 'landing' | 'qr') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'landing') {
        setCopiedLanding(true);
        setTimeout(() => setCopiedLanding(false), 2000);
      } else {
        setCopiedQrImage(true);
        setTimeout(() => setCopiedQrImage(false), 2000);
      }
    } catch {
      // Clipboard blocked in some contexts; input remains selectable
    }
  };

  const handleDownloadPng = async () => {
    const dataUrl =
      pngPreviewUrl ||
      (await QRCode.toDataURL(landingUrl, {
        width: 1200,
        margin: 3,
        errorCorrectionLevel: 'H',
        color: { dark: '#0F172A', light: '#FFFFFF' },
      }));
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${slugify(config.businessName)}-review-qr.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSvg = async () => {
    const svg =
      svgMarkup ||
      (await QRCode.toString(landingUrl, {
        type: 'svg',
        width: 512,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#0F172A', light: '#FFFFFF' },
      }));
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugify(config.businessName)}-review-qr.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* QR Code Preview & Downloads */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Customer Landing Page QR Code
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Scanning opens your branded landing page first, so branding or URL updates stay automatically connected.
              </p>
            </div>
            <QrIcon className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-52 h-52 rounded-2xl border border-slate-200 bg-white p-3 flex items-center justify-center shrink-0">
              {pngPreviewUrl ? (
                <img
                  src={pngPreviewUrl}
                  alt={`QR code linking to ${landingUrl}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full bg-slate-100 rounded-xl animate-pulse" />
              )}
            </div>

            <div className="flex-1 w-full space-y-3">
              <button
                type="button"
                onClick={handleDownloadPng}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download High-Res PNG (1200×1200)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadSvg}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download Vector SVG</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-medium hover:bg-slate-100 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                <span>Print Counter Display Stand</span>
              </button>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Published Customer Landing Page URL (QR Destination)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={landingUrl}
                  aria-label="Published customer landing page URL"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-mono text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(landingUrl, 'landing')}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedLanding ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
                <a
                  href={landingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open landing page in new tab"
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Direct QR Code Image URL (PNG)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={qrPngEndpointUrl}
                  aria-label="Direct QR code image URL"
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-mono text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(qrPngEndpointUrl, 'qr')}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copiedQrImage ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copy Image URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Printable Counter Stand Preview */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-6">
          <p className="text-xs font-medium text-slate-500 mb-3">Printable Counter Display Preview</p>
          <div
            id="printable-qr-poster"
            className="rounded-2xl border border-slate-200 p-6 text-center flex flex-col items-center bg-white"
          >
            <BrandMark
              logoUrl={config.logoUrl}
              businessName={config.businessName}
              primaryColor={config.primaryColor}
              ctaColor={config.ctaColor}
              size="md"
            />
            <p
              className="mt-3 text-base font-bold tracking-tight"
              style={{ color: config.primaryColor }}
            >
              {config.businessName}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">
              {config.heading}
            </p>
            <div className="mt-4 w-44 h-44 rounded-xl border border-slate-200 p-2 bg-white">
              {pngPreviewUrl ? (
                <img
                  src={pngPreviewUrl}
                  alt="Printable QR Code"
                  className="w-full h-full object-contain"
                />
              ) : null}
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-800">
              Scan to share an honest Google Review
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {config.privacyNote}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function slugify(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'business';
}
