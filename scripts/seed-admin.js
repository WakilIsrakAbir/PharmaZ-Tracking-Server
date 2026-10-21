// Creates the first admin from SEED_ADMIN_* in server/.env.
// Safe to run more than once: an existing account is never changed.
import mongoose from 'mongoose';

import { connectDB } from '../src/config.js';
import { User } from '../src/models/User.js';
import { hashPassword } from '../src/utils.js';

const name = process.env.SEED_ADMIN_NAME?.trim() || 'Admin';
const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;

if (!email || !password) {
  console.error('✖ Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in server/.env, then run this again.');
  process.exit(1);
}

await connectDB();

const existing = await User.findOne({ email });
if (existing) {
  console.log(`✓ ${email} already exists (${existing.role}). Nothing was changed.`);
} else {
  await User.create({ name, email, passwordHash: await hashPassword(password), role: 'admin' });
  console.log(`✓ Admin account created for ${email}.`);
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password) || password.length < 12) {
    console.log('  Tip: this password is easy to guess. Change it after your first sign-in (Account → Change password).');
  }
}

await mongoose.disconnect();
