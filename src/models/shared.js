import mongoose from 'mongoose';
import { z } from 'zod';

import { STATUSES, STATUS_MESSAGE, optionalText } from '../utils.js';

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
    visitDate: { type: Date, required: true },
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
  visitDate: { type: Date, required: true, index: true },        // when the visit happens
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

// The tracking part of each form, checked with zod.
export const trackingInput = {
  visitDate: z.coerce.date({ error: 'Please pick the visit date and time.' }),
  status: z.enum(STATUSES, { error: STATUS_MESSAGE }).default('demo'), // a new onboarding starts with the demo visit
  notes: optionalText(1000),
};

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

// { done: 2, total: 4 }, or null when there are no steps.
export function countSteps(steps = []) {
  if (steps.length === 0) return null;
  return { done: steps.filter((step) => step.done).length, total: steps.length };
}
