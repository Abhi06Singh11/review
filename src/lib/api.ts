import {
  DEFAULT_BUSINESS_CONFIG,
  DEFAULT_GOOGLE_REVIEW_URL,
  type AuthStatusResponse,
  type BusinessConfig,
  type PublicConfigResponse,
} from '../../shared/config.ts';

async function parseJsonSafely<T>(res: Response, fallbackError: string): Promise<T> {
  const rawText = await res.text();
  let parsed: unknown = null;

  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      if (!res.ok) {
        throw new Error(fallbackError);
      }
      throw new Error('Unexpected response format from server.');
    }
  }

  if (!res.ok) {
    const errObj = parsed as { error?: string } | null;
    throw new Error(errObj?.error || fallbackError);
  }

  if (parsed === null) {
    throw new Error(fallbackError);
  }

  return parsed as T;
}

export async function fetchPublicConfig(): Promise<PublicConfigResponse> {
  const res = await fetch('/api/config', { cache: 'no-store' });
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    return {
      config: DEFAULT_BUSINESS_CONFIG,
      isGoogleUrlValid: true,
      originalGoogleReviewUrl: DEFAULT_GOOGLE_REVIEW_URL,
    };
  }
  return parseJsonSafely<PublicConfigResponse>(res, 'Failed to load business configuration.');
}

export async function fetchAuthStatus(token: string | null): Promise<AuthStatusResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch('/api/auth/status', { headers, cache: 'no-store' });
  return parseJsonSafely<AuthStatusResponse>(res, 'Failed to check authentication status.');
}

export async function setupAdminPassword(
  password: string
): Promise<{ token: string; expiresAt: string; envManaged: boolean }> {
  const res = await fetch('/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return parseJsonSafely(res, 'Could not configure admin password.');
}

export async function loginAdmin(
  password: string
): Promise<{ token: string; expiresAt: string; envManaged: boolean }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return parseJsonSafely(res, 'Login failed.');
}

export async function logoutAdmin(token: string | null): Promise<void> {
  if (!token) return;
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

export async function changeAdminPassword(
  token: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  await parseJsonSafely<{ ok: boolean }>(res, 'Unable to update password.');
}

export async function updateBusinessConfig(
  token: string,
  payload: Partial<BusinessConfig>
): Promise<PublicConfigResponse> {
  const res = await fetch('/api/admin/config', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return parseJsonSafely<PublicConfigResponse>(res, 'Failed to save business settings.');
}

export async function uploadBusinessLogo(
  token: string,
  dataUrl: string
): Promise<{ logoUrl: string; config: BusinessConfig }> {
  const res = await fetch('/api/admin/logo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ dataUrl }),
  });
  return parseJsonSafely(res, 'Failed to upload logo.');
}

export async function removeBusinessLogo(
  token: string
): Promise<{ config: BusinessConfig }> {
  const res = await fetch('/api/admin/logo', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonSafely(res, 'Failed to remove logo.');
}
