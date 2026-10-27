# PharmaZ247 Tracker — Tasks

What's done and what's next. See [PLAN.md](PLAN.md) for how it works. A box is ticked only when the task is built **and** tested.

**Status (27 Oct 2026):** the app is live on Vercel. Version 7 added the Demo status, the year overview, greyed past days (no new visits in the past), and the people at the top of the details. **Next:** the remaining items under "For you".

---

## ✅ Done

### Accounts
- [x] Admin account created from `.env` (`npm run seed:admin`); no public sign-up
- [x] Sign in / out; 5 failed tries per 15 minutes; 7-day sessions in an httpOnly cookie
- [x] First sign-in: choose your own password (any password is allowed: no length, letter or number rules)
- [x] Team page (admin): add a teammate (temporary password shown once, "Copy message" for WhatsApp), edit, change role, reset password, deactivate / reactivate
- [x] Account page: your details, change password

### Forms (filled in by the marketing team)
- [x] Doctor form: paper fields 1–15 in the same order and numbering (field 2, the picture, is not kept since 27 Oct 2026)
- [x] Pharmacy form: 13 draft fields (field 2, the shop photo, is not kept since 27 Oct 2026)
- [x] Visit date + time and status (Ongoing / Setup / Implementation / Support) on every form, plus notes
- [x] Field-by-field error messages; edit a submitted form; admins can delete

### Dashboard: calendar + details (home page, `/`)
- [x] "New doctor form" and "New pharmacy form" buttons at the top (alike, so neither looks selected) open a new form for the chosen day
- [x] Month calendar: week starts Saturday, Friday shaded, today highlighted, visits as chips colored by status (no legend under it)
- [x] Filter: All / Doctors / Pharmacies
- [x] Click a day → that day's visits; an empty day offers the same two "New … form" buttons for that day
- [x] Click a visit → details beside the calendar:
  - person, place + Google Maps, Call / WhatsApp
  - status update with date and note
  - history (who, when)
  - all form fields
- [x] The view lives in the URL, so it can be shared and survives a refresh
- [x] Phones: dots on the calendar, details below it

### Lists
- [x] Doctors and Pharmacies: status tabs with counts, search, a full page for each form

### Version 5 (21 Oct 2026)
- [x] Details panel in two sections: **Details** (read only) and **Status** (editable, in a tinted box with a blue border), with **Edit form** beside the Status title; no field list or "Full page" button in the panel (the notes moved into Details)
- [x] Phone number required when an admin adds or edits a teammate
- [x] Every form shows who submitted it: name and phone, from their account ("Marketing person" on the form, and a "Submitted by" part under the history)
- [x] Marketing users see only their own forms (calendar, lists, details, status updates), enforced by the API; admins see all, with the submitter's name in the day list and the lists
- [x] Implementation steps: a checklist with a progress bar, ticked off over several visits; the badge shows "Implementation · 2/4" and each history entry keeps the progress
- [x] API contract (v3.0.0) and Postman tests updated; checked in Edge on desktop and phone

### Version 7 (27 Oct 2026)
- [x] **Demo** status before Ongoing (teal), everywhere
- [x] A visit is today or later: the date pickers start at today, the API refuses a changed visit date in the past (a record keeps an old date)
- [x] Calendar: past days greyed; their visits can be opened and updated, but no "New … form" for them; the top buttons use today when a past day is picked
- [x] "12 onboardings" beside the month name → **year overview** dialog: every month with its counts, other years with ‹ ›, click a month to open it (`GET /calendar/months`)
- [x] Photos removed everywhere (27 Oct 2026): the team decided the forms don't need them
- [x] Lists: an **Assigned to** column (avatars + names); outside assignees get a **name** that is saved and shown everywhere
- [x] Details: **Submitted by** and **Assigned to** right under the name, with the **Assign** button beside the badges; the Status card keeps the update box and the history
- [x] API: a short database drop no longer turns into 503s (the driver reconnects, queries wait); on Vercel a cold start waits at most 8 s for the database
- [x] 90 Postman tests (481 checks) passing; API contract updated and linted

### Version 6 (23 Oct 2026)
- [x] **Support** status after Implementation (violet): status picker, form, list tabs, calendar, badges, API contract and tests
- [x] **Assigned to** in the Status card; admins **Assign** teammates from a list or any outside email address; people can be added or removed any time; the history records "Assigned to …" / "No longer assigned: …"
- [x] Assigned people see and can update the form (lists, calendar, details), enforced by the API; the lists and the day list say "by Wakil · with Rafi"
- [x] **Email** to each newly assigned person with the whole form and an "Open in the tracker" button, and to everyone assigned whenever the form is edited, over SMTP (`SMTP_*` in `.env`); without settings the API says no email was sent, and the admin sees that after saving
- [x] API on Vercel (`api/index.js`, `vercel.json`); the web app on Vercel with `.env.production`
- [x] 88 Postman tests (470 checks) passing; API contract updated and linted
- [x] Sturdier when the host hiccups (26 Oct 2026): the API keeps reconnecting to MongoDB in production and says so; the web app shows the calm "try again" page for any 5xx from the API instead of "This page didn't load"

### Screen polish (21 Oct 2026)
- [x] Large screens: a hamburger next to the logo folds the sidebar into icons (more room for the page), and opens it again; each browser remembers the choice
- [x] The "← back" link on form pages stays fixed at the top while the page scrolls
- [x] Details labels: "Date and time" (was "Visit") and "Location" (was "Chamber" / "Address"), the same in the lists

### Code and tests
- [x] Simpler folders: `server/src/{models,routes,middleware}` and flat `client/src/components`
- [x] Cleanup (21 Oct 2026): unused UI parts, images, settings and code removed; screen files renamed to `.jsx`; the calendar moved from `/calendar` to `/` as the Dashboard; the extra "New form" button removed
- [x] API contract `openapi.yaml` (passes lint)
- [x] Postman tests: `npm run test:api` uses a throwaway API and database (90 tests, 481 checks as of 27 Oct 2026)
- [x] Production build and lint pass; the full flow was clicked through in a real browser (Edge, desktop + phone), with no errors and no page wider than a phone

---

## ⏭ Next

### For you
- [ ] Add your own phone number (Team → your row → Edit details), so it shows on the forms you submit

### Your decisions (PLAN.md section 8)
- [ ] Pharmacy form fields (send the paper form if there is one)
- [ ] Is a *Dropped* status (talks ended) needed, besides the new *Support*?
- [x] When someone leaves, an admin assigns their forms to someone else (23 Oct 2026)

### Going live
- [x] MongoDB Atlas connected (TLS); admin account created there as a bcrypt hash; the plain admin password removed from `.env` (21 Oct 2026)
- [ ] In Atlas: change the database user's password (it was shared in a screenshot) and give the app its own user with read/write on `pharmaz-tracker` only
- [x] Code on GitHub: [PharmaZ-Tracking-Client](https://github.com/WakilIsrakAbir/PharmaZ-Tracking-Client) (web app) and [PharmaZ-Tracking-Server](https://github.com/WakilIsrakAbir/PharmaZ-Tracking-Server) (API, tests and these docs) (21 Oct 2026)
- [x] The API and the web app deployed on Vercel (23 Oct 2026)
- [ ] Email: add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (and `APP_URL`) to the API's Vercel project, then redeploy
- [ ] Change the admin password; add the real team

### Nice to have
- [ ] Print / PDF view in the paper-form layout
- [ ] Counts per status on the dashboard
- [ ] Reminders the day before a visit (by email, now that email exists)
- [ ] Export to Excel
