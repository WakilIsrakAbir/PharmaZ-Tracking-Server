import mongoose from 'mongoose';
import { z } from 'zod';

import { STATUSES, STATUS_MESSAGE, dhakaDay, optionalText, visitEndProblem } from '../utils.js';

// What every onboarding record has, doctor or pharmacy: the visit date and status that the
// marketing person sets on the form, notes, who submitted it, who is assigned to it,
// the implementation steps, and a history of every change (shown as a timeline).

// Going live can take several visits, so the implementation is split into steps
// that are ticked off one by one.
const stepSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },   // e.g. "Train the chamber assistant"
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },                  // the day it was ticked off
  },
  { toJSON: { transform: (doc, { _id, ...step }) => ({ id: String(_id), ...step }) } },
);

const historyEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    visitDate: { type: Date, required: true, index: true },   // the calendar also shows the earlier visits (see visitEvents)
    visitEndDate: { type: Date, default: null },              // when that visit ended, if it was given
    note: { type: String, default: '' },
    // How many implementation steps were done at that moment, e.g. { done: 2, total: 4 }.
    steps: { type: new mongoose.Schema({ done: Number, total: Number }, { _id: false }), default: null },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

// One assigned person: a teammate (with their account) or an outside email address with the name
// the admin typed for it (an account's name always comes from the account).
const assigneeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, default: '', trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  },
  { _id: false },
);

export const trackingFields = {
  visitDate: { type: Date, required: true, index: true },        // when the visit happens (it starts)
  visitEndDate: { type: Date, default: null },                   // when it ends: optional, later the same day
  status: { type: String, enum: STATUSES, default: 'demo', index: true },
  notes: { type: String, default: '' },
  implementationSteps: { type: [stepSchema], default: [] },
  history: { type: [historyEntrySchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true }, // who submitted it
  // Who an admin assigned to this record. A teammate (`user` set) sees and can update it, like the
  // submitter; an outside email address only gets the emails.
  assignedTo: { type: [assigneeSchema], default: [] },
};

// What the API sends: `id`, the `type`, and each assignee as
// { id, name, email, phone, teammate } (populate assignedTo.user first; see PEOPLE in routes/records.js).
export const recordOptions = (type) => ({
  timestamps: true,
  toJSON: {
    versionKey: false,
    transform: (doc, { _id, assignedTo = [], ...record }) => ({
      id: String(_id),
      type,
      ...record,
      assignedTo: assignedTo.map(assigneeJson),
    }),
  },
});

// A populated assignee → what the API sends. An outside email has no account, so no id or phone;
// its name is the one given when assigning, or the address itself when none was.
export function assigneeJson({ email, name, user }) {
  // `user` is the populated account: a document (_id) from a query, or its JSON (id) inside toJSON.
  if (user && user.name !== undefined) {
    return { id: String(user.id ?? user._id), name: user.name, email, phone: user.phone ?? null, teammate: true };
  }
  return { id: null, name: name || email, email, phone: null, teammate: false };
}

// An optional moment: "", null or missing becomes null.
export const optionalMoment = (message) =>
  z.preprocess((value) => (value === '' || value === undefined ? null : value), z.coerce.date({ error: message }).nullable());

// The tracking part of each form, checked with zod. The forms also check the end time against the
// start (see checkVisitEnd).
export const trackingInput = {
  visitDate: z.coerce.date({ error: 'Please pick the visit date and time.' }),
  visitEndDate: optionalMoment('Please pick a valid end time.'),
  status: z.enum(STATUSES, { error: STATUS_MESSAGE }).default('demo'), // a new onboarding starts with the demo visit
  notes: optionalText(1000),
};

// For a whole form (doctorInput.superRefine(checkVisitEnd)): the end time, when given, is later than
// the start, on the same day.
export function checkVisitEnd({ visitDate, visitEndDate }, ctx) {
  const problem = visitEndProblem(visitDate, visitEndDate);
  if (problem) ctx.addIssue({ code: 'custom', path: ['visitEndDate'], message: problem });
}

// Who may see a record: admins see every form; marketing people the forms they submitted or were
// assigned to. It's a MongoDB filter, used like this: Doctor.find({ ...visibleTo(req.user), status: 'setup' })
// To combine it with another filter that also has an $or (such as a search), use allOf().
export const visibleTo = (user) => (user.role === 'admin' ? {} : { $or: [{ createdBy: user._id }, { 'assignedTo.user': user._id }] });

// Several filters that must all match, as one MongoDB filter. Empty filters are left out.
export function allOf(...filters) {
  const parts = filters.filter((filter) => Object.keys(filter).length > 0);
  if (parts.length <= 1) return parts[0] ?? {};
  return { $and: parts };
}

// The visits a record shows on the calendar, oldest first, read from its history: one per stage of
// the onboarding, as [{ status, visitDate, visitEndDate, current }].
//   • a new status on another day adds a visit there; the earlier one stays on its day
//   • a new day with the same status moves the visit (it was rescheduled)
//   • a new status on the same day changes that day's visit
//   • notes, steps and assigning repeat the status and day, so they change nothing
// At most one visit a day (the later one wins). The last visit is where the record stands now
// (`current`); the record's own status and visit date have the final say, which also covers a record
// without a history.
export function visitEvents({ status, visitDate, visitEndDate = null, history = [] }) {
  const visits = [];
  for (const entry of [...history, { status, visitDate, visitEndDate }]) {
    const visit = { status: entry.status, visitDate: entry.visitDate, visitEndDate: entry.visitEndDate ?? null };
    const last = visits.at(-1);
    const sameStage = last && (last.status === visit.status || dhakaDay(last.visitDate) === dhakaDay(visit.visitDate));
    if (sameStage) Object.assign(last, visit);
    else visits.push(visit);
  }

  const byDay = new Map(); // in the order they happened, so the current visit stays last
  for (const visit of visits) {
    const day = dhakaDay(visit.visitDate);
    byDay.delete(day);
    byDay.set(day, visit);
  }
  return [...byDay.values()].map((visit, index, all) => ({ ...visit, current: index === all.length - 1 }));
}

// { done: 2, total: 4 }, or null when there are no steps.
export function countSteps(steps = []) {
  if (steps.length === 0) return null;
  return { done: steps.filter((step) => step.done).length, total: steps.length };
}
