# PharmaZ247 Tracker — Tasks

What's done and what's next. See [PLAN.md](PLAN.md) for how it works. A box is ticked only when the task is built **and** tested.

**Status (21 Oct 2026):** sign-in, team accounts, the doctor and pharmacy forms, the dashboard (calendar + details panel at `/`), and the lists all work and are tested. Version 5 added "Submitted by", own-forms-only for marketing users, and implementation steps. **Next:** your decisions in PLAN.md section 8, then going live.

---

## ✅ Done

### Accounts
- [x] Admin account created from `.env` (`npm run seed:admin`); no public sign-up
- [x] Sign in / out; 5 failed tries per 15 minutes; 7-day sessions in an httpOnly cookie
- [x] First sign-in: choose your own password (any password is allowed: no length, letter or number rules)
- [x] Team page (admin): add a teammate (temporary password shown once, "Copy message" for WhatsApp), edit, change role, reset password, deactivate / reactivate
- [x] Account page: your details, change password

### Forms (filled in by the marketing team)
- [x] Doctor form: paper fields 1–15 in the same order and numbering, with a photo
- [x] Pharmacy form: 13 draft fields, with a photo
- [x] Visit date + time and status (Ongoing / Setup / Implementation) on every form, plus notes
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
- [x] Marketing users see only their own forms (calendar, lists, details, status updates, photos), enforced by the API; admins see all, with the submitter's name in the day list and the lists
- [x] Implementation steps: a checklist with a progress bar, ticked off over several visits; the badge shows "Implementation · 2/4" and each history entry keeps the progress
- [x] API contract (v3.0.0) and Postman tests updated; checked in Edge on desktop and phone

### Code and tests
- [x] Simpler folders: `server/src/{models,routes,middleware}` and flat `client/src/components`
- [x] Cleanup (21 Oct 2026): unused UI parts, images, settings and code removed; screen files renamed to `.jsx`; the calendar moved from `/calendar` to `/` as the Dashboard; the extra "New form" button removed
- [x] API contract `openapi.yaml` (passes lint)
- [x] 74 Postman tests (399 checks) passing: `npm run test:api` uses a throwaway API and database
- [x] Production build and lint pass; the full flow was clicked through in a real browser (Edge, desktop + phone), with no errors and no page wider than a phone

---

## ⏭ Next

### For you
- [ ] Add your own phone number (Team → your row → Edit details), so it shows on the forms you submit

### Your decisions (PLAN.md section 8)
- [ ] Pharmacy form fields (send the paper form if there is one)
- [ ] Status order, and whether a final status (Live / Dropped) is needed
- [ ] When someone leaves, can an admin move their forms to another marketer?

### Going live
- [x] MongoDB Atlas connected (TLS); admin account created there as a bcrypt hash; the plain admin password removed from `.env` (21 Oct 2026)
- [ ] In Atlas: change the database user's password (it was shared in a screenshot) and give the app its own user with read/write on `pharmaz-tracker` only
- [x] Code on GitHub: [PharmaZ-Tracking-Client](https://github.com/WakilIsrakAbir/PharmaZ-Tracking-Client) (web app) and [PharmaZ-Tracking-Server](https://github.com/WakilIsrakAbir/PharmaZ-Tracking-Server) (API, tests and these docs) (21 Oct 2026)
- [ ] Cloudinary for photos
- [ ] Deploy the web app (Vercel) and the API (Render or Railway); set the env vars
- [ ] Change the admin password; add the real team

### Nice to have
- [ ] Print / PDF view in the paper-form layout
- [ ] Counts per status on the dashboard
- [ ] Reminders the day before a visit
- [ ] Export to Excel
