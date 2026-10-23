// The API on Vercel. vercel.json sends every request here, and Vercel runs the Express app
// as one serverless function. Settings come from the project's Environment Variables, not .env.
import { app } from '../src/app.js';
import { connectDB } from '../src/config.js';

// Connect once per function instance (Vercel keeps a warm instance alive between requests).
// If MongoDB can't be reached, the API still answers: every request gets a 503 that says why.
await connectDB().catch(() => {});

export default app;
