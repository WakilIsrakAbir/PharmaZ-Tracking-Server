import { Router } from 'express';
import { z } from 'zod';

import { validate } from '../middleware/errors.js';
import { Doctor } from '../models/Doctor.js';
import { Pharmacy } from '../models/Pharmacy.js';
import { assigneeJson, countSteps, visibleTo } from '../models/shared.js';
import { dhakaDay, photoUrl, startOfDhakaDay } from '../utils.js';

// /api/v1/calendar?from=…&to=…        every visit in a date range, for the month grid on the dashboard
// /api/v1/calendar/months?year=2026   how many visits each month of a year has, for the year overview
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
  { path: 'assignedTo.user', select: 'name phone' },
];

const monthsQuery = z.object({
  year: z.coerce.number({ error: 'Please give a year like 2026.' }).int().min(2000).max(2100).default(() => Number(dhakaDay().slice(0, 4))),
});

// One entry per month of the year, January to December, with the counts (zero when there is nothing).
router.get('/months', validate({ query: monthsQuery }), async (req, res) => {
  const { year } = req.valid.query;
  const inYear = { visitDate: { $gte: startOfDhakaDay(`${year}-01-01`), $lt: startOfDhakaDay(`${year + 1}-01-01`) } };

  // { "2026-10": 3, … } for one model, counting by the month in Dhaka time.
  async function countByMonth(Model) {
    const rows = await Model.aggregate([
      { $match: { ...visibleTo(req.user), ...inYear } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$visitDate', timezone: 'Asia/Dhaka' } }, count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  }

  const [doctors, pharmacies] = await Promise.all([countByMonth(Doctor), countByMonth(Pharmacy)]);
  const data = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    const counts = { doctors: doctors[month] ?? 0, pharmacies: pharmacies[month] ?? 0 };
    return { month, ...counts, total: counts.doctors + counts.pharmacies };
  });
  res.json({ data });
});

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
    assignedTo: (record.assignedTo ?? []).map(assigneeJson).map(({ id, name }) => ({ id, name })),
  };
}

// { id, name }, or null when the person is unknown (for example, a deleted account).
const userRef = (person) => (person ? { id: String(person._id), name: person.name } : null);

export default router;
