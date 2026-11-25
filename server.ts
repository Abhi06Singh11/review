import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import QRCode from 'qrcode';
import {
  DEFAULT_BUSINESS_CONFIG,
  DEFAULT_GOOGLE_REVIEW_URL,
  validateGoogleReviewUrl,
  validateHexColor,
} from './shared/config.ts';
import type { BusinessConfig } from './shared/config.ts';

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = process.cwd();
const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const CONFIG_FILE = path.resolve(DATA_DIR, 'config.json');
const AUTH_FILE = path.resolve(DATA_DIR, 'auth.json');

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

interface StoredAuth {
  passwordHash: string;
  salt: string;
  claimedAt: string;
}

interface SessionPayload {
  sid: string;
  iat: number;
  exp: number;
}

const revokedSessionIds = new Set<string>();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function ensureDataDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function getEnvPasscode(): string {
  const raw = (process.env.ADMIN_PASSCODE || '').trim();
  if (!raw || raw === 'MY_ADMIN_PASSCODE') {
    return '';
  }
  return raw;
}

function readAuthStore(): StoredAuth | null {
  try {
    if (!fs.existsSync(AUTH_FILE)) return null;
    const raw = fs.readFileSync(AUTH_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredAuth>;
    if (
      typeof parsed.passwordHash === 'string' &&
      typeof parsed.salt === 'string' &&
      parsed.passwordHash.length > 0 &&
      parsed.salt.length > 0
    ) {
      return {
        passwordHash: parsed.passwordHash,
        salt: parsed.salt,
        claimedAt: typeof parsed.claimedAt === 'string' ? parsed.claimedAt : new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function writeAuthStore(auth: StoredAuth): void {
  ensureDataDirs();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2), { mode: 0o600 });
}

function hashPassword(password: string, saltHex: string): string {
  return crypto.scryptSync(password, saltHex, 64).toString('hex');
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function signSessionToken(): { token: string; expiresAt: string } {
  const now = Date.now();
  const payload: SessionPayload = {
    sid: crypto.randomBytes(16).toString('hex'),
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  if (!timingSafeStringEqual(signature, expectedSig)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (
      typeof decoded.sid !== 'string' ||
      typeof decoded.exp !== 'number' ||
      decoded.exp <= Date.now() ||
      revokedSessionIds.has(decoded.sid)
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Authentication required. Please sign in to the admin dashboard.' });
    return;
  }
  next();
}

function checkRateLimit(clientKey: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(clientKey);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(clientKey, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 12) {
    return false;
  }
  entry.count += 1;
  return true;
}

function resetRateLimit(clientKey: string): void {
  loginAttempts.delete(clientKey);
}

function readConfig(): BusinessConfig {
  ensureDataDirs();
  if (!fs.existsSync(CONFIG_FILE)) {
    const initial: BusinessConfig = {
      ...DEFAULT_BUSINESS_CONFIG,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }

  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<BusinessConfig>;
    return {
      businessName:
        typeof parsed.businessName === 'string' && parsed.businessName.trim()
          ? parsed.businessName.trim()
          : DEFAULT_BUSINESS_CONFIG.businessName,
      welcomeMessage:
        typeof parsed.welcomeMessage === 'string'
          ? parsed.welcomeMessage
          : DEFAULT_BUSINESS_CONFIG.welcomeMessage,
      googleReviewUrl:
        typeof parsed.googleReviewUrl === 'string'
          ? parsed.googleReviewUrl
          : DEFAULT_GOOGLE_REVIEW_URL,
      heading:
        typeof parsed.heading === 'string' && parsed.heading.trim()
          ? parsed.heading.trim()
          : DEFAULT_BUSINESS_CONFIG.heading,
      supportingText:
        typeof parsed.supportingText === 'string' && parsed.supportingText.trim()
          ? parsed.supportingText.trim()
          : DEFAULT_BUSINESS_CONFIG.supportingText,
      feedbackLabel:
        typeof parsed.feedbackLabel === 'string' && parsed.feedbackLabel.trim()
          ? parsed.feedbackLabel.trim()
          : DEFAULT_BUSINESS_CONFIG.feedbackLabel,
      buttonText:
        typeof parsed.buttonText === 'string' && parsed.buttonText.trim()
          ? parsed.buttonText.trim()
          : DEFAULT_BUSINESS_CONFIG.buttonText,
      privacyNote:
        typeof parsed.privacyNote === 'string' && parsed.privacyNote.trim()
          ? parsed.privacyNote.trim()
          : DEFAULT_BUSINESS_CONFIG.privacyNote,
      primaryColor:
        typeof parsed.primaryColor === 'string' && validateHexColor(parsed.primaryColor)
          ? parsed.primaryColor.toUpperCase()
          : DEFAULT_BUSINESS_CONFIG.primaryColor,
      secondaryColor:
        typeof parsed.secondaryColor === 'string' && validateHexColor(parsed.secondaryColor)
          ? parsed.secondaryColor.toUpperCase()
          : DEFAULT_BUSINESS_CONFIG.secondaryColor,
      ctaColor:
        typeof parsed.ctaColor === 'string' && validateHexColor(parsed.ctaColor)
          ? parsed.ctaColor.toUpperCase()
          : DEFAULT_BUSINESS_CONFIG.ctaColor,
      logoUrl: typeof parsed.logoUrl === 'string' ? parsed.logoUrl : null,
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return { ...DEFAULT_BUSINESS_CONFIG };
  }
}

function writeConfig(config: BusinessConfig): void {
  ensureDataDirs();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

function findUploadedLogo(): { filePath: string; contentType: string } | null {
  ensureDataDirs();
  const candidates: Array<{ file: string; mime: string }> = [
    { file: 'logo.png', mime: 'image/png' },
    { file: 'logo.jpg', mime: 'image/jpeg' },
    { file: 'logo.webp', mime: 'image/webp' },
  ];
  for (const candidate of candidates) {
    const resolved = path.resolve(UPLOADS_DIR, candidate.file);
    if (!resolved.startsWith(UPLOADS_DIR + path.sep)) continue;
    if (fs.existsSync(resolved)) {
      return { filePath: resolved, contentType: candidate.mime };
    }
  }
  return null;
}

function clearUploadedLogos(): void {
  ensureDataDirs();
  for (const file of ['logo.png', 'logo.jpg', 'logo.webp']) {
    const resolved = path.resolve(UPLOADS_DIR, file);
    if (resolved.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
  }
}

function detectImageType(buffer: Buffer): { ext: 'png' | 'jpg' | 'webp'; mime: string } | null {
  if (buffer.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  // WEBP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

function getCanonicalLandingUrl(req: Request): string {
  const hostHeader = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  const protoHeader = (req.get('x-forwarded-proto') || req.protocol || 'https')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const safeProto = protoHeader === 'http' || protoHeader === 'https' ? protoHeader : 'https';

  if (hostHeader && /^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(hostHeader)) {
    return `${safeProto}://${hostHeader}/`;
  }

  const appUrl = (process.env.APP_URL || '').trim();
  if (appUrl && appUrl !== 'MY_APP_URL') {
    try {
      const parsed = new URL(appUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return `${parsed.origin}/`;
      }
    } catch {
      // fall through
    }
  }

  return `http://localhost:${PORT}/`;
}

async function startServer(): Promise<void> {
  ensureDataDirs();
  // Ensure initial config.json exists on startup with the supplied Google Review URL
  readConfig();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/config', (_req, res) => {
    const config = readConfig();
    const logoFile = findUploadedLogo();
    if (!logoFile && config.logoUrl) {
      config.logoUrl = null;
    }
    const urlCheck = validateGoogleReviewUrl(config.googleReviewUrl);
    res.json({
      config,
      isGoogleUrlValid: urlCheck.valid,
      googleUrlError: urlCheck.error,
      originalGoogleReviewUrl: DEFAULT_GOOGLE_REVIEW_URL,
    });
  });

  app.get('/api/logo', (_req, res) => {
    const logo = findUploadedLogo();
    if (!logo) {
      res.status(404).json({ error: 'No logo uploaded.' });
      return;
    }
    res.setHeader('Content-Type', logo.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(logo.filePath);
  });

  app.get('/api/qr.svg', async (req, res) => {
    try {
      const targetUrl = getCanonicalLandingUrl(req);
      const svg = await QRCode.toString(targetUrl, {
        type: 'svg',
        width: 512,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#0F172A', light: '#FFFFFF' },
      });
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      res.send(svg);
    } catch {
      res.status(500).json({ error: 'Unable to generate QR SVG.' });
    }
  });

  app.get('/api/qr.png', async (req, res) => {
    try {
      const targetUrl = getCanonicalLandingUrl(req);
      const pngBuffer = await QRCode.toBuffer(targetUrl, {
        type: 'png',
        width: 1200,
        margin: 3,
        errorCorrectionLevel: 'H',
        color: { dark: '#0F172A', light: '#FFFFFF' },
      });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      res.send(pngBuffer);
    } catch {
      res.status(500).json({ error: 'Unable to generate QR PNG.' });
    }
  });

  app.get('/api/auth/status', (req, res) => {
    const envManaged = getEnvPasscode().length > 0;
    const authStore = readAuthStore();
    const token = extractBearerToken(req);
    const authenticated = Boolean(verifySessionToken(token));
    res.json({
      initialized: envManaged || authStore !== null,
      envManaged,
      authenticated,
    });
  });

  app.post('/api/auth/setup', (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!checkRateLimit(`setup:${clientIp}`)) {
      res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
      return;
    }

    if (getEnvPasscode().length > 0 || readAuthStore() !== null) {
      res.status(409).json({ error: 'Admin password has already been configured.' });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Choose an admin password between 8 and 128 characters.' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    writeAuthStore({
      passwordHash,
      salt,
      claimedAt: new Date().toISOString(),
    });

    resetRateLimit(`setup:${clientIp}`);
    const session = signSessionToken();
    res.status(201).json({
      token: session.token,
      expiresAt: session.expiresAt,
      envManaged: false,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const clientIp = req.ip || 'unknown';
    if (!checkRateLimit(`login:${clientIp}`)) {
      res.status(429).json({ error: 'Too many login attempts. Please wait 15 minutes and try again.' });
      return;
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password) {
      res.status(400).json({ error: 'Password is required.' });
      return;
    }

    const envPasscode = getEnvPasscode();
    let valid = false;

    if (envPasscode.length > 0) {
      valid = timingSafeStringEqual(password, envPasscode);
    } else {
      const authStore = readAuthStore();
      if (!authStore) {
        res.status(409).json({ error: 'Admin password has not been set up yet.' });
        return;
      }
      const computedHash = hashPassword(password, authStore.salt);
      valid = timingSafeStringEqual(computedHash, authStore.passwordHash);
    }

    if (!valid) {
      res.status(401).json({ error: 'Incorrect admin password.' });
      return;
    }

    resetRateLimit(`login:${clientIp}`);
    const session = signSessionToken();
    res.json({
      token: session.token,
      expiresAt: session.expiresAt,
      envManaged: envPasscode.length > 0,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractBearerToken(req);
    const payload = verifySessionToken(token);
    if (payload) {
      revokedSessionIds.add(payload.sid);
    }
    res.json({ ok: true });
  });

  app.post('/api/auth/change-password', requireAdmin, (req, res) => {
    if (getEnvPasscode().length > 0) {
      res.status(400).json({
        error: 'Password is managed via the ADMIN_PASSCODE environment secret and cannot be changed here.',
      });
      return;
    }

    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    const authStore = readAuthStore();
    if (!authStore) {
      res.status(400).json({ error: 'Admin password store not initialized.' });
      return;
    }

    const currentHash = hashPassword(currentPassword, authStore.salt);
    if (!timingSafeStringEqual(currentHash, authStore.passwordHash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      res.status(400).json({ error: 'New password must be between 8 and 128 characters.' });
      return;
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = hashPassword(newPassword, newSalt);
    writeAuthStore({
      passwordHash: newHash,
      salt: newSalt,
      claimedAt: new Date().toISOString(),
    });

    res.json({ ok: true });
  });

  app.put('/api/admin/config', requireAdmin, (req, res) => {
    const existing = readConfig();
    const body = req.body as Partial<BusinessConfig>;

    const businessName =
      typeof body.businessName === 'string' ? body.businessName.trim() : existing.businessName;
    if (!businessName || businessName.length > 100) {
      res.status(400).json({ error: 'Business name must be between 1 and 100 characters.' });
      return;
    }

    const welcomeMessage =
      typeof body.welcomeMessage === 'string' ? body.welcomeMessage.trim().slice(0, 240) : existing.welcomeMessage;

    const rawGoogleUrl =
      typeof body.googleReviewUrl === 'string' ? body.googleReviewUrl : existing.googleReviewUrl;
    const urlCheck = validateGoogleReviewUrl(rawGoogleUrl);
    if (!urlCheck.valid || !urlCheck.normalizedUrl) {
      res.status(400).json({ error: urlCheck.error || 'Invalid Google Review URL.' });
      return;
    }

    const heading = typeof body.heading === 'string' ? body.heading.trim() : existing.heading;
    if (!heading || heading.length > 120) {
      res.status(400).json({ error: 'Heading must be between 1 and 120 characters.' });
      return;
    }

    const supportingText =
      typeof body.supportingText === 'string' ? body.supportingText.trim() : existing.supportingText;
    if (!supportingText || supportingText.length > 260) {
      res.status(400).json({ error: 'Supporting text must be between 1 and 260 characters.' });
      return;
    }

    const feedbackLabel =
      typeof body.feedbackLabel === 'string' ? body.feedbackLabel.trim() : existing.feedbackLabel;
    if (!feedbackLabel || feedbackLabel.length > 120) {
      res.status(400).json({ error: 'Feedback label must be between 1 and 120 characters.' });
      return;
    }

    const buttonText =
      typeof body.buttonText === 'string' ? body.buttonText.trim() : existing.buttonText;
    if (!buttonText || buttonText.length > 60) {
      res.status(400).json({ error: 'Button text must be between 1 and 60 characters.' });
      return;
    }

    const privacyNote =
      typeof body.privacyNote === 'string' ? body.privacyNote.trim() : existing.privacyNote;
    if (!privacyNote || privacyNote.length > 200) {
      res.status(400).json({ error: 'Privacy note must be between 1 and 200 characters.' });
      return;
    }

    const primaryColor =
      typeof body.primaryColor === 'string' ? body.primaryColor.trim().toUpperCase() : existing.primaryColor;
    const secondaryColor =
      typeof body.secondaryColor === 'string'
        ? body.secondaryColor.trim().toUpperCase()
        : existing.secondaryColor;
    const ctaColor =
      typeof body.ctaColor === 'string' ? body.ctaColor.trim().toUpperCase() : existing.ctaColor;

    if (!validateHexColor(primaryColor) || !validateHexColor(secondaryColor) || !validateHexColor(ctaColor)) {
      res.status(400).json({ error: 'Colors must be valid 6-digit hex values (e.g. #1D4ED8).' });
      return;
    }

    const updated: BusinessConfig = {
      businessName,
      welcomeMessage,
      googleReviewUrl: urlCheck.normalizedUrl,
      heading,
      supportingText,
      feedbackLabel,
      buttonText,
      privacyNote,
      primaryColor,
      secondaryColor,
      ctaColor,
      logoUrl: existing.logoUrl,
      updatedAt: new Date().toISOString(),
    };

    writeConfig(updated);
    res.json({
      config: updated,
      isGoogleUrlValid: true,
      originalGoogleReviewUrl: DEFAULT_GOOGLE_REVIEW_URL,
    });
  });

  app.post('/api/admin/logo', requireAdmin, (req, res) => {
    const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl.trim() : '';
    const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
      res.status(400).json({ error: 'Please upload a valid PNG, JPEG, or WebP image file.' });
      return;
    }

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0 || buffer.length > MAX_LOGO_BYTES) {
      res.status(400).json({ error: 'Logo image must be under 2 MB.' });
      return;
    }

    const detected = detectImageType(buffer);
    if (!detected) {
      res.status(400).json({ error: 'Unsupported or corrupted image file. Use PNG, JPEG, or WebP.' });
      return;
    }

    clearUploadedLogos();
    const targetFile = path.resolve(UPLOADS_DIR, `logo.${detected.ext}`);
    if (!targetFile.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(400).json({ error: 'Invalid upload destination.' });
      return;
    }

    fs.writeFileSync(targetFile, buffer);

    const existing = readConfig();
    const logoUrl = `/api/logo?v=${Date.now()}`;
    const updated: BusinessConfig = {
      ...existing,
      logoUrl,
      updatedAt: new Date().toISOString(),
    };
    writeConfig(updated);

    res.json({ logoUrl, config: updated });
  });

  app.delete('/api/admin/logo', requireAdmin, (_req, res) => {
    clearUploadedLogos();
    const existing = readConfig();
    const updated: BusinessConfig = {
      ...existing,
      logoUrl: null,
      updatedAt: new Date().toISOString(),
    };
    writeConfig(updated);
    res.json({ config: updated });
  });

  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Quick Google Review server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
