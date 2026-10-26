# PharmaZ247 Tracker — Feature Overview

*Prepared on 26 October 2026 · Version 6 · Live at the PharmaZ247 Tracker web address*

---

## 1. What it is

The PharmaZ247 Tracker is the marketing team's own web app for bringing doctors and pharmacies on board. A team member visits a doctor or a pharmacy, fills in the onboarding form on their phone or laptop, and from that moment the whole team can see the visit on a shared calendar, follow its progress, and know who is handling it.

It replaces paper forms, scattered WhatsApp messages and "who went where?" phone calls with one place that always has the current picture.

**Works on:** any phone, tablet or computer with a browser. Nothing to install.

---

## 2. Who uses it

| Role | What they do |
|---|---|
| **Marketing person** | Fills in doctor and pharmacy forms, updates the status after each visit, sees their own forms and the ones assigned to them |
| **Admin** | Everything above, plus: sees every form in the company, manages the team's accounts, assigns people to forms, deletes forms |

Only an admin can create accounts. There is no public sign-up, so nobody outside the company can get in.

---

## 3. A typical day

1. The marketing person opens the **Dashboard** and sees today's visits on the calendar.
2. After visiting a doctor, they tap **New doctor form**, fill in the form (same fields as the paper form, with a photo) and submit. It appears on the calendar at once.
3. On the next visit they open the form from the calendar, move its status forward (for example from *Setup* to *Implementation*), tick off the steps done, add a note and save.
4. An admin assigns a colleague to help with that doctor. The colleague gets an email with the whole form and now sees it on their own calendar too.
5. Everyone can look at the form's **history** to see who did what, and when.

---

## 4. Features, screen by screen

### 4.1 Sign in
- Each person signs in with their email and password.
- A new teammate gets a temporary password from the admin and chooses their own the first time they sign in.
- Sessions last 7 days; after that the person signs in again.
- After 5 wrong passwords in 15 minutes, sign-in is paused for that email, to stop guessing.

### 4.2 Dashboard (the home page)
- **Month calendar** on the left, with every visit shown on its day. Doctors and pharmacies have their own small icons; the colour shows the status (see section 5).
- **Today** is highlighted; the week starts on Saturday and Friday is shaded, as in Bangladesh.
- **Filter:** All · Doctors · Pharmacies.
- **Click a day** → the visits of that day appear on the right, with the person's name, place and status.
- **Click a visit** → its full details open on the right (section 4.4).
- **New doctor form / New pharmacy form** buttons at the top open a blank form for the chosen day. The buttons and the greeting stay fixed at the top while the page scrolls.
- On a laptop the calendar is sized to fit the screen and stays in place; only the details on the right scroll. On a phone the details appear under the calendar.
- A busy day shows the first visit and "+2 more"; clicking it lists them all.
- The address bar remembers what is open, so a link to a specific day or visit can be shared with a colleague.

### 4.3 The onboarding forms
- **Doctor form:** the 15 numbered fields of the paper form, in the same order — name, photo, BMDC number, phone, email, chamber name and address, consultation type, chamber number, slot duration, available days and hours, and the four fees.
- **Pharmacy form:** 13 fields — name, shop photo, owner, phone, email, drug and trade licence numbers, address, area, district, opening days and hours, home delivery, payment methods (Cash, bKash, Nagad, Card).
- Under the fields: **visit date and time** (this puts the form on the calendar), the **status**, and **notes**.
- Required fields are marked with *; a clear message appears under any field that needs fixing.
- Photos can be taken with the phone camera on the spot. They are stored safely and shrunk automatically.
- The form shows the **marketing person's name and phone** at the top, taken from their account, so nothing extra has to be typed.
- A submitted form can be **edited** later. Everyone assigned to it is emailed the new version.

### 4.4 The details panel
Opens beside the calendar (or as a full page from the lists). Two parts:

**Details** (read only)
- Name, type and status; BMDC number or owner's name.
- Date and time of the visit.
- Location, with a one-tap **Open in Google Maps** link.
- Phone, with **Call** and **WhatsApp** buttons.
- Email, and the notes in a highlighted green box.

**Status** (the part you change)
- **Update after each visit:** choose the new status, set the next visit's date and time, add a note, and press *Save update*.
- **Implementation steps:** a checklist for onboardings that take several visits (for example "Train the chamber assistant"). Tick off steps as they are done; the status badge shows progress like *Implementation · 2/4*.
- **Assigned to:** who is working on this form, with an *Assign* button for admins (section 6).
- **History:** every change, newest first — the status, the visit date, the note, and who made the change and when. The two latest entries show by default; *See more* unfolds the rest.
- **Submitted by:** the name and phone number of the person who filled in the form, and the date.
- **Edit form** sits beside the Status title.

