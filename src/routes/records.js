import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';

import { sendRecordEmails } from '../email.js';
import { requireAdmin } from '../middleware/auth.js';
import { ApiError, validate } from '../middleware/errors.js';
import { User } from '../models/User.js';
import {
  allOf,
  assigneeJson,
  calendarChange,
  calendarVisits,
  countSteps,
  isAssignmentLine,
  sameMoment,
  statusHistory,
  visibleTo,
} from '../models/shared.js';
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
  visitEndProblem,
} from '../utils.js';

// The endpoints for one kind of onboarding record. Used twice in app.js:
// /api/v1/doctors (Doctor model) and /api/v1/pharmacies (Pharmacy model).
//
//   GET    /                one page of the list (?page= ?limit=), filtered (?search= ?status=
//                           ?assignee= ?createdBy= ?from= ?to=) and sorted (?sort=), with counts per status
//   POST   /                submit a new form
//   GET    /:id             one record
//   PUT    /:id             save the edited form (everyone assigned is emailed the new version)
//   PATCH  /:id/status      the status update: new status, visit date and end time, note, implementation
//                           steps (a new status or visit time is emailed to everyone assigned)
//   PUT    /:id/assignees   admins only: who is assigned, by email (newly assigned people get an email)
//   DELETE /:id/history/:at admins only: delete one update from the history (?dryRun=true says what
//                           would change); the calendar follows
//   POST   /:id/history/restore  admins only: "Undo", puts a deleted update back
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
  // null (or "") for no end time; left out, see the status update below.
  visitEndDate: z.preprocess((value) => (value === '' ? null : value), z.coerce.date({ error: 'Please pick a valid end time.' }).nullable().optional()),
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

// An update in the history is named by the moment it was made (its `at`, as the API sends it).
const historyParams = z.object({ id: objectId, at: z.coerce.date({ error: 'That update is not valid.' }) });
const dryRunQuery = z.object({ dryRun: z.stringbool({ error: 'dryRun must be true or false.' }).default(false) });
// The `removal` id that the delete answered with.
const restoreBody = z.object({
  removal: z.string({ error: 'Please send the removal id that the delete answered with.' }).regex(/^[a-f\d]{24}$/i, 'That ID is not valid.'),
});

// Who submitted the form (with their phone, so the team can call them), who is assigned to it,
// and who made each change.
const PEOPLE = [
  { path: 'createdBy', select: 'name phone role' },
  { path: 'assignedTo.user', select: 'name phone role' },
  { path: 'history.by', select: 'name' },
];

