import { Router } from 'express';
import { z } from 'zod';

import { loginLimiter, requireAuth } from '../middleware/auth.js';
import { ApiError, validate } from '../middleware/errors.js';
import { User, withCreator } from '../models/User.js';
import {
  SESSION_COOKIE,
  createSessionToken,
  emailField,
  hashPassword,
  passwordField,
  sessionCookieOptions,
  verifyPassword,
} from '../utils.js';

// /api/v1/auth. There is no sign-up on purpose: only an admin can create accounts (POST /users).
const router = Router();

const loginBody = z.object({
  email: emailField,
  password: z.string({ error: 'Please enter your password.' }).min(1, 'Please enter your password.'),
});

const passwordBody = z.object({
  currentPassword: z.string({ error: 'Please enter your current password.' }).min(1, 'Please enter your current password.'),
  newPassword: passwordField,
});

// Sign in → sets the session cookie.
router.post('/login', loginLimiter, validate({ body: loginBody }), async (req, res) => {
  const { email, password } = req.valid.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = await verifyPassword(password, user?.passwordHash);

  if (!user || !passwordMatches) {
    throw new ApiError(401, "That email and password don't match.", { code: 'INVALID_CREDENTIALS' });
  }
  if (!user.isActive) {
    throw new ApiError(403, 'Your account has been deactivated. Ask your admin for help.', { code: 'ACCOUNT_INACTIVE' });
  }

  user.lastLoginAt = new Date();
  await user.save();

  res.cookie(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions);
  res.json({ data: await withCreator(user) });
});

// Sign out. Works even with an expired session, so sign-out never gets stuck.
router.post('/logout', (req, res) => {
  const { maxAge, ...cookieOptions } = sessionCookieOptions;
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.status(204).end();
});

// Who is signed in.
router.get('/me', requireAuth, async (req, res) => {
  res.json({ data: await withCreator(req.user) });
});

// Change my password (also used at first sign-in to replace the temporary one).
// Every other session of this user ends; this one gets a fresh cookie.
router.patch('/password', requireAuth, validate({ body: passwordBody }), async (req, res) => {
  const { currentPassword, newPassword } = req.valid.body;
  const user = await User.findById(req.user._id).select('+passwordHash');

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw ApiError.validation({ currentPassword: "That isn't your current password." });
  }
  if (newPassword === currentPassword) {
    throw ApiError.validation({ newPassword: 'Choose a password that is different from your current one.' });
  }

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  user.sessionVersion += 1;
  await user.save();

  res.cookie(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions);
  res.json({ data: await withCreator(user) });
});

export default router;
