import mongoose from 'mongoose';
import { z } from 'zod';

import { STATUSES, optionalText, photoUrl } from '../utils.js';

// What every onboarding record has, doctor or pharmacy: the visit date and status that the
// marketing person sets on the form, notes, the photo, who submitted it, the implementation
// steps, and a history of every status change (shown as a timeline).

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

export const trackingFields = {
  photo: { type: String, default: null },                       // the Photo's id (models/Photo.js)
  visitDate: { type: Date, required: true, index: true },        // when the visit happens
  status: { type: String, enum: STATUSES, default: 'ongoing', index: true },
  notes: { type: String, default: '' },
  implementationSteps: { type: [stepSchema], default: [] },
  history: { type: [historyEntrySchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true }, // who submitted it
};

// What the API sends: `id`, the `type`, and a `photoUrl` instead of the photo id.
export const recordOptions = (type) => ({
  timestamps: true,
  toJSON: {
    versionKey: false,
    transform: (doc, { _id, photo, ...record }) => ({ id: String(_id), type, ...record, photoUrl: photoUrl(photo) }),
  },
});

// The tracking part of each form, checked with zod.
export const trackingInput = {
  visitDate: z.coerce.date({ error: 'Please pick the visit date and time.' }),
  status: z.enum(STATUSES, { error: 'Status must be Ongoing, Setup or Implementation.' }).default('ongoing'),
  notes: optionalText(1000),
};

// Who may see a record: admins see every form, marketing people only the forms they submitted.
// It's a MongoDB filter, used like this: Doctor.find({ ...visibleTo(req.user), status: 'setup' })
export const visibleTo = (user) => (user.role === 'admin' ? {} : { createdBy: user._id });

// { done: 2, total: 4 }, or null when there are no steps.
export function countSteps(steps = []) {
  if (steps.length === 0) return null;
  return { done: steps.filter((step) => step.done).length, total: steps.length };
}
