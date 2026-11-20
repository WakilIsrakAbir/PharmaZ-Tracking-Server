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

// One update in the history: the status and visit it set, its note, who made it and when (`at`,
// which also names the update when it is deleted: see DELETE …/history/:at in routes/records.js).
const historyFields = {
  status: { type: String, enum: STATUSES, required: true },
  visitDate: { type: Date, required: true },   // the calendar also shows the earlier visits (see visitEvents)
  visitEndDate: { type: Date, default: null }, // when that visit ended, if it was given
  note: { type: String, default: '' },
  // How many implementation steps were done at that moment, e.g. { done: 2, total: 4 }.
  steps: { type: new mongoose.Schema({ done: Number, total: Number }, { _id: false }), default: null },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  at: { type: Date, default: Date.now },
};

const historyEntrySchema = new mongoose.Schema(
  { ...historyFields, visitDate: { ...historyFields.visitDate, index: true } },
  { _id: false },
);

// A deleted update, kept with who deleted it and when, so "Undo" can put it back. `removal` groups
// what one delete took away (the update, and old "Assigned to …" lines that repeated it).
const removedEntrySchema = new mongoose.Schema(
  {
    ...historyFields,
    removal: { type: mongoose.Schema.Types.ObjectId, required: true },
    removedAt: { type: Date, default: Date.now },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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

// Who goes on one visit, chosen by an admin: the visit is named by its day in Dhaka ("2026-11-17"),
// as on the calendar (one visit a day).
const visitTeamSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },
    assignedTo: { type: [assigneeSchema], default: [] },
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
  // Deleted updates (never sent by the API; read it with .select('+removedHistory')).
  removedHistory: { type: [removedEntrySchema], default: [], select: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true }, // who submitted it
  // The onboarding team: who an admin assigned to this record. A teammate (`user` set) sees it on
  // the calendar and in the lists and can update it, like the submitter; an outside email address
  // only gets the emails. Being on the team doesn't make anyone go on a visit (see visitTeams).
  assignedTo: { type: [assigneeSchema], default: [] },
  // Who goes on each visit: only the people an admin chose for it (see goingOn). A teammate here
  // sees the onboarding, and on the calendar only the visits they go on.
  visitTeams: { type: [visitTeamSchema], default: [] },
};

// What the API sends: `id`, the `type`, each assignee as { id, name, email, phone, teammate }
// (populate assignedTo.user and visitTeams.assignedTo.user first; see PEOPLE in routes/records.js),
// the history's updates (without old "Assigned to …" lines, see statusHistory), and `visits`: the
// visits on the calendar, oldest first, each with who goes ({ day, status, visitDate, visitEndDate,
// steps, current, assignedTo }; nobody until an admin chooses). Deleted updates are never sent.
export const recordOptions = (type) => ({
  timestamps: true,
  toJSON: {
    versionKey: false,
    transform: (doc, { _id, assignedTo = [], visitTeams = [], history = [], removedHistory, ...record }) => {
      const team = assignedTo.map(assigneeJson);
      const teams = new Map(visitTeams.map((entry) => [entry.day, entry.assignedTo.map(assigneeJson)]));
      return {
        id: String(_id),
        type,
        ...record,
        history: statusHistory(history),
        assignedTo: team,
        visitTeams: [...teams].map(([day, people]) => ({ day, assignedTo: people })),
        visits: calendarVisits(doc).map(({ status, visitDate, visitEndDate, steps, current }) => {
          const day = dhakaDay(visitDate);
          const progress = steps ? { done: steps.done, total: steps.total } : null;
          return { day, status, visitDate, visitEndDate, steps: progress, current, assignedTo: teams.get(day) ?? [] };
        }),
      };
    },
  },
});

// Who goes on the visit of `day`: the people an admin chose for it, or nobody yet. The stored
// assignees (populate them first to read names).
export const goingOn = (record, day) => (record.visitTeams ?? []).find((team) => team.day === day)?.assignedTo ?? [];

