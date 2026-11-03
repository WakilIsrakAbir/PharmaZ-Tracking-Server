import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { z } from 'zod';

// Read server/.env, except in the API tests (they bring their own throwaway settings).
// A setting that is already in the environment always wins, so a host's settings are never overridden.
const ENV_FILE = fileURLToPath(new URL('../.env', import.meta.url));
if (process.env.NODE_ENV !== 'test' && existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

// An optional setting: an empty value counts as "not given".
const optional = (schema) => z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

// Every setting the API needs, checked once at startup.
// The full list with explanations is in server/.env.example.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string({ error: 'is missing' }).min(1, 'is missing'),
  JWT_SECRET: z.string({ error: 'is missing' }).min(32, 'must be at least 32 characters long'),
  SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  CLIENT_ORIGIN: z.url({ error: 'must be a full URL, like http://localhost:3000' }).default('http://localhost:3000'),
  // Email (optional). Without these, the API works but sends no email; see email.js.
  SMTP_HOST: optional(z.string()),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optional(z.string()),
  SMTP_PASS: optional(z.string()),
  EMAIL_FROM: optional(z.string()),
  APP_URL: optional(z.url({ error: 'must be a full URL, like https://tracker.example.com' })),
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
  // Where the web app lives, for links in emails. Usually the same as CLIENT_ORIGIN.
  appUrl: result.data.APP_URL ?? result.data.CLIENT_ORIGIN,
  // Email is on only when every SMTP setting is there.
  emailEnabled: Boolean(result.data.SMTP_HOST && result.data.SMTP_USER && result.data.SMTP_PASS && result.data.EMAIL_FROM),
};

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

// The database connection as requests see it. Until it is ready, the API answers every request
// with a 503 and this reason (requireDatabase in server.js), so the web app can say what's wrong.
// Once connected, a short drop is left to the driver: it reconnects by itself and queries made
// meanwhile wait for it (readyState 2, "connecting"), so a hiccup doesn't turn into 503s.
export const database = {
  problem: 'The API is still connecting to its database. Please try again in a moment.',
  connectedOnce: false,
  get ready() {
    const state = mongoose.connection.readyState;
    return state === 1 || (this.connectedOnce && state === 2);
  },
};

// Connects to MongoDB and caches connection for serverless/long-running use:
// In production/serverless, fails fast with 503 if unreachable, so requests never hang until Vercel timeout.
export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    database.connectedOnce = true;
    return mongoose.connection;
  }

  if (cached.promise) {
    return cached.promise;
  }

  const opts = {
    serverSelectionTimeoutMS: 5000,
    bufferCommands: false,
    maxPoolSize: env.isProduction ? 10 : undefined,
  };

  mongoose.connection.on('disconnected', () => {
    database.problem = 'The server lost its database connection and is reconnecting. Please try again in a moment.';
    cached.promise = null;
  });

  cached.promise = (async () => {
    for (let attempt = 1; ; attempt++) {
      try {
        await mongoose.connect(env.MONGODB_URI, opts);
        console.log(`✓ MongoDB connected (database "${mongoose.connection.name}")`);
        database.connectedOnce = true;
        return mongoose.connection;
      } catch (error) {
        cached.promise = null;
        if (env.isProduction) {
          database.problem = "The server can't reach its database right now. Please try again in a moment.";
          console.error(`✖ Could not connect to MongoDB: ${error.message}`);
          throw error;
        }
        if (attempt === 1) {
          database.problem = await whyNoDatabase(error);
          console.error(`✖ ${database.problem}`);
        } else if (attempt % 12 === 0) {
          console.log('… still waiting for MongoDB');
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  })();

  return cached.promise;
}

// The likely reason MongoDB can't be reached, and what to do, in plain words.
async function whyNoDatabase(error) {
  if (/auth/i.test(error.message)) {
    return 'MongoDB refused the username or password in MONGODB_URI (server/.env). Check them in Atlas → Database Access.';
  }
  if (env.MONGODB_URI.startsWith('mongodb+srv://')) {
    const ip = await publicIp();
    return (
      `MongoDB Atlas isn't accepting this computer's internet address${ip ? ` (${ip})` : ''}. ` +
      'Add it in Atlas: Network Access → Add IP Address → Add Current IP Address. ' +
      'The API keeps trying and connects by itself.'
    );
  }
  return "The local MongoDB isn't running. Start it with `npm run db`; the API keeps trying.";
}

// This computer's public IP address (the one Atlas sees), or null when it can't be found quickly.
async function publicIp() {
  try {
    const response = await fetch('https://api.ipify.org', { signal: AbortSignal.timeout(3000) });
    return response.ok ? (await response.text()).trim() : null;
  } catch {
    return null;
  }
}
