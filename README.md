# PharmaZ247 Tracker: API (server)

The Express API behind the PharmaZ247 Tracker, an internal app for the PharmaZ247 marketing team. After visiting a doctor or a pharmacy, a team member fills in the onboarding form, and the form shows up on a shared calendar with its status. This API handles sign-in, team accounts, the doctor and pharmacy forms (with photos, status history and implementation steps), and the calendar.

The web app is in **[PharmaZ-Tracking-Client](https://github.com/WakilIsrakAbir/PharmaZ-Tracking-Client)**.

- **[PLAN.md](PLAN.md):** how the whole app works, and what's next
- **[TASKS.md](TASKS.md):** the checklist
- **[openapi.yaml](openapi.yaml):** the API contract, with examples

## Folders

```text
src/
├── server.js       START HERE: middleware and every route on one screen
├── config.js       settings + database connection
├── utils.js        passwords, sign-in sessions, phone numbers, validation rules
├── models/         User, Doctor, Pharmacy (+ the shared visit, status and steps fields)
├── routes/         auth, users, records (doctors & pharmacies), calendar
└── middleware/     sign-in checks, photo uploads, errors
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
| `npm run dev` | Starts the API on http://localhost:4000, and restarts it when a file changes |
| `npm start` | Starts the API without watching files (for hosting) |
| `npm run test:api` | Runs the 74 Postman API tests against a throwaway API and database (your data is never touched) |
| `npm run seed:admin` | Creates the first admin from `.env` (safe to run twice) |
| `npm run db` | Starts a local MongoDB, only when `MONGODB_URI` points at this computer |

## The database

- **MongoDB Atlas** (cluster `pharmaz247tracking`, database `pharmaz-tracker`). The connection string, including its password, lives only in `.env`. The connection always uses TLS encryption.
- Atlas only accepts connections from the IP addresses in **Network Access**. If your internet IP changes, add the new one there.
- The admin password is stored as a bcrypt hash, never as plain text.
- **Working offline:** set `MONGODB_URI=mongodb://127.0.0.1:27017/pharmaz-tracker`. `npm run db` then starts a local MongoDB with nothing to install, keeping its data in `.data/db`.
- Photos are saved in `uploads/`, which git ignores.
