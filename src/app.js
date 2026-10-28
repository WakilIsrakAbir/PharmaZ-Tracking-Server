// PharmaZ247 Tracker API. Start reading here.
//   1. middleware every request passes through
//   2. the routes (the whole API on one screen)
//   3. error handling
// Starting it is separate: server.js (your computer, or a normal host) and api/index.js (Vercel).
// Both import this file, which also starts the MongoDB connection (databaseReady, at the bottom).
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { connectDB, database, env } from './config.js';
import { requireAdmin, requireAuth, requireRole } from './middleware/auth.js';
import { ApiError, errorHandler, notFound } from './middleware/errors.js';
import { Doctor, doctorInput } from './models/Doctor.js';
import { Pharmacy, pharmacyInput } from './models/Pharmacy.js';
import authRoutes from './routes/auth.js';
import calendarRoutes from './routes/calendar.js';
import { recordRoutes } from './routes/records.js';
import supportCallRoutes from './routes/supportCalls.js';
import userRoutes from './routes/users.js';

const app = express();

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
api.use('/auth', authRoutes);                                                           // sign in / out, me, password
api.use('/users', requireAuth, requireAdmin, userRoutes);                               // team accounts (admin only)
// Onboarding: admins and the marketing team (marketing people only get the forms they submitted or were assigned to).
const onboarding = requireRole('admin', 'marketing');
api.use('/doctors', requireAuth, onboarding, recordRoutes(Doctor, doctorInput));        // doctor onboarding forms
api.use('/pharmacies', requireAuth, onboarding, recordRoutes(Pharmacy, pharmacyInput)); // pharmacy onboarding forms
api.use('/calendar', requireAuth, onboarding, calendarRoutes);                          // visits in a date range
// Support: admins and the support team (support people only get the calls they logged).
api.use('/support-calls', requireAuth, requireRole('admin', 'support'), supportCallRoutes); // the call log

app.use('/api/v1', api);

// 3. Errors ------------------------------------------------------------------
app.use(notFound);       // unknown URL → 404
app.use(errorHandler);   // any error → clean JSON

// Start connecting to MongoDB now, without waiting (the API must answer right away, with a 503 until
// the database is ready). Whoever starts the app can await this to know when the first try is over.
export const databaseReady = connectDB().catch(() => {});

export default app;
