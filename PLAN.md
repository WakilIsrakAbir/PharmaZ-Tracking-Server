# PharmaZ247 Tracker — How it works

> An internal web app for the PharmaZ247 marketing team: fill in a doctor or pharmacy onboarding form after each visit, see every visit on one calendar, and know where each one stands.

**Version:** 5 · 21 Oct 2026 · **Owner:** Wakil Israk Abir · Progress: [TASKS.md](TASKS.md) · API setup and commands: [README.md](README.md) · Web app: [PharmaZ-Tracking-Client](https://github.com/WakilIsrakAbir/PharmaZ-Tracking-Client)

---

## 1. What it does

1. **A marketing team member fills in a form.** The doctor form has the same 15 numbered fields as the paper "Doctor Onboarding Form". The pharmacy form is a 13-field draft. Each form also gets a **visit date and time** and a **status**: *Demo → Ongoing → Setup → Implementation → Support*. The marketing team plans visits for today or a later day; an admin can also enter a visit that already happened. The form is saved under the person's **name and phone number** from their account, so there is nothing extra to type.
2. **The form appears on the calendar** on its visit date. The home page, the **Dashboard** (`/`), is the month calendar on the left and a details panel on the right. Its **New doctor form** and **New pharmacy form** buttons open a new form for the picked day (for the marketing team, today when a past day is picked: past days are greyed and only show what happened; an admin can add an onboarding on a past day too). The count beside the month name opens a **year overview**: every month with its number of onboardings, and a click opens that month.
3. **Click a visit** and the details open beside the calendar, in two sections:
   - **Details** (read only): the person or pharmacy with, right under the name, **who submitted it** and **who is assigned** (admins have the **Assign** button there), then the place (with Google Maps), the phone (Call / WhatsApp) and the notes;
   - **Status** (the part you can change, framed in blue so it stands out): a new status, the next visit date, a note and the implementation steps, then **Save update**. **Edit form** sits on the right of the Status title. Below it, the history of every change (who made it and when).
   - All the numbered form fields are on the form's full page (`/doctors/:id`) and in **Edit form**.
4. **Lists:** all doctors and all pharmacies, a page at a time, with status tabs, search and filters (assigned to, submitted by, visit date, order), each opening a full page. The Team page works the same way.
5. **Who sees what:** a marketing person sees the forms they submitted and the forms assigned to them: on the calendar, in the lists and in the details. Admins see every form, with the name of the person who submitted it and who is assigned.
7. **Assigning:** an admin assigns people to a form by email address (**Assign** in the Status card): teammates from a list, or anyone outside the team by name and email address (the name is saved and shown). A teammate then sees the form; an outside address only gets the emails. Each newly assigned person gets an **email with the whole form** (every numbered field, the status, the visit, the address with a map link, the notes, the steps, who submitted it, and a link to open it in the tracker). The history records "Assigned to …" / "No longer assigned: …". Whenever the form is **edited**, everyone assigned gets the new version by email. People can be added or removed at any time. This is also how a form moves to someone else when a person leaves.
6. **Accounts:** only the admin creates accounts (Team page), with a name, email and phone number (all three required), as an admin, a marketing person or a support person. There is no sign-up. New people get a temporary password and choose their own at first sign-in.
8. **Support calls:** the support team's own side (`/support-calls`): a support person logs the calls that come in from doctors and pharmacies that are already live (who called, name, phone, the problem, when; *Open* until solved, then *Resolved*) and sees only the calls they logged, in a log with tabs, search, filters and pages. Admins see every call, with who logged it. Support people see nothing of the onboarding side, and marketing people nothing of the calls. See section 9.

## 2. Pages

| URL | What | Who |
|---|---|---|
| `/login` | Sign in (and choose a password at first sign-in) | everyone |
| `/` | **Dashboard (home):** month calendar + details panel | signed in |
| `/?month=2026-10&day=2026-10-21&type=doctor&id=…` | The same, with a day or visit open. The link can be shared | signed in |
| `/doctors` · `/pharmacies` | Lists, a page at a time, with status tabs, search and filters (`?status=setup&assigned=…&when=month&sort=name&page=2`) | signed in |
| `/doctors/new` · `/pharmacies/new` | The forms, opened from the dashboard (`?date=2026-10-21` pre-fills the visit date) | signed in |
| `/doctors/:id` · `/pharmacies/:id` | Full page for one form | signed in |
| `/doctors/:id/edit` · `/pharmacies/:id/edit` | Edit a submitted form | signed in |
| `/support-calls` | **Call log:** the support team's calls, a page at a time, with Open / Resolved tabs, search and filters (`?status=open&type=doctor&when=week&page=2`) | admin, support |
| `/support-calls/new` | **Log a call** | admin, support |
| `/support-calls/:id` · `/support-calls/:id/edit` | One call (resolve, reopen, edit, delete) / edit it | admin, support (own calls) |
| `/team` | Add teammates, change roles, reset passwords, deactivate | admin |
| `/account` | Your details, change password | signed in |

"Signed in" above means admins and marketing people: the support team only has the call log and the account page, and is sent to the call log from anywhere else (marketing people are sent to the dashboard from the call log).

## 3. The forms

**Doctor Onboarding Form** (the numbers match the paper form):

1 Full Name · (2 Doctor Picture: not kept) · 3 BMDC Reg. No. · 4 Phone No · 5 Email · 6 Chamber Name · 7 Chamber Address · 8 Consultation Type (In-Person / Teleconsultation) · 9 Chamber No. · 10 Slot Duration · 11 Available Days & Time · 12 First Visit · 13 Report View · 14 2nd Visit (within 1 mo.) · 15 After 1 mo.

**Pharmacy Onboarding Form** (draft — please send the real fields if they differ):

1 Pharmacy Name · (2 Shop Photo: not kept) · 3 Owner Name · 4 Phone No · 5 Email · 6 Drug License No. · 7 Trade License No. · 8 Address · 9 Area / Thana · 10 District · 11 Opening Days & Time · 12 Home Delivery · 13 Payment Methods (Cash, bKash, Nagad, Card)

**Both forms also have:** Visit date and time · Status · Notes. Who submitted the form (name and phone) is taken from the signed-in account.

**Required:** name, phone, address and visit date. Everything else can be filled in later with **Edit form**.

To add or change a field, edit three places: the model in this repo (`src/models/Doctor.js` or `Pharmacy.js`), and in the web app the label (`src/lib/constants.js`, `FIELDS`) and the form (`src/components/RecordForm.jsx`).

## 4. Status

| Status | Meaning | Color |
|---|---|---|
| **Demo** | The first visit, showing PharmaZ247 | Teal |
| **Ongoing** | Talks have started | Blue |
| **Setup** | Profile and slots being set up | Amber |
| **Implementation** | Going live in PharmaZ247 | Green |
| **Support** | Live; the team now visits to support them | Violet |

Every status change (from the details panel, or by editing the form) adds an entry to the record's **history**: the status, the visit date, an optional note, who made the change and when.

**Implementation in steps.** Going live can take several visits. While a form is in *Implementation*, the status box shows a checklist:
- add the steps (for example "Train the chamber assistant"), tick each one off when it's done, then **Save update**;
- a ticked step remembers the day it was done;
- the status badge shows the progress, for example *Implementation · 2/4*, in the details, the day list and the lists;
- each history entry remembers how many steps were done at that moment ("2 of 4 steps done").

## 5. API (base `/api/v1`)

The full contract, with examples, is in [openapi.yaml](openapi.yaml).

| Method | Path | Who | What |
|---|---|---|---|
| GET | `/health` | everyone | `{ ok: true }` |
| POST | `/auth/login` · `/auth/logout` | everyone | Sign in (sets an httpOnly cookie) / sign out |
| GET | `/auth/me` | signed in | Who is signed in |
| PATCH | `/auth/password` | signed in | Change your password |
| GET · POST | `/users` | admin | List, a page at a time (`?search=&role=&active=&sort=&page=&limit=`, with active / deactivated counts) / add teammates: name, email and phone are required (returns a temporary password once) |
| PATCH | `/users/:id` | admin | Edit name, phone or role; deactivate or reactivate |
| POST | `/users/:id/reset-password` | admin | New temporary password |
| GET · POST | `/doctors` | signed in | List, a page at a time (`?search=&status=&assignee=&createdBy=&from=&to=&sort=&page=&limit=`, with counts per status) / submit a form |
| GET · PUT | `/doctors/:id` | signed in | One form / save an edited form (everyone assigned is emailed the new version) |
| PATCH | `/doctors/:id/status` | signed in | New status (+ date, note and implementation steps) → history |
| PUT | `/doctors/:id/assignees` | admin | Who is assigned, by email (teammates or outside addresses) → history; newly assigned people are emailed the form |
| DELETE | `/doctors/:id` | admin | Delete the form and its history |
| … | `/pharmacies/…` | | The same endpoints, for pharmacies |
| GET | `/calendar?from=&to=` | signed in | Every doctor and pharmacy visit in a date range (at most 62 days) |
| GET | `/calendar/months?year=` | signed in | How many visits each month of a year has (for the year overview) |
| GET · POST | `/support-calls` | admin, support | The call log, a page at a time (`?search=&status=&type=&createdBy=&from=&to=&sort=&page=&limit=`, with open / resolved counts) / log a call |
| GET · PUT | `/support-calls/:id` | admin, support (own) | One call / save the edited call |
| PATCH | `/support-calls/:id/status` | admin, support (own) | Open ↔ Resolved |
| DELETE | `/support-calls/:id` | admin, support (own) | Delete the call |

"Signed in" above means admins and marketing people: `/doctors`, `/pharmacies` and `/calendar` answer `403` for the support team, and `/support-calls` answers `403` for marketing people (`requireRole` in `middleware/auth.js`, wired in `app.js`).

**Who sees what:** for a marketing user, the lists, the calendar, single forms and status updates only include the forms they submitted or were assigned to. Anyone else's form answers `404`, as if it didn't exist. Admins see everything. Every form includes `createdBy` (the name and phone number of the person who submitted it) and `assignedTo` (the assigned teammates). The call log works the same way for a support person: only the calls they logged, anyone else's answers `404`.

**Email:** over SMTP (Gmail, Google Workspace or Brevo; the `SMTP_*` settings in `.env` decide). Without those settings the API sends nothing and says so in its answer (`meta.email.configured: false`), so everything else keeps working.

Forms are sent as JSON. Errors always look like `{ error: { code, message, fields } }`, and the messages are written to be shown to people as they are.

## 6. Sign-in and security

- **Admin account:** created once by `npm run seed:admin` from `.env`. The password is stored only as a bcrypt hash and never appears in code or git. ⚠️ Change it after the first sign-in.
- **Session:** a signed token in an httpOnly cookie (scripts in the page can't read it), valid for 7 days. A password change, reset or deactivation ends old sessions straight away.
- **Sign-in limit:** 5 failed tries per email every 15 minutes.
- **Passwords:** any password is allowed, even a short one. It just can't be empty (and 72 characters is the most). A new password must be different from the current one, so the temporary password from the admin always gets replaced.
- **Checks:** every request is checked by the API, not just the screens. Marketing users can't open `/team`, support users can't open the onboarding pages, and the API refuses those requests too (`403`).
- **Own forms only:** marketing users can only see and change the forms they submitted or were assigned to; support users only the calls they logged. The API applies this to every request, so it can't be worked around from the browser.
- **Personal data:** phones, emails and BMDC numbers need a sign-in. Nothing is public.

## 7. Built with

- **Web:** Next.js 16.4 (App Router, JavaScript), Tailwind CSS v4, shadcn/ui, TanStack Query, react-hook-form, date-fns.
- **API:** Node.js 24, Express 5, Mongoose 9, zod, nodemailer.
- **Tests:** Postman CLI.
- **Times:** all times are shown in Dhaka time, and the week starts on Saturday.

**Next.js 16 rules this code follows:**
- `src/proxy.js` replaces middleware.
- Reading the cookie or the current time happens inside `<Suspense>` (or after `io()`).
- Pages check who is signed in themselves (`components/Protected.jsx`), because layouts don't re-render.
- Files that contain JSX (screens and components) end in `.jsx`; plain JavaScript (`lib/`, `proxy.js`) ends in `.js`.
- Visited pages stay alive in the background, so forms are cleared after submit and sign-out reloads the page.

## 8. Still to decide

1. **Pharmacy form fields.** Please share the paper pharmacy form, if there is one.
2. **Status:** *Support* was added after *Implementation* (23 Oct 2026). Is a *Dropped* status (talks ended) needed too?
3. ~~When someone leaves~~: solved by assigning (23 Oct 2026): an admin assigns the form to someone else.

## 9. Support calls (decided and built 28 Oct 2026)

A second job for the tracker, beside onboarding: the **support team** logs the calls that come in from doctors and pharmacies that are already live. Decided with the team on 28 Oct 2026, and built the same day as described here:

| Decision | Choice |
|---|---|
| Status on a call | Yes: **Open** / **Resolved** |
| Who called | Free text: a *Doctor* / *Pharmacy* choice and the name (no link to an onboarding record) |
| Description | Optional |
| Marketing team | No access to support calls |
| Deleting a call | A support person may delete their own calls; an admin any |
| Doctors and pharmacies | Both, with one form that fits either |

**Role.** A third role, **support**, next to admin and marketing. Admins create support members on the Team page exactly like marketers (temporary password, own password at first sign-in). A support person has two menu items, **Log a call** and **Call log**, plus their Account page; nothing else (the dashboard, Doctors, Pharmacies and Team answer with a redirect to the call log, and the API with `403`). Signing in lands them on the call log.

**Who sees what.** A support person sees, edits and deletes only the calls they logged (another person's call answers `404`, like the forms). An admin sees every call, with who logged it, and can do everything. Marketing people get `403` on `/support-calls`; support people get `403` on `/doctors`, `/pharmacies`, `/calendar` and `/users`.

**A call** (`SupportCall`, collection `supportcalls`):

| Field | What |
|---|---|
| `callerType` | `doctor` or `pharmacy` (required) |
| `callerName`, `phone` | required; the phone is normalised to +880… like everywhere else |
| `problemTitle` | required, up to 120 characters |
| `description` | optional, up to 2000 characters |
| `status` | `open` (the default) or `resolved`; `resolvedAt` is set when it becomes resolved |
| `calledAt` | when the call came in; now unless the form says otherwise, never in the future |
| `createdBy` | the support person (name and phone from their account), `createdAt` / `updatedAt` |

**API** (`src/models/SupportCall.js`, `src/routes/supportCalls.js`, under `/api/v1/support-calls`):

| Method | Path | Who | What |
|---|---|---|---|
| GET | `/support-calls` | support (own), admin (all) | One page of the log: `?search=` (name, title, phone digits), `status`, `type`, `createdBy` (admin), `from` / `to` (the call's Dhaka day), `sort` (`called_desc` default, `called_asc`, `name`, `updated`), `page`, `limit`; `meta.counts` = `{ all, open, resolved }` |
| POST | `/support-calls` | support, admin | Log a call |
| GET · PUT | `/support-calls/:id` | own / admin | One call / save the edited call |
| PATCH | `/support-calls/:id/status` | own / admin | Open ↔ Resolved |
| DELETE | `/support-calls/:id` | own / admin | Delete the call |

**Screens** (their own folder, `client/src/components/support-calls/`):

| Route | Screen | File |
|---|---|---|
| `/support-calls` | **Call log:** Caller (icon for doctor / pharmacy) · Problem · Logged by (admins) · Called · Status; Open / Resolved / All tabs with counts; search; filters (Doctors / Pharmacies, Logged by for admins, date); the same paging, sorting and address-bar view as the other lists | `CallLog.jsx` |
| `/support-calls/new` | **Log a call:** Doctor / Pharmacy, name, phone, problem title, description, called at (now), status (Open); "Logged by" from the account | `CallForm.jsx` |
| `/support-calls/:id` | **One call:** every field, Resolved / Reopen, Edit, Delete | `CallDetails.jsx` |
| `/support-calls/:id/edit` | The same form, filled in | `CallForm.jsx` |

Shared pieces reused as they are: `PageHeader`, `Pagination`, `Select`, `useUrlParams`, `Avatar`, `ConfirmDialog`, the phone and date helpers. What changes elsewhere: the role list (`utils.js`, `constants.js`, the contract), the sidebar (menu per role), `Protected` (which roles may open a page), the sign-in landing page, the Team page's role choice and badge, and the API's role checks.

**Tests and docs.** A Postman folder *Support calls*: the admin adds a support member → they sign in and choose a password → log a call → see it in their log → can't list doctors (`403`) → can't open another person's call (`404`) → edit, resolve and delete their own → the admin sees every call with who logged it → a marketer gets `403` → clean up. The contract gets a *Support calls* tag; FEATURES, TASKS and this file get a section.

**What changed elsewhere.** The role list and `requireRole` (API), the sidebar menu per role, `Protected` with the roles that may open a page (`ONBOARDING_ROLES`, `SUPPORT_ROLES` in `lib/constants.js`), the page after sign-in (`homePage`), the Team page's role choice ("Change role" now offers the other two roles), and the API's role checks. Nothing changed for marketers, and admins only gained the call log in their menu.

## 10. Next steps

- **Going live:** done on Vercel (23 Oct 2026): the API at pharma-z-tracking-server.vercel.app, the web app deployed from the client repository. See the README, "Going live on Vercel".
- **Email:** set the `SMTP_*` settings on the API's Vercel project so assignment emails go out (see the README).
- **Nice to have:**
  - a print / PDF view in the paper-form layout;
  - counts per status on the dashboard;
  - reminders the day before a visit;
  - export to Excel;
  - Bangla labels.
