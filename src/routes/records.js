import { Router } from 'express';
import { z } from 'zod';

import { sendRecordEmails } from '../email.js';
import { requireAdmin } from '../middleware/auth.js';
import { ApiError, validate } from '../middleware/errors.js';
import { formWithPhoto } from '../middleware/upload.js';
import { User } from '../models/User.js';
import { allOf, assigneeJson, countSteps, visibleTo } from '../models/shared.js';
import { STATUSES, STATUS_MESSAGE, emailField, objectId, optionalText, removePhoto, requiredText } from '../utils.js';

// The endpoints for one kind of onboarding record. Used twice in app.js:
// /api/v1/doctors (Doctor model) and /api/v1/pharmacies (Pharmacy model).
//
//   GET    /                list (?search= ?status=), with counts per status
//   POST   /                submit a new form (JSON, or multipart with a photo)
//   GET    /:id             one record
//   PUT    /:id             save the edited form (everyone assigned is emailed the new version)
//   PATCH  /:id/status      the status update: new status, visit date, note, implementation steps
//   PUT    /:id/assignees   admins only: who is assigned, by email (newly assigned people get an email)
//   DELETE /:id             admins only
//
// Marketing people only see and change the forms they submitted or were assigned to; admins see
// every form. Anyone else's form answers 404, exactly as if it didn't exist.

const idParams = z.object({ id: objectId });

const listQuery = z.object({
  search: z.string().trim().max(80).optional(),
  status: z.enum(STATUSES).optional(),
});

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

// The whole list of assigned people, as email addresses, sent each time (an empty list unassigns
// everyone). A teammate's address links the record to their account; any other address only gets the emails.
const assigneesBody = z.object({
  emails: z.array(emailField, { error: 'Please send the list of email addresses.' }).max(20, 'Assign 20 people or fewer.'),
});

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

  // Matches the text fields, and phone numbers by their digits ("01711" finds +8801711…).
  function searchFilter(search) {
    if (!search) return {};
    const pattern = new RegExp(escapeRegex(search), 'i');
    const or = Model.searchFields.map((field) => ({ [field]: pattern }));
    const digits = search.replace(/\D/g, '').replace(/^0/, '');
    if (digits.length >= 3) or.push({ phone: new RegExp(digits) });
    return { $or: or };
  }

  router.get('/', validate({ query: listQuery }), async (req, res) => {
    const { search, status } = req.valid.query;
    const filter = allOf(visibleTo(req.user), searchFilter(search));

    const [records, perStatus] = await Promise.all([
      Model.find(status ? allOf(filter, { status }) : filter).sort({ visitDate: -1 }).populate(PEOPLE),
      Model.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const counts = { all: 0, ongoing: 0, setup: 0, implementation: 0, support: 0 };
    for (const { _id, count } of perStatus) {
      counts[_id] = count;
      counts.all += count;
    }
    res.json({ data: records, meta: { counts } });
  });

  router.post('/', formWithPhoto, validate({ body: input }), async (req, res) => {
    const values = req.valid.body;
    const record = await Model.create({
      ...values,
      photo: req.photoId,
      createdBy: req.user._id,
      history: [{ status: values.status, visitDate: values.visitDate, note: 'Form submitted', by: req.user._id }],
    });
    res.status(201).json({ data: await record.populate(PEOPLE) });
  });

  router.get('/:id', validate({ params: idParams }), async (req, res) => {
    const record = await findRecord(req.valid.params.id, req.user);
    res.json({ data: await record.populate(PEOPLE) });
  });

  router.put('/:id', formWithPhoto, validate({ params: idParams, body: input }), async (req, res) => {
    const record = await findRecord(req.valid.params.id, req.user);
    const values = req.valid.body;
    const moved = values.status !== record.status || values.visitDate.getTime() !== record.visitDate.getTime();
    const replacedPhoto = req.photoId ? record.photo : null;

    record.set({ ...values, ...(req.photoId && { photo: req.photoId }) });
    if (moved) {
      record.history.push({ status: values.status, visitDate: values.visitDate, note: 'Form updated', by: req.user._id });
    }
    await record.save();
    await removePhoto(replacedPhoto);
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
    const emails = [...new Set(req.valid.body.emails)];

    // Teammates whose address is in the list (active accounts only; a deactivated one counts as outside).
    const teammates = await User.find({ email: { $in: emails }, isActive: true }).select('name phone email');
    const byEmail = new Map(teammates.map((person) => [person.email, person]));

    const before = record.assignedTo.map(assigneeJson);
    record.assignedTo = emails.map((email) => ({ email, user: byEmail.get(email)?._id ?? null }));
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
    await removePhoto(record.photo);
    res.status(204).end();
  });

  return router;
}

// "Rafi Hasan, sumi@example.com"
const names = (people) => people.map((person) => person.name).join(', ');

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