export function recordRoutes(Model, input) {
  const router = Router();
  const kind = Model.modelName.toLowerCase(); // "doctor" or "pharmacy"

  // One record, but only if this person may see it. `select` adds fields the API never sends,
  // such as '+removedHistory'.
  async function findRecord(id, user, select) {
    const query = Model.findOne({ _id: id, ...visibleTo(user) });
    if (select) query.select(select);
    const record = await query;
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

    const counts = { all: 0, account_creation: 0, demo: 0, ongoing: 0, setup: 0, implementation: 0, support: 0 };
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
      history: [{ status: values.status, visitDate: values.visitDate, visitEndDate: values.visitEndDate, note: 'Form submitted', by: req.user._id }],
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
    const moved =
      values.status !== record.status ||
      values.visitDate.getTime() !== record.visitDate.getTime() ||
      timeOf(values.visitEndDate) !== timeOf(record.visitEndDate);

    record.set(values);
    if (moved) {
      record.history.push({ status: values.status, visitDate: values.visitDate, visitEndDate: values.visitEndDate, note: 'Form updated', by: req.user._id });
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
    // Without `visitEndDate`, the end time stays while the visit keeps its start; a visit that moves
    // to a new start has no end time until one is given.
    let { visitEndDate } = req.valid.body;
    if (visitEndDate === undefined) visitEndDate = visitDate.getTime() === record.visitDate.getTime() ? record.visitEndDate : null;
    const endProblem = visitEndProblem(visitDate, visitEndDate);
    if (endProblem) throw ApiError.validation({ visitEndDate: endProblem });

    // A new status, or a new day or time for the visit, is emailed to everyone assigned (not to the
    // person who made it). A note or the steps alone are not, so inboxes don't fill up.
    const moved =
      status !== record.status || visitDate.getTime() !== record.visitDate.getTime() || timeOf(visitEndDate) !== timeOf(record.visitEndDate);
    const previousStatus = record.status;

    record.status = status;
    record.visitDate = visitDate;
    record.visitEndDate = visitEndDate;
    if (implementationSteps) record.implementationSteps = updatedSteps(record.implementationSteps, implementationSteps);

    // While in Implementation, the history also remembers how many steps were done.
    const steps = status === 'implementation' ? countSteps(record.implementationSteps) : null;
    record.history.push({ status, visitDate, visitEndDate, note, steps, by: req.user._id });
    await record.save();
    await record.populate(PEOPLE);

    // `meta.email` says who was emailed (nobody when nothing but a note or the steps changed).
    const recipients = moved ? record.assignedTo.map(assigneeJson).filter((person) => person.email !== req.user.email) : [];
    const email = await sendRecordEmails({ record, type: kind, recipients, by: req.user, reason: 'status', change: { previousStatus, note } });
    res.json({ data: record, meta: { email } });
  });

  // "Assign" in the details panel. Any email address can be assigned: a teammate's address links
  // the record to their account (so they see it), any other address just gets the emails. Each newly
  // assigned person is emailed the whole form; the answer's `meta.email` says whether those emails
  // went out. Assigning isn't an update of the onboarding, so it adds nothing to the history.
  router.put('/:id/assignees', requireAdmin, validate({ params: idParams, body: assigneesBody }), async (req, res) => {
    const record = await findRecord(req.valid.params.id, req.user);
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
    await record.save();

    const email = await sendRecordEmails({ record, type: kind, recipients: added, by: req.user, reason: 'assigned' });
    res.json({ data: await record.populate(PEOPLE), meta: { email } });
  });

  // Admins only: delete one update from the history, as if it had never been made. The calendar is
  // worked out again from the updates that are left. Deleting the latest update takes the onboarding
  // back to the update before it (its status, visit and end time; the checklist stays as it is).
  // The only update can't be deleted (delete the form instead). Old "Assigned to …" lines right after
  // the update go with it. What was deleted is kept, so "Undo" can put it back (`meta.removal`).
  // `?dryRun=true` changes nothing: it only says what would change (`meta.change`, for the dialog).
  router.delete('/:id/history/:at', requireAdmin, validate({ params: historyParams, query: dryRunQuery }), async (req, res) => {
    const { id, at } = req.valid.params;
    const { dryRun } = req.valid.query;
    const record = await findRecord(id, req.user, '+removedHistory');
    await record.populate(PEOPLE);

    const span = updateSpan(record.history, at);
    if (!span) throw new ApiError(404, "We couldn't find that update. It may have been deleted already.");
    if (statusHistory(record.history).length === 1) {
      throw new ApiError(409, `This is the only update, so it can't be deleted. To remove this ${kind} completely, delete the form.`);
    }

    const before = snapshot(record);
    const lines = record.history.splice(span.index, span.count).map(plainLine);
    const wasLatest = span.index === record.history.length;
    if (wasLatest) setState(record, statusHistory(record.history).at(-1)); // back to the update before it
    const { change, recipients } = describeChange(record, before, lines[0], req.user);
    if (dryRun) return res.json({ data: null, meta: { dryRun: true, removal: null, change } });

    const removal = new mongoose.Types.ObjectId();
    const removedAt = new Date();
    record.removedHistory.push(...lines.map((line) => ({ ...line, by: idOf(line.by), removal, removedAt, removedBy: req.user._id })));
    await record.save();

    const email = await sendRecordEmails({ record, type: kind, recipients, by: req.user, reason: 'removed', change: { update: lines[0] } });
    res.json({ data: record, meta: { dryRun: false, removal: String(removal), change, email } });
  });

  // Admins only: "Undo" after deleting an update. Puts back everything that delete took away (named
  // by the `removal` id it answered with), each line in its place by time. When the update is the
  // latest again, the onboarding is back where it stood; everyone assigned is emailed as above.
  router.post('/:id/history/restore', requireAdmin, validate({ params: idParams, body: restoreBody }), async (req, res) => {
    const record = await findRecord(req.valid.params.id, req.user, '+removedHistory');
    await record.populate(PEOPLE);
    const { removal } = req.valid.body;
    const lines = record.removedHistory.filter((line) => String(line.removal) === removal).map(plainLine);
    if (lines.length === 0) throw new ApiError(404, "There's nothing to put back. It may have been put back already.");

    const before = snapshot(record);
    record.removedHistory = record.removedHistory.filter((line) => String(line.removal) !== removal);
    for (const line of lines) {
      const place = record.history.findIndex((entry) => entry.at > line.at);
      record.history.splice(place === -1 ? record.history.length : place, 0, line);
    }
    const [update] = lines;
    if (sameMoment(statusHistory(record.history).at(-1)?.at, update.at)) setState(record, update); // the latest again
    await record.save();
    await record.populate(PEOPLE);

    const restored = record.history.find((entry) => sameMoment(entry.at, update.at)) ?? update;
    const { change, recipients } = describeChange(record, before, restored, req.user);
    const email = await sendRecordEmails({
      record,
      type: kind,
      recipients,
      by: req.user,
      reason: 'status',
      change: { previousStatus: before.state.status, note: 'An update that was deleted is back.' },
    });
    res.json({ data: record, meta: { change, email } });
  });

  router.delete('/:id', requireAdmin, validate({ params: idParams }), async (req, res) => {
    const record = await Model.findByIdAndDelete(req.valid.params.id);
    if (!record) throw new ApiError(404, `We couldn't find that ${kind}.`);
    res.status(204).end();
  });

  return router;
}

