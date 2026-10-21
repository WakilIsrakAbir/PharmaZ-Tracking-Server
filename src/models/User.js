import mongoose from 'mongoose';

import { ROLES } from '../utils.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: null },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'marketing' },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },  // true until they replace a temporary password
    sessionVersion: { type: Number, default: 0 },           // +1 ends every session of this user
    lastLoginAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      // What the API sends: `id` first, and never the password or session data.
      transform: (doc, { _id, passwordHash, sessionVersion, ...user }) => ({ id: String(_id), ...user }),
    },
  },
);

export const User = mongoose.model('User', userSchema);

// Adds the creator's name, so every user the API returns has the same shape.
export const withCreator = (user) => user.populate('createdBy', 'name');
