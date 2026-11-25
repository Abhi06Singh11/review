export const DEFAULT_GOOGLE_REVIEW_URL = 'https://g.page/r/CVwVASwb7sdWEBM/review';

export interface BusinessConfig {
  businessName: string;
  welcomeMessage: string;
  googleReviewUrl: string;
  heading: string;
  supportingText: string;
  feedbackLabel: string;
  buttonText: string;
  privacyNote: string;
  primaryColor: string;
  secondaryColor: string;
  ctaColor: string;
  logoUrl: string | null;
  updatedAt: string;
}

export interface PublicConfigResponse {
  config: BusinessConfig;
  isGoogleUrlValid: boolean;
  googleUrlError?: string;
  originalGoogleReviewUrl: string;
}

export interface AuthStatusResponse {
  initialized: boolean;
  envManaged: boolean;
  authenticated: boolean;
}

export const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  businessName: 'Quick Google Review',
  welcomeMessage: 'Thank you for visiting us today.',
  googleReviewUrl: DEFAULT_GOOGLE_REVIEW_URL,
  heading: 'How was your experience?',
  supportingText: "Your feedback is valuable. You can share an honest review on Google if you'd like.",
  feedbackLabel: "Share any details you'd like",
  buttonText: 'Continue to Google Reviews',
  privacyNote: 'Your review is optional, and you choose what to share.',
  primaryColor: '#0F172A',
  secondaryColor: '#F1F5F9',
  ctaColor: '#1D4ED8',
  logoUrl: null,
  updatedAt: new Date(0).toISOString(),
};

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
}

const GOOGLE_DOMAIN_REGEX = /^(www\.)?google\.[a-z]{2,}(\.[a-z]{2})?$/;

export function validateGoogleReviewUrl(rawUrl: string): UrlValidationResult {
  if (typeof rawUrl !== 'string') {
    return { valid: false, error: 'Google Review URL must be a valid web address.' };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, error: 'Google Review URL is required.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Please enter a valid URL starting with https://.' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Google Review URL must use HTTPS (https://).' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'Google Review URL must not contain embedded credentials.' };
  }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;
  const search = parsed.search.toLowerCase();

  if (host === 'g.page' || host === 'www.g.page') {
    if (pathname === '/' || pathname.length < 3) {
      return {
        valid: false,
        error: 'Enter your full g.page review link (e.g. https://g.page/r/.../review).',
      };
    }
    return { valid: true, normalizedUrl: parsed.toString() };
  }

  if (host === 'search.google.com') {
    if (pathname.startsWith('/local/writereview') || pathname.startsWith('/local/reviews')) {
      return { valid: true, normalizedUrl: parsed.toString() };
    }
    return {
      valid: false,
      error: 'Use a Google Business review link such as search.google.com/local/writereview.',
    };
  }

  if (host === 'maps.app.goo.gl' || host === 'goo.gl') {
    if (pathname === '/' || pathname.length < 3) {
      return { valid: false, error: 'Enter the full Google Maps short review link.' };
    }
    return { valid: true, normalizedUrl: parsed.toString() };
  }

  if (host === 'maps.google.com' || GOOGLE_DOMAIN_REGEX.test(host)) {
    const isSpecificReviewOrPlace =
      pathname.startsWith('/maps/place/') ||
      pathname.startsWith('/maps/contrib/') ||
      pathname.includes('writereview') ||
      search.includes('placeid=') ||
      search.includes('cid=') ||
      search.includes('ludocid=');

    if (!isSpecificReviewOrPlace) {
      return {
        valid: false,
        error:
          'Generic Google search or Maps homepages are not allowed. Use your specific Google Business review URL.',
      };
    }
    return { valid: true, normalizedUrl: parsed.toString() };
  }

  return {
    valid: false,
    error:
      'URL must be an official Google review link (g.page, search.google.com/local/writereview, maps.app.goo.gl, or a Google Maps business link).',
  };
}

export function validateHexColor(value: string): boolean {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value.trim());
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!validateHexColor(hex)) return null;
  const clean = hex.trim().slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(hexA: string, hexB: string): number {
  const rgbA = hexToRgb(hexA);
  const rgbB = hexToRgb(hexB);
  if (!rgbA || !rgbB) return 1;
  const lumA = relativeLuminance(rgbA.r, rgbA.g, rgbA.b);
  const lumB = relativeLuminance(rgbB.r, rgbB.g, rgbB.b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getContrastTextColor(backgroundHex: string): '#FFFFFF' | '#0F172A' {
  const whiteRatio = getContrastRatio('#FFFFFF', backgroundHex);
  const darkRatio = getContrastRatio('#0F172A', backgroundHex);
  return whiteRatio >= darkRatio ? '#FFFFFF' : '#0F172A';
}
