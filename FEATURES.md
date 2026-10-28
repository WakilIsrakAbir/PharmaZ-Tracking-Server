# PharmaZ247 Tracker — Feature Overview

*Prepared on 28 October 2026 · Version 8*

---

## 1. Purpose

The PharmaZ247 Tracker is where the marketing team records every doctor and pharmacy onboarding, and where the admin plans who goes where.

Three things it is built for:

1. **Entering onboardings.** Admins and marketing people fill in the doctor or pharmacy onboarding form (the same fields as the paper form), with the visit date and time.
2. **Seeing the whole picture.** The admin sees every onboarding in the company on one calendar: what is coming up on which day, what stage each one is at, and who is handling it.
3. **Sending the right person.** Only the admin assigns people to an onboarding. The assigned person is told by email, with the full form, and sees the visit on their own calendar.

Everything else in the tracker supports these three: the status of each onboarding, the step-by-step checklist for going live, the history of every change, and the team's accounts.

**Works on:** any phone, tablet or computer with a browser. Nothing to install.

---

## 2. Who uses it

| Role | What they do |
|---|---|
| **Admin** | Sees every onboarding in the company; assigns who goes to each one; adds and manages the team's accounts; can delete a form. Can also enter and update onboardings like anyone else |
| **Marketing person** | Enters onboardings (doctor and pharmacy forms), updates them after each visit, and sees the ones they entered or were assigned to |

Only an admin can create accounts. There is no public sign-up, so nobody outside the company can get in.

---

## 3. How it works, day to day

1. **An onboarding is entered.** The admin or a marketing person opens the **Dashboard**, taps **New doctor form** or **New pharmacy form**, fills in the form, sets the visit date and time, and submits. It appears on the calendar at once.
2. **The admin sees it on the calendar** along with every other onboarding, colour-coded by status: what is planned for tomorrow, next week, next month.
3. **The admin assigns who will go.** From the onboarding's details, the admin picks one or more people with the **Assign** button. Each of them receives an email with the whole form (address with map link, phone, fees, notes…) and from then on sees the visit on their own calendar.
4. **After the visit**, the assigned person opens the onboarding, moves the status forward (for example *Setup → Implementation*), ticks off the steps done, adds a note and saves.
5. **If the form is edited**, everyone assigned gets the updated version by email automatically.
6. **At any time**, the admin can open the history of an onboarding to see who did what, and when, and can change who is assigned.

---

## 4. The calendar (Dashboard, the home page)

The admin's main view, and everyone's starting point.

- **Month calendar** with every onboarding on its visit day. A small icon shows doctor or pharmacy; the colour shows the status (section 6).
- **Today** is highlighted; the week starts on Saturday and Friday is shaded, as in Bangladesh.
- **Filter:** All · Doctors · Pharmacies.
- **Click a day** → that day's onboardings appear on the right, with name, place, status, who entered it and who is assigned.
- **Click an onboarding** → its full details open on the right (section 5).
- **New doctor form / New pharmacy form** at the top open a blank form for the chosen day. These buttons stay in view while scrolling.
- **Past days are greyed out.** What happened on them can still be opened and updated, but nothing new can be planned there: a visit is always today or a later day.
- **The count beside the month name** ("12 onboardings") opens a **year overview**: all twelve months with their numbers (doctors and pharmacies), with arrows to other years. Clicking a month opens it on the calendar.
- On a laptop the whole month fits the screen and stays put; only the details on the right scroll. On a phone the details appear under the calendar.
- A busy day shows the first onboarding and "+2 more"; one click lists them all.
- A link to a specific day or onboarding can be copied from the address bar and shared with a colleague.

---

## 5. One onboarding, in detail

Opens beside the calendar, or as a full page from the Doctors / Pharmacies lists.

**Details** (read only)
- Name, type and status; BMDC number (doctor) or owner's name (pharmacy).
- Right under the name: **Submitted by** (who entered it, with phone and date) and **Assigned to** (who the admin sent). Admins have the **Assign** button here, beside the name.
- Date and time of the visit.
- Location, with a one-tap **Open in Google Maps** link.
- Phone, with **Call** and **WhatsApp** buttons; email.
- Notes, in a highlighted green box.

**Status** (the part that changes over time)
- **Update after each visit:** the new status, the next visit's date and time, a note → *Save update*.
- **Implementation steps:** a checklist for onboardings that take several visits (for example "Train the chamber assistant"). Steps are ticked off one by one; the badge shows progress such as *Implementation · 2/4*.
- **History:** every change, newest first: the status, the visit date, the note, and who made the change and when. The latest two show by default; *See more* unfolds the rest.
- **Edit form**, to change any field. The full page also lists every numbered field exactly as on the paper form.

---

## 6. The five statuses

Every onboarding is in exactly one status. The colour follows it everywhere.

| Status | Colour | Meaning |
|---|---|---|
| **Demo** | Teal | The first visit: showing PharmaZ247. Every new form starts here |
| **Ongoing** | Blue | Talks have started; the form is being filled in |
| **Setup** | Amber | Profile, slots and fees are being set up in PharmaZ247 |
| **Implementation** | Green | Going live: training, first bookings, tracked step by step |
| **Support** | Violet | Live; the team now visits to support them |

Every status change is written to the onboarding's history, with who made it and when.

---

## 7. Assigning: who goes

This is the admin's tool for planning the team's visits.

