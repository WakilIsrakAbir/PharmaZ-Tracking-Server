import mongoose from 'mongoose';

// A doctor's or pharmacy's photo, stored in the database as WebP (middleware/upload.js converts
// and shrinks it on upload, so each one is roughly 50–150 KB). A record's `photo` field holds the
// Photo's id. Keeping photos in MongoDB means they work on any host, including Vercel, where the
// API has no disk of its own.
const photoSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, default: 'image/webp' },
    width: Number,
    height: Number,
    bytes: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Photo = mongoose.model('Photo', photoSchema);
