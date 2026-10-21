import { Router } from 'express';
import { z } from 'zod';

import { requireAdmin } from '../middleware/auth.js';
import { ApiError, validate } from '../middleware/errors.js';
import { formWithPhoto } from '../middleware/upload.js';
import { countSteps, visibleTo } from '../models/shared.js';
import { STATUSES, objectId, optionalText, removePhoto, requiredText } from '../utils.js';

// The endpoints for one kind of onboarding record. Used twice in server.js:
// /api/v1/doctors (Doctor model) and /api/v1/pharmacies (Pharmacy model).
//
//   GET    /             list (?search= ?status=), with counts per status
//   POST   /             submit a new form (JSON, or multipart with a photo)
//   GET    /:id          one record
//   PUT    /:id          save the edited form
//   PATCH  /:id/status   the status update: new status, visit date, note, implementation steps
//   DELETE /:id          admins only
//
// Marketing people only see and change the forms they submitted; admins see every form.
// Anyone else's form answers 404, exactly as if it didn't exist.

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
  status: z.enum(STATUSES, { error: 'Status must be Ongoing, Setup or Implementation.' }),
  visitDate: z.coerce.date({ error: 'Please pick a valid date.' }).optional(),
  note: optionalText(500),
  implementationSteps: stepsInput.optional(),
});

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Who submitted the form (with their phone, so the team can call them) and who made each change.
const PEOPLE = [
  { path: 'createdBy', select: 'name phone' },
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
    const filter = { ...visibleTo(req.user), ...searchFilter(search) };

    const [records, perStatus] = await Promise.all([
      Model.find(status ? { ...filter, status } : filter).sort({ visitDate: -1 }).populate(PEOPLE),
      Model.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const counts = { all: 0, ongoing: 0, setup: 0, implementation: 0 };
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
      photo: req.file?.filename ?? null,
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
    const replacedPhoto = req.file ? record.photo : null;

    record.set({ ...values, ...(req.file && { photo: req.file.filename }) });
    if (moved) {
      record.history.push({ status: values.status, visitDate: values.visitDate, note: 'Form updated', by: req.user._id });
    }
    await record.save();
    await removePhoto(replacedPhoto);

    res.json({ data: await record.populate(PEOPLE) });
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

  router.delete('/:id', requireAdmin, validate({ params: idParams }), async (req, res) => {
    const record = await Model.findByIdAndDelete(req.valid.params.id);
    if (!record) throw new ApiError(404, `We couldn't find that ${kind}.`);
    await removePhoto(record.photo);
    res.status(204).end();
  });

  return router;
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
