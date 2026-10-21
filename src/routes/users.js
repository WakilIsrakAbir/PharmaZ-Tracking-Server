import { Router } from 'express';
import { z } from 'zod';

import { ApiError, validate } from '../middleware/errors.js';
import { User, withCreator } from '../models/User.js';
import { ROLES, emailField, generateTemporaryPassword, hashPassword, objectId, personName, phoneField } from '../utils.js';

// /api/v1/users: admins only (see server.js). This is the only way to create accounts.
const router = Router();

const role = z.enum(ROLES, { error: 'Role must be admin or marketing.' });
const idParams = z.object({ id: objectId });

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

// The whole team, active people first. The team is small, so the web app searches and filters it itself.
router.get('/', async (req, res) => {
  res.json({ data: await User.find().sort({ isActive: -1, name: 1 }).populate('createdBy', 'name') });
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
