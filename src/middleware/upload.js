import multer from 'multer';
import sharp from 'sharp';

import { Doctor } from '../models/Doctor.js';
import { Pharmacy } from '../models/Pharmacy.js';
import { Photo } from '../models/Photo.js';
import { visibleTo } from '../models/shared.js';
import { objectId } from '../utils.js';
import { ApiError } from './errors.js';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIDE = 1200; // a photo is shrunk so its longer side is at most this many pixels

// The photo is kept in memory only until it has been converted and saved to the database.
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, done) =>
    PHOTO_TYPES.includes(file.mimetype)
      ? done(null, true)
      : done(ApiError.validation({ photo: 'Please choose a JPG, PNG or WEBP photo.' })),
}).single('photo');

// For the doctor and pharmacy forms. Accepts either:
//   • plain JSON (no photo), or
//   • multipart/form-data: an optional `photo` file + every other field as JSON in `data`.
// Either way, req.body ends up holding the form fields, and req.photoId the saved photo's id (or null).
export function formWithPhoto(req, res, next) {
  req.photoId = null;
  if (!req.is('multipart/form-data')) return next();

  photoUpload(req, res, async (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') return next(ApiError.validation({ photo: 'The photo must be 2 MB or smaller.' }));
    if (error) return next(error);
    try {
      req.body = req.body?.data ? JSON.parse(req.body.data) : {};
    } catch {
      return next(new ApiError(400, "The form data couldn't be read.", { code: 'INVALID_JSON' }));
    }
    try {
      if (req.file) req.photoId = await savePhoto(req.file.buffer);
      next();
    } catch {
      next(ApiError.validation({ photo: "That photo couldn't be read. Please choose another one." }));
    }
  });
}

// Shrinks the photo, turns it into WebP and saves it. Returns the new Photo's id.
async function savePhoto(buffer) {
  const { data, info } = await sharp(buffer)
    .rotate() // phones store the orientation separately; bake it in so the photo shows upright
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  const photo = await Photo.create({ data, width: info.width, height: info.height, bytes: info.size });
  return String(photo._id);
}

// GET /uploads/:id. Photos are as private as their forms: a photo only loads for someone who can
// see its form. Use after requireAuth. The browser may keep its own copy for a week.
export async function sendPhoto(req, res) {
  const { id } = req.params;
  const canSee = objectId.safeParse(id).success && (await recordWithPhoto(id, req.user));
  const photo = canSee ? await Photo.findById(id) : null;
  if (!photo) throw new ApiError(404, "We couldn't find that photo.");

  res.setHeader('Cache-Control', 'private, max-age=604800');
  res.type(photo.contentType).send(photo.data);
}

async function recordWithPhoto(photoId, user) {
  const filter = { photo: photoId, ...visibleTo(user) };
  return (await Doctor.exists(filter)) || (await Pharmacy.exists(filter));
}
