import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';

import { ApiError, validate } from '../middleware/errors.js';
import { SupportCall, supportCallInput } from '../models/SupportCall.js';
import { allOf } from '../models/shared.js';
import {
  CALLER_TYPES,
  CALL_STATUSES,
  CALL_STATUS_MESSAGE,
  dayField,
  dayRange,
  objectId,
  pageMeta,
  pageQuery,
  searchFilter,
} from '../utils.js';

// /api/v1/support-calls: the support team's call log. Admins and support people only (see app.js).
//
//   GET    /             one page of the log (?page= ?limit=), filtered (?search= ?status= ?type=
//                        ?createdBy= ?from= ?to=) and sorted (?sort=), with counts per status
//   POST   /             log a call
//   GET    /:id          one call
//   PUT    /:id          save the edited call
//   PATCH  /:id/status   Open ↔ Resolved
//   DELETE /:id          delete the call
//
// A support person only sees, changes and deletes the calls they logged; anyone else's call answers
// 404, exactly as if it didn't exist. An admin sees every call and can do everything.

const router = Router();
const idParams = z.object({ id: objectId });

const listQuery = z.object({
  search: z.string().trim().max(80).optional(),
  status: z.enum(CALL_STATUSES, { error: CALL_STATUS_MESSAGE }).optional(),
  type: z.enum(CALLER_TYPES, { error: 'Type must be doctor or pharmacy.' }).optional(),
  createdBy: objectId.optional(),
  from: dayField.optional(),
  to: dayField.optional(),
  sort: z.enum(['called_desc', 'called_asc', 'name', 'updated'], { error: 'Sort must be called_desc, called_asc, name or updated.' }).default('called_desc'),
  ...pageQuery,
});

const statusBody = z.object({ status: z.enum(CALL_STATUSES, { error: CALL_STATUS_MESSAGE }) });

const SORTS = {
  called_desc: { calledAt: -1, _id: -1 }, // the latest call first (the default)
  called_asc: { calledAt: 1, _id: 1 },
  name: { callerName: 1, _id: 1 }, // the caller, A to Z (see the collation below)
  updated: { updatedAt: -1, _id: -1 },
};

// Who logged the call (with their phone, so the team can call them).
const LOGGED_BY = { path: 'createdBy', select: 'name phone' };

// Who may see a call: admins every call; support people only the ones they logged.
const visibleTo = (user) => (user.role === 'admin' ? {} : { createdBy: user._id });

async function findCall(id, user) {
  const call = await SupportCall.findOne({ _id: id, ...visibleTo(user) });
  if (!call) throw new ApiError(404, "We couldn't find that call.");
  return call;
}

// One page of the log. The counts follow every filter except `status`, so the Open / Resolved tabs
// keep their numbers while one is open; the page total is that tab's count.
router.get('/', validate({ query: listQuery }), async (req, res) => {
  const { search, status, type, createdBy, from, to, sort, page, limit } = req.valid.query;
  const filter = allOf(
    visibleTo(req.user),
    searchFilter(search, SupportCall.searchFields),
    type ? { callerType: type } : {},
    createdBy ? { createdBy: new mongoose.Types.ObjectId(createdBy) } : {}, // a real ObjectId, for the aggregation
    dayRange('calledAt', from, to),
  );

  const [calls, perStatus] = await Promise.all([
    SupportCall.find(status ? allOf(filter, { status }) : filter)
      .collation({ locale: 'en', strength: 2 })
      .sort(SORTS[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(LOGGED_BY),
    SupportCall.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const counts = { all: 0, open: 0, resolved: 0 };
  for (const { _id, count } of perStatus) {
    counts[_id] = count;
    counts.all += count;
  }
  const total = status ? counts[status] : counts.all;
  res.json({ data: calls, meta: { counts, ...pageMeta(req.valid.query, total) } });
});

router.post('/', validate({ body: supportCallInput }), async (req, res) => {
  const { status, calledAt = new Date(), ...values } = req.valid.body;
  assertNotInFuture(calledAt);
  const call = new SupportCall({ ...values, calledAt, createdBy: req.user._id });
  setStatus(call, status);
  await call.save();
  res.status(201).json({ data: await call.populate(LOGGED_BY) });
});

router.get('/:id', validate({ params: idParams }), async (req, res) => {
  const call = await findCall(req.valid.params.id, req.user);
  res.json({ data: await call.populate(LOGGED_BY) });
});

// The whole form again. Leaving `calledAt` out keeps the saved moment.
router.put('/:id', validate({ params: idParams, body: supportCallInput }), async (req, res) => {
  const call = await findCall(req.valid.params.id, req.user);
  const { status, calledAt = call.calledAt, ...values } = req.valid.body;
  assertNotInFuture(calledAt);
  call.set({ ...values, calledAt });
  setStatus(call, status);
  await call.save();
  res.json({ data: await call.populate(LOGGED_BY) });
});

// "Mark as resolved" / "Reopen".
router.patch('/:id/status', validate({ params: idParams, body: statusBody }), async (req, res) => {
  const call = await findCall(req.valid.params.id, req.user);
  setStatus(call, req.valid.body.status);
  await call.save();
  res.json({ data: await call.populate(LOGGED_BY) });
});

router.delete('/:id', validate({ params: idParams }), async (req, res) => {
  const call = await findCall(req.valid.params.id, req.user);
  await call.deleteOne();
  res.status(204).end();
});

export default router;

// A call can't have come in later than now (a minute of slack, for clocks that differ a little).
function assertNotInFuture(calledAt) {
  if (calledAt.getTime() > Date.now() + 60_000) throw ApiError.validation({ calledAt: "The call can't be in the future." });
}

// Resolved remembers when it was resolved; reopening forgets it. A call that was already resolved keeps its moment.
function setStatus(call, status) {
  if (status === 'resolved' && call.status !== 'resolved') call.resolvedAt = new Date();
  if (status === 'open') call.resolvedAt = null;
  call.status = status;
}
