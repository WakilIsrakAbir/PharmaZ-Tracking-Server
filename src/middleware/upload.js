import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import multer from 'multer';

import { UPLOADS_DIR } from '../config.js';
import { Doctor } from '../models/Doctor.js';
import { Pharmacy } from '../models/Pharmacy.js';
import { visibleTo } from '../models/shared.js';
import { ApiError } from './errors.js';

mkdirSync(UPLOADS_DIR, { recursive: true });

const PHOTO_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, done) => done(null, `${randomUUID()}${PHOTO_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, done) =>
    PHOTO_TYPES[file.mimetype]
      ? done(null, true)
      : done(ApiError.validation({ photo: 'Please choose a JPG, PNG or WEBP photo.' })),
}).single('photo');

// For the doctor and pharmacy forms. Accepts either:
//   • plain JSON (no photo), or
//   • multipart/form-data: an optional `photo` file + every other field as JSON in `data`.
// Either way, req.body ends up holding the form fields, and req.file the photo.
export function formWithPhoto(req, res, next) {
  if (!req.is('multipart/form-data')) return next();

  photoUpload(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') return next(ApiError.validation({ photo: 'The photo must be 2 MB or smaller.' }));
    if (error) return next(error);
    try {
      req.body = req.body?.data ? JSON.parse(req.body.data) : {};
      next();
    } catch {
      next(new ApiError(400, "The form data couldn't be read.", { code: 'INVALID_JSON' }));
    }
  });
}

// Photos are as private as their forms: a photo only loads for someone who can see its form.
// Use after requireAuth.
export async function requirePhotoAccess(req, res, next) {
  const filter = { photo: path.basename(req.path), ...visibleTo(req.user) };
  const canSee = (await Doctor.exists(filter)) || (await Pharmacy.exists(filter));
  if (!canSee) throw new ApiError(404, "We couldn't find that photo.");
  next();
}