// Whether a visit is over: its end has passed (its start, when it has no end time). Telling anyone
// about a visit that is over is no use, so nobody is emailed about one.
export const isOver = ({ visitDate, visitEndDate }) => new Date(visitEndDate ?? visitDate) < new Date();

// The people to tell about a change: the onboarding team and whoever goes on the visits on `days`,
// each once (by email), as { id, name, email, phone, teammate }, without `except` (who did it).
export function peopleToTell(record, days, except) {
  const people = new Map();
  for (const person of [record.assignedTo ?? [], ...days.filter(Boolean).map((day) => goingOn(record, day))].flat()) {
    const json = assigneeJson(person);
    if (json.email !== except?.email) people.set(json.email, json);
  }
  return [...people.values()];
}

// Whether this person sees every visit of a record: admins, whoever submitted it, and the onboarding
// team. Someone only on a visit's team sees just the visits they go on (see visitsFor).
export function seesEveryVisit(record, user) {
  const me = String(user._id);
  const idOf = (person) => String(person?._id ?? person ?? '');
  return user.role === 'admin' || idOf(record.createdBy) === me || (record.assignedTo ?? []).some((person) => idOf(person.user) === me);
}

// The visits of a record this person sees on the calendar (calendarVisits, each with its day).
export function visitsFor(record, user) {
  const visits = calendarVisits(record).map((visit) => ({ ...visit, day: dhakaDay(visit.visitDate) }));
  if (seesEveryVisit(record, user)) return visits;
  const me = String(user._id);
  return visits.filter(({ day }) => goingOn(record, day).some((person) => String(person.user?._id ?? person.user ?? '') === me));
}

// Assigning people used to add a line to the history ("Assigned to Rafi", "No longer assigned: Sumi")
// that repeated the status and visit of the update before it. Such a line isn't an update of the
// onboarding: the history and the calendar leave it out (assigning no longer adds one). `previous`
// is the history entry just before it.
const ASSIGNMENT_NOTE = /^(Assigned to |No longer assigned: )/;
export function isAssignmentLine(entry, previous) {
  if (!ASSIGNMENT_NOTE.test(entry.note ?? '') || entry.steps) return false;
  if (!previous) return true;
  return entry.status === previous.status && sameMoment(entry.visitDate, previous.visitDate) && sameMoment(entry.visitEndDate, previous.visitEndDate);
}

// The updates in a history, oldest first: every entry but the old "Assigned to …" lines.
export function statusHistory(history = []) {
  return history.filter((entry, index) => !isAssignmentLine(entry, history[index - 1]));
}

// Two moments (Dates, ISO strings or null) are the same, or both missing.
export const sameMoment = (a, b) => (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);

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
// assigned to (to the onboarding, or to one of its visits). It's a MongoDB filter, used like this:
// Doctor.find({ ...visibleTo(req.user), status: 'setup' })
// To combine it with another filter that also has an $or (such as a search), use allOf().
export const visibleTo = (user) =>
  user.role === 'admin' ? {} : { $or: [{ createdBy: user._id }, { 'assignedTo.user': user._id }, { 'visitTeams.assignedTo.user': user._id }] };

// Several filters that must all match, as one MongoDB filter. Empty filters are left out.
export function allOf(...filters) {
  const parts = filters.filter((filter) => Object.keys(filter).length > 0);
  if (parts.length <= 1) return parts[0] ?? {};
  return { $and: parts };
}

