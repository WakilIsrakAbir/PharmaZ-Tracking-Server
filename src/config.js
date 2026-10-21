import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { z } from 'zod';

// Every setting the API needs, checked once at startup.
// The full list with explanations is in server/.env.example.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string({ error: 'is missing' }).min(1, 'is missing'),
  JWT_SECRET: z.string({ error: 'is missing' }).min(32, 'must be at least 32 characters long'),
  SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  CLIENT_ORIGIN: z.url({ error: 'must be a full URL, like http://localhost:3000' }).default('http://localhost:3000'),
  UPLOADS_DIR: z.string().optional(),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error("\n✖ The API can't start. Please fix these settings in server/.env:\n");
  for (const issue of result.error.issues) {
    console.error(`  • ${issue.path.join('.')} ${issue.message}`);
  }
  console.error('\n  See server/.env.example for every setting.\n');
  process.exit(1);
}

export const env = {
  ...result.data,
  isProduction: result.data.NODE_ENV === 'production',
};

// Doctor and pharmacy photos are saved here (git-ignored).
export const UPLOADS_DIR = env.UPLOADS_DIR ?? fileURLToPath(new URL('../uploads', import.meta.url));

// Connects to MongoDB. Outside production it keeps trying for about a minute,
// so the API can start while the local database is still starting up.
export async function connectDB() {
  const maxAttempts = env.isProduction ? 1 : 24;

  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 2500 });
      console.log(`✓ MongoDB connected (database "${mongoose.connection.name}")`);
      return;
    } catch (error) {
      if (attempt >= maxAttempts) {
        console.error('✖ Could not connect to MongoDB. Check MONGODB_URI in server/.env, or start the local database with `npm run db`.');
        throw error;
      }
      if (attempt === 1) console.log('… waiting for MongoDB');
    }
  }
}
