// PharmaZ247 Tracker API. Start reading here.
//   1. middleware every request passes through
//   2. the routes (the whole API on one screen)
//   3. error handling
//   4. connect to MongoDB and start listening
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { UPLOADS_DIR, connectDB, database, env } from './config.js';
import { requireAdmin, requireAuth } from './middleware/auth.js';
import { ApiError, errorHandler, notFound } from './middleware/errors.js';
import { requirePhotoAccess } from './middleware/upload.js';
import { Doctor, doctorInput } from './models/Doctor.js';
import { Pharmacy, pharmacyInput } from './models/Pharmacy.js';
import authRoutes from './routes/auth.js';
import calendarRoutes from './routes/calendar.js';
import { recordRoutes } from './routes/records.js';
import userRoutes from './routes/users.js';

const app = express();

// Photos need a sign-in, so only the viewer's own browser may keep a copy (for a week).
const privateCache = (res) => res.setHeader('Cache-Control', 'private, max-age=604800');

// 1. Middleware ------------------------------------------------------------
app.set('trust proxy', 1);   // requests come through one proxy (the web app's /api rewrite or the host)
app.use(helmet());           // security headers
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
if (env.NODE_ENV !== 'test') app.use(morgan(env.isProduction ? 'combined' : 'dev'));

// 2. Routes ------------------------------------------------------------------
const api = express.Router();

// Until MongoDB is connected, every request gets a 503 that says why (instead of hanging).
api.use((req, res, next) => {
  if (database.ready) return next();
  next(new ApiError(503, database.problem, { code: 'DATABASE_UNAVAILABLE' }));
});

api.get('/health', (req, res) => res.json({ ok: true }));
api.use('/auth', authRoutes);                                               // sign in / out, me, password
api.use('/users', requireAuth, requireAdmin, userRoutes);                   // team accounts (admin only)
// Doctors, pharmacies, the calendar and photos: marketing people only get the forms they submitted.
api.use('/doctors', requireAuth, recordRoutes(Doctor, doctorInput));        // doctor onboarding forms
api.use('/pharmacies', requireAuth, recordRoutes(Pharmacy, pharmacyInput)); // pharmacy onboarding forms
api.use('/calendar', requireAuth, calendarRoutes);                          // visits in a date range
api.use('/uploads', requireAuth, requirePhotoAccess, express.static(UPLOADS_DIR, { cacheControl: false, setHeaders: privateCache })); // photos

app.use('/api/v1', api);

// 3. Errors ------------------------------------------------------------------
app.use(notFound);       // unknown URL → 404
app.use(errorHandler);   // any error → clean JSON

// 4. Start -------------------------------------------------------------------
// The API answers right away, then connects to MongoDB. Until that works, requests get a 503
// that says why (step 2), so the web app can show the reason instead of "can't reach the server".

// On a developer's computer, only this computer can reach the API (the web app forwards
// /api to it). On a host, it must accept outside connections.
const host = env.isProduction ? '0.0.0.0' : '127.0.0.1';

app.listen(env.PORT, host, (error) => {
  if (error) {
    const hint =
      error.code === 'EADDRINUSE'
        ? '\n  Another copy of the API is already using this port (maybe in another terminal). Stop it,\n  or run `npm run dev` again: it stops old copies first.'
        : '';
    console.error(`✖ The API could not start on port ${env.PORT}: ${error.message}${hint}`);
    process.exit(1);
  }
  console.log(`✓ API listening on http://localhost:${env.PORT}/api/v1`);
});

await connectDB();