// The visits a record shows on the calendar, oldest first, read from its history, as
// [{ status, visitDate, visitEndDate, steps, current }]. When an update puts the visit on another day:
//   • with a new status, the earlier visit stays on its day (a new stage of the onboarding)
//   • with the same status, the earlier visit also stays when it took place: its time had come when
//     the day was changed (the next visit was set after it), or implementation steps were ticked off
//     at it; otherwise it moves to the new day (it was rescheduled before it was due)
// An update on the same day changes that day's visit (its status, time and progress); notes and
// assigning repeat the status and day, so they change nothing. `steps` is how far the implementation
// steps were at that visit ({ done, total }, or null). At most one visit a day (the later one wins).
// The last visit is where the record stands now (`current`); the record's own status and visit date
// have the final say, which also covers a record without a history. Old "Assigned to …" lines are
// left out (see statusHistory), so deleting an update takes its visit away even when one followed it.
export function visitEvents({ status, visitDate, visitEndDate = null, history = [] }) {
  const visits = [];
  let doneSoFar = 0; // implementation steps done, as the history goes
  for (const entry of [...statusHistory(history), { status, visitDate, visitEndDate }]) {
    const visit = { status: entry.status, visitDate: entry.visitDate, visitEndDate: entry.visitEndDate ?? null, steps: entry.steps ?? null, worked: false };
    const progressed = Boolean(entry.steps) && entry.steps.done > doneSoFar; // steps were ticked off in this update
    if (entry.steps) doneSoFar = entry.steps.done;
    const last = visits.at(-1);
    if (!last) {
      visits.push({ ...visit, worked: progressed });
      continue;
    }

    // The steps ticked off in this update were done at the visit that was current until now (an
    // update after a visit ticks what was done there, and may set the next visit's day).
    if (progressed) last.worked = true;
    if (entry.steps) last.steps = entry.steps;

    if (dhakaDay(last.visitDate) === dhakaDay(visit.visitDate)) {
      Object.assign(last, { status: visit.status, visitDate: visit.visitDate, visitEndDate: visit.visitEndDate });
      continue;
    }
    const tookPlace = Boolean(entry.at) && last.visitDate <= new Date(entry.at); // its time had come
    if (last.status !== visit.status || tookPlace || last.worked) visits.push({ ...visit, steps: visit.steps ?? last.steps });
    else Object.assign(last, { visitDate: visit.visitDate, visitEndDate: visit.visitEndDate }); // rescheduled
  }

  const byDay = new Map(); // in the order they happened, so the current visit stays last
  for (const visit of visits) {
    const day = dhakaDay(visit.visitDate);
    byDay.delete(day);
    byDay.set(day, visit);
  }
  return [...byDay.values()].map(({ worked, ...visit }, index, all) => ({ ...visit, current: index === all.length - 1 }));
}

// The visits as the calendar shows them: the current one has the checklist's progress as it is now,
// an earlier one how far the steps were at it.
export const calendarVisits = (record) =>
  visitEvents(record).map((visit) => (visit.current ? { ...visit, steps: countSteps(record.implementationSteps) } : visit));

// How the calendar changes from one version of a record to another (a deleted update, put back):
//   removed  visits that leave the calendar          [{ status, visitDate, visitEndDate, steps }]
//   added    visits that come (back) on a new day    [same]
//   changed  visits that stay on their day but get another status, time or step count
//            [{ before, after }]
export function calendarChange(before, after) {
  const byDay = (visits) => new Map(visits.map(({ status, visitDate, visitEndDate, steps }) => [dhakaDay(visitDate), { status, visitDate, visitEndDate, steps }]));
  const old = byDay(before);
  const now = byDay(after);
  const stepsShown = (visit) => (visit.status === 'implementation' && visit.steps ? `${visit.steps.done}/${visit.steps.total}` : '');
  const same = (a, b) =>
    a.status === b.status && sameMoment(a.visitDate, b.visitDate) && sameMoment(a.visitEndDate, b.visitEndDate) && stepsShown(a) === stepsShown(b);
  return {
    removed: [...old].filter(([day]) => !now.has(day)).map(([, visit]) => visit),
    added: [...now].filter(([day]) => !old.has(day)).map(([, visit]) => visit),
    changed: [...now].filter(([day, visit]) => old.has(day) && !same(old.get(day), visit)).map(([day, visit]) => ({ before: old.get(day), after: visit })),
  };
}

// { done: 2, total: 4 }, or null when there are no steps.
export function countSteps(steps = []) {
  if (steps.length === 0) return null;
  return { done: steps.filter((step) => step.done).length, total: steps.length };
}
