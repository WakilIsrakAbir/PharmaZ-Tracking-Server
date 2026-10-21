import mongoose from 'mongoose';
import { z } from 'zod';

import { DAYS, optionalEmail, optionalTaka, optionalText, optionalTime, phoneField, requiredText } from '../utils.js';
import { recordOptions, trackingFields, trackingInput } from './shared.js';

const CONSULTATION_TYPES = ['in_person', 'teleconsultation'];
const SLOT_DURATIONS = [10, 15, 20, 30, 45, 60];   // minutes

// The paper "Doctor Onboarding Form", field by field (the numbers match the paper).
const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },                  // 1  Full Name
    //                                                                      2  Doctor Picture → photo
    bmdcRegNo: { type: String, trim: true, default: '' },                // 3  BMDC Reg. No.
    phone: { type: String, required: true },                             // 4  Phone No
    email: { type: String, trim: true, default: '' },                    // 5  Email
    chamberName: { type: String, trim: true, default: '' },              // 6  Chamber Name
    address: { type: String, required: true, trim: true },               // 7  Chamber Address
    consultationTypes: [{ type: String, enum: CONSULTATION_TYPES }],     // 8  Consultation Type
    chamberNo: { type: String, trim: true, default: '' },                // 9  Chamber No.
    slotDuration: { type: Number, default: null },                       // 10 Slot Duration (minutes)
    availableDays: [{ type: String, enum: DAYS }],                       // 11 Available Days & Time
    availableFrom: { type: String, default: '' },                        //    e.g. "17:00"
    availableTo: { type: String, default: '' },                          //    e.g. "21:00"
    fees: {                                                              // 12–15, in taka
      firstVisit: { type: Number, default: null },                       // 12 First Visit
      reportView: { type: Number, default: null },                       // 13 Report View
      secondVisit: { type: Number, default: null },                      // 14 2nd Visit (within 1 mo.)
      afterOneMonth: { type: Number, default: null },                    // 15 After 1 mo.
    },
    ...trackingFields,
  },
  recordOptions('doctor'),
);

export const Doctor = mongoose.model('Doctor', doctorSchema);
Doctor.searchFields = ['name', 'bmdcRegNo', 'chamberName', 'address', 'email'];

// What the form may send. Required: name, phone, chamber address, visit date.
export const doctorInput = z.object({
  name: requiredText("Please enter the doctor's full name."),
  bmdcRegNo: optionalText(30),
  phone: phoneField,
  email: optionalEmail,
  chamberName: optionalText(120),
  address: requiredText('Please enter the chamber address.', 300),
  consultationTypes: z.array(z.enum(CONSULTATION_TYPES)).default([]),
  chamberNo: optionalText(40),
  slotDuration: z.preprocess(
    (value) => (value === '' || value === undefined ? null : Number(value)),
    z.number().refine((value) => SLOT_DURATIONS.includes(value), 'Choose 10, 15, 20, 30, 45 or 60 minutes.').nullable(),
  ),
  availableDays: z.array(z.enum(DAYS)).default([]),
  availableFrom: optionalTime,
  availableTo: optionalTime,
  fees: z
    .object({ firstVisit: optionalTaka, reportView: optionalTaka, secondVisit: optionalTaka, afterOneMonth: optionalTaka })
    .default({ firstVisit: null, reportView: null, secondVisit: null, afterOneMonth: null }),
  ...trackingInput,
});
