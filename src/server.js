// Starts the API on your computer, or on a host that runs `npm start` (Render, Railway, a VPS…).
// On Vercel, api/index.js is used instead. The API itself is in app.js.
import app, { databaseReady } from './app.js';
import { env } from './config.js';

// The API answers right away while app.js connects to MongoDB. Until that works, requests get a 503
// that says why (app.js, step 2), so the web app can show the reason instead of "can't reach the server".

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

await databaseReady;
