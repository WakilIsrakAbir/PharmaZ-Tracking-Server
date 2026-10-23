import { Router } from 'express';
import { z } from 'zod';

import { validate } from '../middleware/errors.js';
import { Doctor } from '../models/Doctor.js';
import { Pharmacy } from '../models/Pharmacy.js';
import { countSteps, visibleTo } from '../models/shared.js';
import { photoUrl } from '../utils.js';

// /api/v1/calendar?from=…&to=…
// Every doctor and pharmacy form whose visit date falls in the range, for the calendar on the dashboard.
// Marketing people get the visits they submitted or were assigned to; admins get the whole team's.
const router = Router();

const DAY = 24 * 60 * 60 * 1000;

const rangeQuery = z
  .object({
    from: z.coerce.date({ error: 'Please give a valid start date.' }),
    to: z.coerce.date({ error: 'Please give a valid end date.' }),
  })
  .refine(({ from, to }) => to > from, { path: ['to'], error: 'The end date must be after the start date.' })
  .refine(({ from, to }) => to - from <= 62 * DAY, { path: ['to'], error: 'Ask for at most 62 days at a time.' });

const FIELDS = 'name address status implementationSteps visitDate phone photo createdBy assignedTo';
const PEOPLE = [
  { path: 'createdBy', select: 'name' },
  { path: 'assignedTo', select: 'name' },
];

router.get('/', validate({ query: rangeQuery }), async (req, res) => {
  const { from, to } = req.valid.query;
  const filter = { ...visibleTo(req.user), visitDate: { $gte: from, $lt: to } };

  const [doctors, pharmacies] = await Promise.all([
    Doctor.find(filter).select(`${FIELDS} chamberName`).populate(PEOPLE).lean(),
    Pharmacy.find(filter).select(FIELDS).populate(PEOPLE).lean(),
  ]);

  const items = [
    ...doctors.map((doctor) => calendarItem('doctor', doctor, doctor.chamberName || doctor.address)),
    ...pharmacies.map((pharmacy) => calendarItem('pharmacy', pharmacy, pharmacy.name)),
  ].sort((a, b) => a.visitDate - b.visitDate);

  res.json({ data: items });
});

// Just what a calendar chip and the day list need.
function calendarItem(type, record, place) {
  return {
    id: String(record._id),
    type,
    name: record.name,
    place,
    address: record.address,
    status: record.status,
    steps: countSteps(record.implementationSteps),
    visitDate: record.visitDate,
    phone: record.phone,
    photoUrl: photoUrl(record.photo),
    createdBy: userRef(record.createdBy),
    assignedTo: (record.assignedTo ?? []).map(userRef),
  };
}

// { id, name }, or null when the person is unknown (for example, a deleted account).
const userRef = (person) => (person ? { id: String(person._id), name: person.name } : null);

export default router;
