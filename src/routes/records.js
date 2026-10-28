import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';

import { sendRecordEmails } from '../email.js';
import { requireAdmin } from '../middleware/auth.js';
import { ApiError, validate } from '../middleware/errors.js';
import { User } from '../models/User.js';
import { allOf, assigneeJson, countSteps, visibleTo } from '../models/shared.js';
import {
  STATUSES,
  STATUS_MESSAGE,
  dayField,
  dayRange,
  dhakaDay,
  emailField,
  objectId,
  optionalText,
  pageMeta,
  pageQuery,
  requiredText,
  searchFilter,
} from '../utils.js';

// The endpoints for one kind of onboarding record. Used twice in app.js:
// /api/v1/doctors (Doctor model) and /api/v1/pharmacies (Pharmacy model).
//
//   GET    /                one page of the list (?page= ?limit=), filtered (?search= ?status=
//                           ?assignee= ?createdBy= ?from= ?to=) and sorted (?sort=), with counts per status
//   POST   /                submit a new form
//   GET    /:id             one record
//   PUT    /:id             save the edited form (everyone assigned is emailed the new version)
//   PATCH  /:id/status      the status update: new status, visit date, note, implementation steps
//   PUT    /:id/assignees   admins only: who is assigned, by email (newly assigned people get an email)
//   DELETE /:id             admins only
//
// Marketing people only see and change the forms they submitted or were assigned to; admins see
// every form. Anyone else's form answers 404, exactly as if it didn't exist.

const idParams = z.object({ id: objectId });

// How a list can be narrowed down and ordered. `assignee` is a teammate's id, or "none" for the
// records nobody is assigned to; `from` and `to` are Dhaka days, both included.
const listQuery = z.object({
  search: z.string().trim().max(80).optional(),
  status: z.enum(STATUSES, { error: STATUS_MESSAGE }).optional(),
  assignee: z.union([z.literal('none'), objectId], { error: 'Assignee must be a teammate id or "none".' }).optional(),
  createdBy: objectId.optional(),
  from: dayField.optional(),
  to: dayField.optional(),
  sort: z.enum(['visit_desc', 'visit_asc', 'name', 'updated'], { error: 'Sort must be visit_desc, visit_asc, name or updated.' }).default('visit_desc'),
  ...pageQuery,
});

// What each `sort` means. Names are compared without regard to case (see the collation below).
const SORTS = {
  visit_desc: { visitDate: -1, _id: -1 }, // the latest visit first (the default)
  visit_asc: { visitDate: 1, _id: 1 },
  name: { name: 1, _id: 1 },
  updated: { updatedAt: -1, _id: -1 }, // the last changed first
};

// Only the records of these people: submitted by `createdBy`, assigned to `assignee` (or to no one).
// The ids come in as text; the aggregation that counts the statuses needs real ObjectIds.
function peopleFilter({ assignee, createdBy }) {
  const filter = {};
  if (createdBy) filter.createdBy = new mongoose.Types.ObjectId(createdBy);
  if (assignee === 'none') filter.assignedTo = { $size: 0 };
  else if (assignee) filter['assignedTo.user'] = new mongoose.Types.ObjectId(assignee);
  return filter;
}

// The implementation checklist. The whole list is sent each time; existing steps keep their id.
const stepsInput = z
  .array(
    z.object({
      id: objectId.optional(),
      title: requiredText('Please describe the step.', 120),
      done: z.boolean({ error: 'Done must be true or false.' }).default(false),
    }),
  )
  .max(20, 'Use 20 steps or fewer.');

const statusBody = z.object({
  status: z.enum(STATUSES, { error: STATUS_MESSAGE }),
  visitDate: z.coerce.date({ error: 'Please pick a valid date.' }).optional(),
  note: optionalText(500),
  implementationSteps: stepsInput.optional(),
});

