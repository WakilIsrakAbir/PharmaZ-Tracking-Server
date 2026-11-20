import { Router } from 'express';
import { z } from 'zod';

import { validate } from '../middleware/errors.js';
import { Doctor } from '../models/Doctor.js';
import { Pharmacy } from '../models/Pharmacy.js';
import { allOf, assigneeJson, calendarVisits, visibleTo, visitEvents } from '../models/shared.js';
import { dhakaDay, startOfDhakaDay } from '../utils.js';

// /api/v1/calendar?from=…&to=…        every visit in a date range, for the month grid on the dashboard
// /api/v1/calendar/months?year=2026   how many onboardings each month of a year has, for the year overview
// Marketing people get the visits they submitted or were assigned to; admins get the whole team's.
// A record can have several visits, one per stage, read from its history (visitEvents in models/shared.js):
// after "Demo on the 3rd" is updated to "Ongoing on the 10th", both days show it.
const router = Router();

const DAY = 24 * 60 * 60 * 1000;

const rangeQuery = z
  .object({
    from: z.coerce.date({ error: 'Please give a valid start date.' }),
    to: z.coerce.date({ error: 'Please give a valid end date.' }),
  })
  .refine(({ from, to }) => to > from, { path: ['to'], error: 'The end date must be after the start date.' })
  .refine(({ from, to }) => to - from <= 62 * DAY, { path: ['to'], error: 'Ask for at most 62 days at a time.' });

// The history's status, day, time of the change (at) and steps decide the visits (see visitEvents);
// the note tells the old "Assigned to …" lines, which don't count, from the updates.
const HISTORY = 'history.status history.visitDate history.visitEndDate history.at history.steps history.note';
const FIELDS = `name address status implementationSteps visitDate visitEndDate ${HISTORY} phone createdBy assignedTo`;
const PEOPLE = [
  { path: 'createdBy', select: 'name' },
  { path: 'assignedTo.user', select: 'name phone' },
];

const monthsQuery = z.object({
  year: z.coerce.number({ error: 'Please give a year like 2026.' }).int().min(2000).max(2100).default(() => Number(dhakaDay().slice(0, 4))),
});

// The records this person may see that have a visit, now or earlier, on or after `from` and before `to`.
// visibleTo() can be an $or of its own, so the two are combined with allOf() rather than spread together.
function withVisitsBetween(user, from, to) {
  const range = { $gte: from, $lt: to };
  return allOf(visibleTo(user), { $or: [{ visitDate: range }, { 'history.visitDate': range }] });
}

// A record's visits on or after `from` and before `to`.
const inRange = (from, to) => ({ visitDate }) => visitDate >= from && visitDate < to;
const visitsBetween = (record, from, to) => visitEvents(record).filter(inRange(from, to));

// One entry per month of the year, January to December, with the counts (zero when there is nothing).
// A doctor or pharmacy with several visits in one month counts once in that month.
router.get('/months', validate({ query: monthsQuery }), async (req, res) => {
  const { year } = req.valid.query;
  const start = startOfDhakaDay(`${year}-01-01`);
  const end = startOfDhakaDay(`${year + 1}-01-01`);

  // { "2026-10": 3, … } for one model, by the month in Dhaka time.
  async function countByMonth(Model) {
    const records = await Model.find(withVisitsBetween(req.user, start, end)).select(`status visitDate visitEndDate ${HISTORY}`).lean();
    const counts = {};
    for (const record of records) {
      const months = new Set(visitsBetween(record, start, end).map(({ visitDate }) => dhakaDay(visitDate).slice(0, 7)));
      for (const month of months) counts[month] = (counts[month] ?? 0) + 1;
    }
    return counts;
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
  const filter = withVisitsBetween(req.user, from, to);

  const [doctors, pharmacies] = await Promise.all([
    Doctor.find(filter).select(`${FIELDS} chamberName`).populate(PEOPLE).lean(),
    Pharmacy.find(filter).select(FIELDS).populate(PEOPLE).lean(),
  ]);

  const items = [
    ...doctors.flatMap((doctor) => calendarItems('doctor', doctor, doctor.chamberName || doctor.address, from, to)),
    ...pharmacies.flatMap((pharmacy) => calendarItems('pharmacy', pharmacy, pharmacy.name, from, to)),
  ].sort((a, b) => a.visitDate - b.visitDate);

  res.json({ data: items });
});

// Just what a calendar chip and the day list need, for each of the record's visits in the range.
function calendarItems(type, record, place, from, to) {
  const id = String(record._id);
  // An earlier visit shows how far the steps were at it; the current one, the checklist as it is now.
  return calendarVisits(record).filter(inRange(from, to)).map(({ status, visitDate, visitEndDate, steps, current }) => ({
    id,
    key: `${id}:${dhakaDay(visitDate)}`,
    type,
    name: record.name,
    place,
    address: record.address,
    status,
    current,
    now: { status: record.status, visitDate: record.visitDate, visitEndDate: record.visitEndDate ?? null },
    steps,
    visitDate,
    visitEndDate,
    phone: record.phone,
    createdBy: userRef(record.createdBy),
    assignedTo: (record.assignedTo ?? []).map(assigneeJson).map(({ id, name }) => ({ id, name })),
  }));
}

// { id, name }, or null when the person is unknown (for example, a deleted account).
const userRef = (person) => (person ? { id: String(person._id), name: person.name } : null);

export default router;
