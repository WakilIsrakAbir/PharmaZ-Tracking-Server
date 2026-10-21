import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

import { User } from '../models/User.js';
import { SESSION_COOKIE, readSessionToken } from '../utils.js';
import { ApiError } from './errors.js';

// Reads the session cookie → checks the token → loads the user → req.user.
export async function requireAuth(req, res, next) {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) throw new ApiError(401, 'Please sign in to continue.');

  const session = readSessionToken(token);
  const user = session && (await User.findById(session.sub));

  // A deactivation or password reset bumps sessionVersion, which ends older sessions.
  if (!user || !user.isActive || user.sessionVersion !== session.v) {
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  req.user = user;
  next();
}

// Use after requireAuth.
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') throw new ApiError(403, "You don't have permission to do that.");
  next();
}

// 5 failed sign-in attempts per email + IP address every 15 minutes. Successful sign-ins don't count.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email ?? '').trim().toLowerCase()}`,
  handler: (req, res, next) => next(new ApiError(429, 'Too many sign-in attempts. Please wait 15 minutes and try again.')),
});