// A moment as a number to compare, or null when there is none (an end time that wasn't given).
const timeOf = (date) => date?.getTime() ?? null;

// ---------------------------------------------------------------------------
// Deleting an update from the history, and putting it back
// ---------------------------------------------------------------------------

// Where the update made at `at` is in the history, with the old "Assigned to …" lines right after
// it (they repeated it, so they go with it): { index, count }, or null when there is no such update.
function updateSpan(history, at) {
  const index = history.findIndex((entry, i) => sameMoment(entry.at, at) && !isAssignmentLine(entry, history[i - 1]));
  if (index === -1) return null;
  let end = index + 1;
  while (end < history.length && isAssignmentLine(history[end], history[end - 1])) end += 1;
  return { index, count: end - index };
}

// A history line as plain values, to move between the history and the deleted lines.
function plainLine({ status, visitDate, visitEndDate, note, steps, by, at }) {
  return { status, visitDate, visitEndDate: visitEndDate ?? null, note, steps: steps ? { done: steps.done, total: steps.total } : null, by, at };
}

// An account's id, whether it is populated ({ _id, name }) or not.
const idOf = (person) => person?._id ?? person ?? null;

// Where the onboarding stands: its status, visit and end time.
const stateOf = ({ status, visitDate, visitEndDate }) => ({ status, visitDate, visitEndDate: visitEndDate ?? null });

function setState(record, line) {
  Object.assign(record, stateOf(line));
}

// The onboarding before a change, to compare with after it: where it stood and its calendar.
const snapshot = (record) => ({ state: stateOf(record), visits: calendarVisits(record) });

// A change matters to the people assigned only when it touches today or a later day (in Dhaka).
// Changing only days that have passed emails nobody.
const isTodayOrLater = (date) => Boolean(date) && dhakaDay(date) >= dhakaDay();

// What deleting an update (or putting it back) changes, as the API reports it in `meta.change`:
//   update      the update deleted or put back: { status, visitDate, visitEndDate, note, steps, at, by }
//   onboarding  { before, after, changed }: where it stood and stands (status, visit and end time)
//   calendar    { removed, added, changed }: see calendarChange in models/shared.js
//   emails      who is (or would be) emailed: everyone assigned, but not the person who did it, and
//               only when the onboarding changed on today or a later day
// `recipients` are those people, for sendRecordEmails.
function describeChange(record, before, update, user) {
  const after = stateOf(record);
  const changed =
    before.state.status !== after.status ||
    !sameMoment(before.state.visitDate, after.visitDate) ||
    !sameMoment(before.state.visitEndDate, after.visitEndDate);
  const recipients =
    changed && (isTodayOrLater(before.state.visitDate) || isTodayOrLater(after.visitDate))
      ? record.assignedTo.map(assigneeJson).filter((person) => person.email !== user.email)
      : [];
  const by = update.by && update.by.name !== undefined ? { id: String(update.by._id), name: update.by.name } : null;
  return {
    recipients,
    change: {
      update: { ...stateOf(update), note: update.note ?? '', steps: update.steps ?? null, at: update.at, by },
      onboarding: { before: before.state, after, changed },
      calendar: calendarChange(before.visits, calendarVisits(record)),
      emails: recipients.map((person) => person.name),
    },
  };
}

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