// The whole list of assigned people, sent each time (an empty list unassigns everyone). A teammate's
// address links the record to their account; any other address only gets the emails, under the
// `name` given here (optional).
const assigneesBody = z.object({
  assignees: z
    .array(z.object({ email: emailField, name: optionalText(80) }), { error: 'Please send the list of people to assign.' })
    .max(20, 'Assign 20 people or fewer.'),
});

// Who submitted the form (with their phone, so the team can call them), who is assigned to it,
// and who made each change.
const PEOPLE = [
  { path: 'createdBy', select: 'name phone' },
  { path: 'assignedTo.user', select: 'name phone' },
  { path: 'history.by', select: 'name' },
];

export function recordRoutes(Model, input) {
  const router = Router();
  const kind = Model.modelName.toLowerCase(); // "doctor" or "pharmacy"

  // One record, but only if this person may see it.
  async function findRecord(id, user) {
    const record = await Model.findOne({ _id: id, ...visibleTo(user) });
    if (!record) throw new ApiError(404, `We couldn't find that ${kind}.`);
    return record;
  }

  // One page of the list. The counts per status follow every filter except `status` itself, so the
  // tabs above the list keep their numbers while one of them is open; the page total is that tab's count.
  router.get('/', validate({ query: listQuery }), async (req, res) => {
    const { search, status, from, to, sort, page, limit } = req.valid.query;
    const filter = allOf(
      visibleTo(req.user),
      searchFilter(search, Model.searchFields),
      peopleFilter(req.valid.query),
      dayRange('visitDate', from, to), // the visit's day in Dhaka
    );

    const [records, perStatus] = await Promise.all([
      Model.find(status ? allOf(filter, { status }) : filter)
        .collation({ locale: 'en', strength: 2 }) // "dr. karim" and "Dr. Karim" sort together
        .sort(SORTS[sort])
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(PEOPLE),
      Model.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const counts = { all: 0, demo: 0, ongoing: 0, setup: 0, implementation: 0, support: 0 };
    for (const { _id, count } of perStatus) {
      counts[_id] = count;
      counts.all += count;
    }
    const total = status ? counts[status] : counts.all;
    res.json({ data: records, meta: { counts, ...pageMeta(req.valid.query, total) } });
  });

  router.post('/', validate({ body: input }), async (req, res) => {
    const values = req.valid.body;
    assertVisitNotInPast(req.user, values.visitDate);
    const record = await Model.create({
      ...values,
      createdBy: req.user._id,
      history: [{ status: values.status, visitDate: values.visitDate, note: 'Form submitted', by: req.user._id }],
    });
    res.status(201).json({ data: await record.populate(PEOPLE) });
  });

  router.get('/:id', validate({ params: idParams }), async (req, res) => {
    const record = await findRecord(req.valid.params.id, req.user);
    res.json({ data: await record.populate(PEOPLE) });
  });

  router.put('/:id', validate({ params: idParams, body: input }), async (req, res) => {
    const record = await findRecord(req.valid.params.id, req.user);
    const values = req.valid.body;
    assertVisitNotInPast(req.user, values.visitDate, record.visitDate);
    const moved = values.status !== record.status || values.visitDate.getTime() !== record.visitDate.getTime();

    record.set(values);
    if (moved) {
      record.history.push({ status: values.status, visitDate: values.visitDate, note: 'Form updated', by: req.user._id });
    }
    await record.save();
    await record.populate(PEOPLE);

    // Everyone assigned gets the new version of the form (not the person who just edited it).
    const recipients = record.assignedTo.map(assigneeJson).filter((person) => person.email !== req.user.email);
    const email = await sendRecordEmails({ record, type: kind, recipients, by: req.user, reason: 'updated' });
    res.json({ data: record, meta: { email } });
  });

  // "Save update" in the details panel.
  router.patch('/:id/status', validate({ params: idParams, body: statusBody }), async (req, res) => {
    const record = await findRecord(req.valid.params.id, req.user);
    const { status, visitDate = record.visitDate, note, implementationSteps } = req.valid.body;
    assertVisitNotInPast(req.user, visitDate, record.visitDate);

    record.status = status;
    record.visitDate = visitDate;
    if (implementationSteps) record.implementationSteps = updatedSteps(record.implementationSteps, implementationSteps);

    // While in Implementation, the history also remembers how many steps were done.
    const steps = status === 'implementation' ? countSteps(record.implementationSteps) : null;
    record.history.push({ status, visitDate, note, steps, by: req.user._id });
    await record.save();

    res.json({ data: await record.populate(PEOPLE) });
  });

  // "Assign" in the details panel. Any email address can be assigned: a teammate's address links
  // the record to their account (so they see it), any other address just gets the emails. The
  // history remembers who was added and removed, and each newly assigned person is emailed the
  // whole form. The answer's `meta.email` says whether those emails went out.
  router.put('/:id/assignees', requireAdmin, validate({ params: idParams, body: assigneesBody }), async (req, res) => {
    const record = await findRecord(req.valid.params.id, req.user);
    await record.populate(PEOPLE); // so the people being removed can be named in the history
    const wanted = new Map(req.valid.body.assignees.map(({ email, name }) => [email, name])); // one entry per address
    const emails = [...wanted.keys()];

    // Teammates whose address is in the list (active accounts only; a deactivated one counts as outside).
    const teammates = await User.find({ email: { $in: emails }, isActive: true }).select('name phone email');
    const byEmail = new Map(teammates.map((person) => [person.email, person]));

    const before = record.assignedTo.map(assigneeJson);
    record.assignedTo = emails.map((email) => {
      const account = byEmail.get(email);
      return { email, name: account ? '' : wanted.get(email), user: account?._id ?? null };
    });
    await record.populate(PEOPLE);
    const after = record.assignedTo.map(assigneeJson);

    const added = after.filter((person) => !before.some((old) => old.email === person.email));
    const removed = before.filter((person) => !emails.includes(person.email));
    if (added.length || removed.length) {
      const note = [added.length && `Assigned to ${names(added)}`, removed.length && `No longer assigned: ${names(removed)}`]
        .filter(Boolean)
        .join('. ');
      record.history.push({ status: record.status, visitDate: record.visitDate, note, by: req.user._id });
    }
    await record.save();

    const email = await sendRecordEmails({ record, type: kind, recipients: added, by: req.user, reason: 'assigned' });
    res.json({ data: await record.populate(PEOPLE), meta: { email } });
  });

  router.delete('/:id', requireAdmin, validate({ params: idParams }), async (req, res) => {
    const record = await Model.findByIdAndDelete(req.valid.params.id);
    if (!record) throw new ApiError(404, `We couldn't find that ${kind}.`);
    res.status(204).end();
  });

  return router;
}

// "Rafi Hasan, sumi@example.com"
const names = (people) => people.map((person) => person.name).join(', ');

// Marketing people plan visits for today or later (by the day in Dhaka); a record that already has
// a past visit keeps it, only a change to another past day is refused. Admins may enter a visit on
// any day, including one that already happened (an onboarding entered after the fact).
function assertVisitNotInPast(user, visitDate, current = null) {
  if (user.role === 'admin') return;
  const day = dhakaDay(visitDate);
  if (current && dhakaDay(current) === day) return;
  if (day < dhakaDay()) throw ApiError.validation({ visitDate: "The visit date can't be in the past. Pick today or a later day." });
}

// The new checklist replaces the old one. A step that was already done keeps the day it was
// ticked off, a newly ticked step gets today, and an unticked step loses its date.
function updatedSteps(oldSteps, newSteps) {
  const now = new Date();
  return newSteps.map(({ id, title, done }) => {
    const old = id ? oldSteps.id(id) : null;
    const step = { title, done, doneAt: null };
    if (old) step._id = old._id; // the same step as before
    if (done) step.doneAt = old?.done ? old.doneAt : now;
    return step;
  });
}