The full page also lists every numbered field of the form, exactly as on paper.

### 4.5 Doctors and Pharmacies lists
- All forms of that type, newest visit first.
- **Tabs by status** with counts: All · Ongoing · Setup · Implementation · Support.
- **Search** by name, phone, BMDC number, chamber, owner or area.
- Each row shows the person, the location, the date and time, the status, and who is on it ("by Wakil · with Rafi").
- Clicking a row opens the full page.

### 4.6 Team (admins only)
- See everyone who can sign in, with role, phone, status and last sign-in. Tabs for *Active* and *Deactivated*, and a search box.
- **Add a teammate** with name, email, phone and role. The tracker creates a temporary password and offers a ready-made message to send them on WhatsApp.
- **Edit** a teammate's name or phone, **change their role**, **reset their password**, or **deactivate** them (they are signed out at once; their forms stay and can be assigned to someone else). A deactivated account can be reactivated.

### 4.7 Your account
- Your own details, and a place to change your password. Changing it signs out every other device.

---

## 5. The four statuses

Every form is in exactly one status, and the colour follows it everywhere — calendar, lists, details.

| Status | Colour | Meaning |
|---|---|---|
| **Ongoing** | Blue | Talks have started; the form is being filled in |
| **Setup** | Amber | Profile, slots and fees are being set up in PharmaZ247 |
| **Implementation** | Green | Going live: training, first bookings — tracked step by step |
| **Support** | Violet | Live; the team now visits to support them |

Every status change is written to the form's history, with who made it and when.

---

## 6. Assigning people and emails

- An admin can assign one or more people to a form from the *Assign* button: **teammates** from the list, or **anyone outside the team** by typing their email address (for example a partner or a senior colleague).
- A **teammate** who is assigned sees the form on their calendar and in their lists, and can update it — just like the person who submitted it.
- An **outside email address** does not get access to the tracker; it only receives the emails.
- People can be added or removed at any time; the history records "Assigned to …" and "No longer assigned: …".
- **Emails:** each newly assigned person receives the whole form by email — every field, the status, the visit, the address with a map link, the notes, the steps, who submitted it, and an *Open in the tracker* button. Whenever the form is **edited**, everyone assigned receives the updated version. Replies go to the admin who assigned.

---

## 7. Who sees what

| | Marketing person | Admin |
|---|---|---|
| Forms they submitted | ✓ | ✓ |
| Forms assigned to them | ✓ | ✓ |
| Everyone else's forms | ✗ (hidden completely) | ✓ |
| Add / manage teammates | ✗ | ✓ |
| Assign people to a form | ✗ | ✓ |
| Delete a form | ✗ | ✓ |

A form that a person may not see simply does not exist for them: it is not on their calendar, not in their lists, and cannot be opened by a link.

---

## 8. Security and data

- Everything needs a sign-in; nothing is public.
- Passwords are never stored as text, only in a scrambled form that cannot be reversed.
- All traffic between the browser and the tracker is encrypted (https).
- Doctor and pharmacy photos are private: only people who may see the form can open its photo.
- The data lives in a managed cloud database (MongoDB Atlas) with encrypted connections, and photos are stored inside it, so a backup of the database includes everything.
- Deleting a form (admins only) removes it, its photo and its history for everyone.

---

## 9. Where it runs

- The web app and its server both run on Vercel, a cloud hosting service, and update automatically whenever a new version is released.
- No servers to maintain in the office; the team only needs a browser and an internet connection.
- If the database is unreachable for a moment, the app shows a calm "trying again" message and recovers by itself.

---

## 10. Possible next steps

Ideas discussed but not built yet, for the team to decide on:

- A **Dropped** status for talks that ended.
- **Reminder emails** the day before a visit.
- **Export to Excel**, and a **print / PDF view** in the paper-form layout.
- **Counts per status** on the dashboard.
- Bangla labels.

---

## Glossary

| Word | Meaning here |
|---|---|
| **Form / record** | One filled-in doctor or pharmacy onboarding form |
| **Visit** | The date and time on a form; what the calendar shows |
| **Status** | Where the onboarding stands: Ongoing, Setup, Implementation or Support |
| **Steps** | The checklist used during Implementation |
| **History** | The list of every change made to a form |
| **Assigned to** | The people an admin asked to work on a form |
| **Submitted by** | The marketing person who filled in the form |
