# PharmaZ247 Tracker: API (server)

The Express API behind the PharmaZ247 Tracker, an internal app for the PharmaZ247 marketing team. After visiting a doctor or a pharmacy, a team member fills in the onboarding form, and the form shows up on a shared calendar with its status. This API handles sign-in, team accounts, the doctor and pharmacy forms (with photos, status history and implementation steps), and the calendar.

The web app is in **[PharmaZ-Tracking-Client](https://github.com/WakilIsrakAbir/PharmaZ-Tracking-Client)**.

- **[PLAN.md](PLAN.md):** how the whole app works, and what's next
- **[TASKS.md](TASKS.md):** the checklist
- **[openapi.yaml](openapi.yaml):** the API contract, with examples

## Folders

```text
src/
├── app.js          START HERE: middleware and every route on one screen
├── server.js       starts the API on your computer or a normal host (npm start)
├── config.js       settings + database connection
├── utils.js        passwords, sign-in sessions, phone numbers, validation rules
├── email.js        the assignment email (SMTP)
├── models/         User, Doctor, Pharmacy, Photo (+ the shared visit, status and steps fields)
├── routes/         auth, users, records (doctors & pharmacies), calendar
└── middleware/     sign-in checks, photo uploads, errors
api/index.js        starts the API on Vercel (see "Going live")
vercel.json         tells Vercel to send every request to api/index.js
scripts/            local database, create the first admin, API tests
postman/            the API tests (a Postman collection)
openapi.yaml        the API contract
```

## First-time setup

You need Node.js 22.9 or newer (24 recommended), plus the [Postman CLI](https://learning.postman.com/docs/postman-cli/postman-cli-installation/) for the API tests.

1. Install: `npm install`
2. Copy `.env.example` to `.env`, then fill in `MONGODB_URI`, `JWT_SECRET` and the `SEED_ADMIN_*` values. `.env` holds secrets and is git-ignored: never commit it.
3. Create the first admin: `npm run seed:admin`. Then empty `SEED_ADMIN_PASSWORD` in `.env` again.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API on http://localhost:4000 with nodemon, which restarts it when a file in `src/` or `.env` changes. An old copy still using port 4000 is stopped first. If MongoDB can't be reached, it says why and keeps trying |
| `npm start` | Starts the API without watching files (for hosting) |
| `npm run test:api` | Runs the 87 Postman API tests against a throwaway API and database (your data is never touched); no email is sent |
| `npm run seed:admin` | Creates the first admin from `.env` (safe to run twice) |
| `npm run db` | Starts a local MongoDB, only when `MONGODB_URI` points at this computer |

## The database

- **MongoDB Atlas** (cluster `pharmaz247tracking`, database `pharmaz-tracker`). The connection string, including its password, lives only in `.env`. The connection always uses TLS encryption.
- Atlas only accepts connections from the IP addresses in **Network Access**. Internet providers sometimes give you a new IP; then the API says "Can't reach MongoDB Atlas". Fix it in Atlas: **Network Access → Add IP Address → Add Current IP Address**. The API keeps trying and starts by itself once it can connect.
- The admin password is stored as a bcrypt hash, never as plain text.
- **Working offline:** set `MONGODB_URI=mongodb://127.0.0.1:27017/pharmaz-tracker`. `npm run db` then starts a local MongoDB with nothing to install, keeping its data in `.data/db`.
- Photos live in the database too (the `photos` collection), as WebP shrunk to at most 1200px, roughly 50–150 KB each. So they work on any host, and a backup of the database includes them.

## Email

When an admin assigns teammates to a form, each newly assigned person gets an email with the whole form (`src/email.js`). It goes out over SMTP, so any mail account works; the settings are in `.env.example`:

- **Gmail or Google Workspace:** `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER` = the address, `SMTP_PASS` = an **App Password** (Google Account → Security → 2-Step Verification → App passwords; never the real password), `EMAIL_FROM="PharmaZ247 Tracker <the address>"`. Gmail allows about 500 emails a day, Workspace 2,000.
- **Brevo** (free, 300 a day): `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, and the login from Brevo → SMTP & API.
- `APP_URL` is the web app's address, for the "Open in the tracker" button. It defaults to `CLIENT_ORIGIN`.

Without these settings the API sends nothing: assigning still works, and the admin is told that no email went out. Replies go to the admin who assigned (`Reply-To`). On Vercel, add the same settings to the project's Environment Variables and redeploy.

## Going live on Vercel

Two Vercel projects, one per repository. Put the API live first, because the web app needs its address.

**1. The API (this repository)**

1. In Vercel: **Add New → Project**, import `PharmaZ-Tracking-Server`. Framework preset: **Other**. Leave the build settings empty.
2. **Environment Variables**, before the first deploy:
   - `MONGODB_URI`: the Atlas connection string. Use a different database name than your development one, for example `/pharmaz-tracker-live`, so testing never touches live data.
   - `JWT_SECRET`: a new random string, not the one in your local `.env` (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
   - `CLIENT_ORIGIN`: the web app's address, once you know it (step 2). Until then any value, e.g. `https://example.com`.
   - `NODE_ENV`: `production`.
   - For email (optional, can be added later): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` and `APP_URL` (the web app's address). See "Email" below.
3. **Deploy.** Then open `https://<your-api>.vercel.app/api/v1/health`: it should answer `{"ok":true}`. A 503 means Atlas is refusing the connection: see the next step.
4. **Atlas → Network Access:** Vercel has no fixed IP address, so add `0.0.0.0/0` ("allow access from anywhere"). The connection is still encrypted and still needs the username and password, so make the database user's password long and random.
5. **The first admin:** on your computer, run `npm run seed:admin` with `MONGODB_URI` in `.env` temporarily pointing at the live database name, and the `SEED_ADMIN_*` values filled in. Then put `.env` back and empty `SEED_ADMIN_PASSWORD`.

**2. The web app ([PharmaZ-Tracking-Client](https://github.com/WakilIsrakAbir/PharmaZ-Tracking-Client))**

1. **Add New → Project**, import `PharmaZ-Tracking-Client`. The preset is detected as Next.js.
2. **Environment Variables:** `API_URL` = `https://<your-api>.vercel.app` (no trailing slash). The web app forwards every `/api/*` request there, so the browser only ever talks to the web app's own address, and the sign-in cookie just works.
3. **Deploy**, then open the web app and sign in with the admin account.
4. Back in the API project, set `CLIENT_ORIGIN` to the web app's address and **Redeploy** it.

**What to know about Vercel**

- Each push to `main` deploys again by itself, in both projects.
- The API runs as a serverless function with no disk of its own. That's fine: photos are stored in the database, not in files.
- Settings come from the project's Environment Variables; `.env` is never uploaded. Changing a variable needs a redeploy.
- Logs: the project's **Logs** tab shows what `console.log` and `console.error` printed, including "MongoDB connected" or why it couldn't.
