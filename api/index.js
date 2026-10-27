// The API on Vercel. vercel.json sends every request here, and Vercel runs the Express app
// as one serverless function. Settings come from the project's Environment Variables, not .env.
import app, { databaseReady } from '../src/app.js';

// Wait for the first connection attempt once per function instance (Vercel keeps a warm instance
// alive between requests), but never longer than 8 seconds: if MongoDB can't be reached, the API
// still answers, and every request gets a 503 that says why, until it connects.
const atMost = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await Promise.race([databaseReady, atMost(8000)]);

export default app;
