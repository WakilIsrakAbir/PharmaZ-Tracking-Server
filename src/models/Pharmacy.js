import mongoose from 'mongoose';
import { z } from 'zod';

import { DAYS, PHARMACY_TYPES, optionalEmail, optionalPhone, optionalText, optionalTime } from '../utils.js';
import { recordOptions, trackingFields, trackingInput } from './shared.js';

const PAYMENT_METHODS = ['cash', 'bkash', 'nagad', 'card'];

// The "Pharmacy Onboarding Form" (draft: there is no paper version yet).
const pharmacySchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },                     // 1  Pharmacy Name
    pharmacyType: { type: String, enum: PHARMACY_TYPES, default: 'single' }, // 2  Pharmacy Type (Single / Chain)
    ownerName: { type: String, trim: true, default: '' },                // 3  Owner Name
    phone: { type: String, trim: true, default: '' },                    // 4  Phone No
    email: { type: String, trim: true, default: '' },                    // 5  Email
    drugLicenseNo: { type: String, trim: true, default: '' },            // 6  Drug License No.
    drugLicenseIssueDate: { type: Date, default: null },                 //     Issue Date
    drugLicenseExpireDate: { type: Date, default: null },                //     Expire Date
    tradeLicenseNo: { type: String, trim: true, default: '' },           // 7  Trade License No.
    address: { type: String, trim: true, default: '' },                  // 8  Address
    area: { type: String, trim: true, default: '' },                     // 9  Area / Thana
    district: { type: String, trim: true, default: '' },                 // 10 District
    availableDays: [{ type: String, enum: DAYS }],                       // 11 Opening Days & Time
    availableFrom: { type: String, default: '' },
    availableTo: { type: String, default: '' },
    homeDelivery: { type: Boolean, default: null },                      // 12 Home Delivery
    paymentMethods: [{ type: String, enum: PAYMENT_METHODS }],           // 13 Payment Methods
    ...trackingFields,
  },
  recordOptions('pharmacy'),
);

export const Pharmacy = mongoose.model('Pharmacy', pharmacySchema);
Pharmacy.searchFields = ['name', 'ownerName', 'drugLicenseNo', 'address', 'area', 'district'];

// What the form may send. All onboarding fields are optional.
export const pharmacyInput = z.object({
  name: optionalText(120),
  pharmacyType: z.enum(PHARMACY_TYPES).default('single'),
  ownerName: optionalText(120),
  phone: optionalPhone,
  email: optionalEmail,
  drugLicenseNo: optionalText(40),
  drugLicenseIssueDate: z.preprocess((val) => (val === '' || val === undefined ? null : val), z.coerce.date().nullable().optional()),
  drugLicenseExpireDate: z.preprocess((val) => (val === '' || val === undefined ? null : val), z.coerce.date().nullable().optional()),
  tradeLicenseNo: optionalText(40),
  address: optionalText(300),
  area: optionalText(80),
  district: optionalText(80),
  availableDays: z.array(z.enum(DAYS)).default([]),
  availableFrom: optionalTime,
  availableTo: optionalTime,
  homeDelivery: z.preprocess((value) => (value === '' || value === undefined ? null : value), z.boolean().nullable()),
  paymentMethods: z.array(z.enum(PAYMENT_METHODS)).default([]),
  ...trackingInput,
});
