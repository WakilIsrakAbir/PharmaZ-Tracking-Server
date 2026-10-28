import { Router } from 'express';
import { z } from 'zod';

import { ApiError, validate } from '../middleware/errors.js';
import { User, withCreator } from '../models/User.js';
import { allOf } from '../models/shared.js';
import {
  ROLES,
  emailField,
  generateTemporaryPassword,
  hashPassword,
  objectId,
  pageMeta,
  pageQuery,
  personName,
  phoneField,
  searchFilter,
} from '../utils.js';

// /api/v1/users: admins only (see app.js). This is the only way to create accounts.
//
//   GET    /                    one page of the team (?page= ?limit=), filtered (?search= ?role= ?active=) and sorted (?sort=)
//   POST   /                    add a teammate
//   PATCH  /:id                 edit, change role, deactivate / reactivate
//   POST   /:id/reset-password  new temporary password
const router = Router();

const role = z.enum(ROLES, { error: 'Role must be admin or marketing.' });
const idParams = z.object({ id: objectId });

const listQuery = z.object({
  search: z.string().trim().max(80).optional(),
  role: role.optional(),
  active: z.stringbool({ error: 'Active must be true or false.' }).optional(),
  sort: z.enum(['name', 'last_login', 'newest'], { error: 'Sort must be name, last_login or newest.' }).default('name'),
  ...pageQuery,
});

const SORTS = {
  name: { name: 1, _id: 1 }, // A to Z (the default)
  last_login: { lastLoginAt: -1, name: 1 }, // the most recent sign-in first; people who never signed in last
  newest: { createdAt: -1, _id: -1 }, // the latest account first
};

// Name, email and phone are all required: the name and phone are shown on every form the person submits.
const createBody = z.object({
  name: personName,
  email: emailField,
  phone: phoneField,
  role: role.default('marketing'),
});

// The phone can be changed but not removed.
const updateBody = z
  .object({ name: personName, phone: phoneField, role, isActive: z.boolean({ error: 'isActive must be true or false.' }) })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, { error: 'Send at least one field to change.' });

async function findUser(id) {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "We couldn't find that teammate.");
  return user;
}

// One page of the team. `meta.counts` says how many are active and deactivated: it follows the
// search and the role but not `active`, so both tabs above the list keep their numbers.
router.get('/', validate({ query: listQuery }), async (req, res) => {
  const { search, active, sort, page, limit } = req.valid.query;
  const anyStatus = allOf(req.valid.query.role ? { role: req.valid.query.role } : {}, searchFilter(search, ['name', 'email']));
  const filter = active === undefined ? anyStatus : allOf(anyStatus, { isActive: active });

  const [users, activeCount, everyoneCount] = await Promise.all([
    User.find(filter)
      .collation({ locale: 'en', strength: 2 })
      .sort(SORTS[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name'),
    User.countDocuments(allOf(anyStatus, { isActive: true })),
    User.countDocuments(anyStatus),
  ]);

  const counts = { active: activeCount, deactivated: everyoneCount - activeCount };
  const total = active === undefined ? everyoneCount : active ? counts.active : counts.deactivated;
  res.json({ data: users, meta: { counts, ...pageMeta(req.valid.query, total) } });
});

// Add a teammate. They get a temporary password (returned once) and choose their own at first sign-in.
router.post('/', validate({ body: createBody }), async (req, res) => {
  const input = req.valid.body;
  if (await User.exists({ email: input.email })) {
    throw new ApiError(409, 'Someone on the team already uses this email.', {
      code: 'EMAIL_TAKEN',
      fields: { email: 'This email is already in use.' },
    });
  }

  const temporaryPassword = generateTemporaryPassword();
  const user = await User.create({
    ...input,
    passwordHash: await hashPassword(temporaryPassword),
    mustChangePassword: true,
    createdBy: req.user._id,
  });

  res.status(201).json({ data: { user: await withCreator(user), temporaryPassword } });
});

// Edit name / phone / role, or deactivate / reactivate.
// Admins can't deactivate themselves or change their own role, so there is always an active admin.
router.patch('/:id', validate({ params: idParams, body: updateBody }), async (req, res) => {
  const changes = req.valid.body;
  const user = await findUser(req.valid.params.id);
  const changesOwnAccess = changes.isActive === false || (changes.role && changes.role !== user.role);

  if (user.id === req.user.id && changesOwnAccess) {
    throw new ApiError(400, "You can't deactivate your own account or change your own role.", { code: 'SELF_CHANGE' });
  }

  Object.assign(user, changes);
  if (changes.isActive === false) user.sessionVersion += 1;   // signs them out everywhere
  await user.save();

  res.json({ data: await withCreator(user) });
});

// New temporary password; the old password's sessions stop working.
router.post('/:id/reset-password', validate({ params: idParams }), async (req, res) => {
  const user = await findUser(req.valid.params.id);
  if (user.id === req.user.id) {
    throw new ApiError(400, 'To change your own password, use Account → Change password.', { code: 'SELF_CHANGE' });
  }

  const temporaryPassword = generateTemporaryPassword();
  user.passwordHash = await hashPassword(temporaryPassword);
  user.mustChangePassword = true;
  user.sessionVersion += 1;
  await user.save();

  res.json({ data: { user: await withCreator(user), temporaryPassword } });
});

export default router;
