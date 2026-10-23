import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { env } from './config.js';
import { Photo } from './models/Photo.js';

// ---------------------------------------------------------------------------
// Names used across the API. Keep in sync with client/src/lib/constants.js.
// ---------------------------------------------------------------------------
export const ROLES = ['admin', 'marketing'];
export const STATUSES = ['ongoing', 'setup', 'implementation', 'support'];   // the onboarding steps, in order
export const STATUS_MESSAGE = 'Status must be Ongoing, Setup, Implementation or Support.';
export const DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

// ---------------------------------------------------------------------------
// Photos (saved to the database by middleware/upload.js; `photoId` is the Photo's id)
// ---------------------------------------------------------------------------
export const photoUrl = (photoId) => (photoId ? `/api/v1/uploads/${photoId}` : null);

export async function removePhoto(photoId) {
  if (!photoId) return;
  await Photo.deleteOne({ _id: photoId }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------
const ROUNDS = 12;
export const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS);

// When there is no account, still spend the time of a real check,
// so a wrong email can't be told apart from a wrong password.
let fallbackHash;
export async function verifyPassword(plain, hash) {
  if (!hash) {
    fallbackHash ??= await bcrypt.hash('no-account-placeholder-1', ROUNDS);
    await bcrypt.compare(plain, fallbackHash);
    return false;
  }
  return bcrypt.compare(plain, hash);
}

const WORDS = [
  'Amber', 'Basil', 'Breeze', 'Cedar', 'Cloud', 'Cocoa', 'Coral', 'Dawn', 'Delta', 'Ember', 'Falcon', 'Fern',
  'Garden', 'Glow', 'Harbor', 'Hazel', 'Island', 'Ivory', 'Jasmine', 'Juniper', 'Kite', 'Lemon', 'Lily', 'Lotus',
  'Mango', 'Maple', 'Meadow', 'Moss', 'Nectar', 'Nova', 'Olive', 'Orchid', 'Pebble', 'Pine', 'Quartz', 'Rain',
  'River', 'Robin', 'Saffron', 'Sky', 'Sunny', 'Teal', 'Tiger', 'Tulip', 'Velvet', 'Wave', 'Willow', 'Zest',
];

// A temporary password that is easy to read out or send on WhatsApp, e.g. "Mango-4821-River".
export function generateTemporaryPassword() {
  const word = () => WORDS[randomInt(WORDS.length)];
  return `${word()}-${String(randomInt(10_000)).padStart(4, '0')}-${word()}`;
}

// ---------------------------------------------------------------------------
// Sign-in sessions: a signed token in an httpOnly cookie
// ---------------------------------------------------------------------------
export const SESSION_COOKIE = 'pz_session';

// Bumping user.sessionVersion makes every older token stop working.
export function createSessionToken(user) {
  return jwt.sign({ sub: user.id, v: user.sessionVersion }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: `${env.SESSION_DAYS}d`,
  });
}

export function readSessionToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

// Host-only, httpOnly cookie: the browser sends it, page scripts can't read it.
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProduction,
  path: '/',
  maxAge: env.SESSION_DAYS * 24 * 60 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// Phone numbers: Bangladesh mobiles are stored as +8801XXXXXXXXX
// ---------------------------------------------------------------------------
const BD_MOBILE = /^\+8801[3-9]\d{8}$/;

// Accepts 01711234567, 8801711234567, +880 1711-234567 … Returns null if it isn't valid.
function normalizePhone(input) {
  let value = String(input ?? '').replace(/[\s\-().]/g, '');
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  if (value.startsWith('01')) value = `+88${value}`;
  else if (value.startsWith('880')) value = `+${value}`;
  return BD_MOBILE.test(value) ? value : null;
}

// ---------------------------------------------------------------------------
// Validation rules shared by the routes (zod). Messages are shown to people as they are.
// ---------------------------------------------------------------------------
export const emailField = z
  .string({ error: 'Please enter an email address.' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Please enter a valid email address.'));

// Any password is fine; it just can't be empty. (bcrypt only reads the first 72 characters.)
export const passwordField = z
  .string({ error: 'Please enter a password.' })
  .min(1, 'Please enter a password.')
  .max(72, 'Use 72 characters or fewer.');

export const personName = z
  .string({ error: 'Please enter a name.' })
  .trim()
  .min(2, 'Name should be at least 2 characters.')
  .max(80, 'Name should be 80 characters or fewer.');

export const phoneField = z
  .string({ error: 'Please enter a phone number.' })
  .trim()
  .min(1, 'Please enter a phone number.')
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Phone number should look like 01711-234567.' });
      return z.NEVER;
    }
    return normalized;
  });

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'That ID is not valid.');

// A required line of text, e.g. requiredText('Please enter the pharmacy name.')
export const requiredText = (message, max = 120) =>
  z.string({ error: message }).trim().min(2, message).max(max, `Use ${max} characters or fewer.`);

// An optional line of text: missing or null becomes "".
export const optionalText = (max = 120) =>
  z.preprocess((value) => value ?? '', z.string({ error: 'Please enter text.' }).trim().max(max, `Use ${max} characters or fewer.`));

export const optionalEmail = optionalText(120)
  .pipe(z.string().toLowerCase())
  .refine((value) => value === '' || z.email().safeParse(value).success, 'Please enter a valid email address.');

// "17:00" (24-hour) or "" when not given.
export const optionalTime = optionalText(5).refine(
  (value) => value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
  'Use a time like 17:00.',
);

// An amount in taka: a whole number, or null when not given.
export const optionalTaka = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.coerce.number({ error: 'Please enter an amount in taka.' }).int('Use a whole number of taka.').min(0).max(1_000_000).nullable(),
);
