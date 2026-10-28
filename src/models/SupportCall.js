import mongoose from 'mongoose';
import { z } from 'zod';

import { CALLER_TYPES, CALL_STATUSES, CALL_STATUS_MESSAGE, optionalText, phoneField, requiredText } from '../utils.js';

// One call to the support team from a doctor or a pharmacy that is already live: who called, what
// the problem is, whether it is solved, and which support person logged it.
const supportCallSchema = new mongoose.Schema(
  {
    callerType: { type: String, enum: CALLER_TYPES, required: true, index: true }, // a doctor or a pharmacy
    callerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    problemTitle: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: CALL_STATUSES, default: 'open', index: true },
    resolvedAt: { type: Date, default: null },                                      // when it became resolved
    calledAt: { type: Date, required: true, index: true },                          // when the call came in
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true }, // who logged it
  },
  {
    timestamps: true,
    toJSON: { versionKey: false, transform: (doc, { _id, ...call }) => ({ id: String(_id), ...call }) },
  },
);

export const SupportCall = mongoose.model('SupportCall', supportCallSchema);
SupportCall.searchFields = ['callerName', 'problemTitle']; // (the phone number is searched by its digits too)

// What the form may send. Required: who called, their name and phone, and the problem title.
export const supportCallInput = z.object({
  callerType: z.enum(CALLER_TYPES, { error: 'Please say whether a doctor or a pharmacy called.' }),
  callerName: requiredText('Please enter the name of who called.'),
  phone: phoneField,
  problemTitle: requiredText('Please describe the problem in a few words.'),
  description: optionalText(2000),
  status: z.enum(CALL_STATUSES, { error: CALL_STATUS_MESSAGE }).default('open'),
  calledAt: z.coerce.date({ error: 'Please pick when the call came in.' }).optional(), // now, when left out
});
