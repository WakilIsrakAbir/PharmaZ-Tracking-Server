// The API on Vercel. vercel.json sends every request here, and Vercel runs the Express app
// as one serverless function. Settings come from the project's Environment Variables, not .env.
import app, { databaseReady } from '../src/app.js';

// Wait for the first connection attempt (a few seconds at most) once per function instance; Vercel
// keeps a warm instance alive between requests. If MongoDB can't be reached, the API still answers:
// every request gets a 503 that says why.
await databaseReady;

export default app;
