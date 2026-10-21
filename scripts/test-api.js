// Runs the Postman collection against a throwaway API and database:
//   1. starts an empty in-memory MongoDB and a temporary photo folder
//   2. creates a test admin and starts the API on port 4100
//   3. runs postman/collections/PharmaZ247 Tracker
//   4. stops everything and deletes the temporary data; the exit code is Postman's
// Your real data and the real admin password are never used.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const serverDir = fileURLToPath(new URL('..', import.meta.url));
const uploadsDir = mkdtempSync(path.join(tmpdir(), 'pharmaz-test-uploads-'));
const PORT = 4100;
const admin = { email: 'admin@test.pharmaz247.local', password: 'Test-Admin-2026' };

const mongod = await MongoMemoryServer.create();
const testEnv = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(PORT),
  MONGODB_URI: mongod.getUri('pharmaz-tracker-test'),
  JWT_SECRET: 'test-only-secret-'.padEnd(64, 'x'),
  CLIENT_ORIGIN: 'http://localhost:3000',
  UPLOADS_DIR: uploadsDir,
  SEED_ADMIN_NAME: 'Test Admin',
  SEED_ADMIN_EMAIL: admin.email,
  SEED_ADMIN_PASSWORD: admin.password,
};

let api;
let exitCode = 1;

try {
  await run(process.execPath, ['scripts/seed-admin.js'], serverDir, testEnv);

  api = spawn(process.execPath, ['src/server.js'], { cwd: serverDir, env: testEnv, stdio: ['ignore', 'ignore', 'inherit'] });
  await waitForHealth(`http://localhost:${PORT}/api/v1/health`);

  exitCode = await run(
    'postman',
    [
      'collection', 'run', 'postman/collections/PharmaZ247 Tracker',
      '-e', 'postman/environments/local.environment.yaml',
      '--env-var', `baseUrl=http://localhost:${PORT}/api/v1`,
      '--env-var', `adminEmail=${admin.email}`,
      '--env-var', `adminPassword=${admin.password}`,
    ],
    serverDir, // the photo uploads in the tests read postman/fixtures/ from here
    process.env,
  );
} catch (error) {
  console.error(`✖ ${error.message}`);
} finally {
  api?.kill();
  await mongod.stop();
  rmSync(uploadsDir, { recursive: true, force: true });
}

process.exit(exitCode);

function run(command, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
    child.once('error', (error) => reject(new Error(`Could not run ${command}: ${error.message}`)));
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

async function waitForHealth(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`The test API did not start within ${timeoutMs / 1000} seconds.`);
}