- Only an admin can assign. The **Assign** button opens a list of teammates to tick, plus a place to add **anyone outside the team** by name and email address (a partner, a senior colleague). The name is saved and shown wherever the assigned people are listed.
- A **teammate** who is assigned sees the onboarding on their own calendar and in their lists, and can update it after the visit.
- An **outside email address** gets no access to the tracker; that person only receives the emails.
- Assignments can be changed at any time: add someone, remove someone, or hand an onboarding over when a person leaves. The history records "Assigned to …" and "No longer assigned: …".
- **What the assigned person receives by email:** the whole form (every field, the status, the visit date and time, the address with a map link, the phone, the notes, the steps), who entered it, who assigned them, and an *Open in the tracker* button. Replies go straight to the admin.
- **When the form is edited**, everyone assigned receives the new version by email, so nobody travels with old information.
- **Clear feedback after Save.** A green message says who is assigned now and who was emailed. A **red message with the reason** appears when something didn't go through: an outside address that isn't an email address (nothing is saved), the server refusing the save, email not being set up on the server, or the mail server refusing to send to someone (that person stays assigned). An outside person typed in but not yet added with the **Add** button is added on Save, so they are never quietly left out.
- *"Sent" means the mail server took the email.* Whether it lands in the inbox or in spam is decided afterwards by the recipient's mail service (for example Microsoft 365 at a company domain), which the tracker can't see.

---

## 8. The forms

- **Doctor form:** the 15 numbered fields of the paper form, in the same order: name, BMDC number, phone, email, chamber name and address, consultation type, chamber number, slot duration, available days and hours, and the four fees.
- **Pharmacy form:** 13 fields: name, owner, phone, email, drug and trade licence numbers, address, area, district, opening days and hours, home delivery, payment methods (Cash, bKash, Nagad, Card).
- Under the fields: the **visit date and time** (this puts it on the calendar; today or later, past days can't be chosen), the **status**, and **notes**.
- Required fields are marked with *; a clear message appears under any field that needs fixing.
- The form shows the **name and phone of the person entering it**, taken from their account, so nothing extra has to be typed.

---

## 9. Lists, Team and Account

**Doctors / Pharmacies lists**
- Every onboarding of that type, **twenty to a page** (10, 20 or 50 can be chosen). At the bottom of the screen, always: "Showing 21–40 of 134" and the page numbers (the bar stays at the bottom while a long list scrolls). While the next page loads, the rows on screen fade a little instead of disappearing, so the list never jumps.
- **Status tabs** (with counts) and a **search box** (name, phone, BMDC number, chamber, owner, area).
- **Filters** under the tabs: *Assigned to* (anyone, no one yet, me, or a teammate), *Submitted by* (admins only), *Visit date* (any time, today, upcoming, past) and the **order** (newest visit, oldest visit, name, last updated). A filter that is narrowing the list is tinted, and *Clear* resets them all. The counts on the tabs follow the filters.
- The tabs, filters and page are part of the page's address, so a refresh, the back button or a shared link opens the very same view.
- Each row shows the person, the location (with who entered it), an **Assigned to** column with the assigned people, the date and time, and the status.

**Team** (admins only)
- Everyone who can sign in, with role, phone, status and last sign-in; *Active* and *Deactivated* tabs; search (name, email, phone); a **role** filter and the order (name, last sign-in, newest); twenty to a page, like the lists.
- **Add a teammate** (name, email, phone, role): the tracker creates a temporary password and a ready-made WhatsApp message to send them.
- **Edit** details, **change role**, **reset password**, **deactivate** (signed out at once; their onboardings stay and can be reassigned) or **reactivate**.

**Your account**
- Your details, and a place to change your password (this signs out your other devices).

---

## 10. Who sees what

| | Marketing person | Admin |
|---|---|---|
| Onboardings they entered | ✓ | ✓ |
| Onboardings assigned to them | ✓ | ✓ |
| Everyone else's onboardings | ✗ (hidden completely) | ✓ |
| Assign who goes | ✗ | ✓ |
| Add / manage teammates | ✗ | ✓ |
| Delete an onboarding | ✗ | ✓ |

An onboarding a person may not see simply does not exist for them: not on their calendar, not in their lists, and not reachable by a link.

---

## 11. Security and data

- Everything needs a sign-in; nothing is public. Sessions last 7 days.
- A new teammate gets a temporary password from the admin and chooses their own at first sign-in. After 5 wrong passwords in 15 minutes, sign-in is paused for that email.
- Passwords are never stored as text, only in a scrambled form that cannot be reversed.
- All traffic between the browser and the tracker is encrypted (https).
- The data lives in a managed cloud database (MongoDB Atlas) over encrypted connections.
- Deleting an onboarding (admins only) removes it and its history for everyone.

---

## 12. Where it runs

- The web app and its server run on Vercel, a cloud hosting service, and update automatically whenever a new version is released. Nothing to maintain in the office.
- If the database is unreachable for a moment, the app shows a calm "trying again" message and recovers by itself.

---

## 13. Possible next steps

Ideas discussed but not built yet, for the team to decide on:

- A **Dropped** status for talks that ended.
- **Reminder emails** the day before a visit, to the assigned people.
- **Export to Excel**, and a **print / PDF view** in the paper-form layout.
- **Counts per status** on the dashboard.
- Bangla labels.

---

## Glossary

| Word | Meaning here |
|---|---|
| **Onboarding / form** | One doctor or pharmacy being brought on board, entered as a form |
| **Visit** | The date and time on the form; what the calendar shows |
| **Status** | Where the onboarding stands: Demo, Ongoing, Setup, Implementation or Support |
| **Steps** | The checklist used during Implementation |
| **Assigned to** | The people the admin sent for this onboarding |
| **Submitted by** | The person who entered the form |
| **History** | The list of every change made to an onboarding |
