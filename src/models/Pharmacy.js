import mongoose from 'mongoose';
import { z } from 'zod';

import { DAYS, optionalEmail, optionalText, optionalTime, phoneField, requiredText } from '../utils.js';
import { recordOptions, trackingFields, trackingInput } from './shared.js';

const PAYMENT_METHODS = ['cash', 'bkash', 'nagad', 'card'];

// The "Pharmacy Onboarding Form" (draft: there is no paper version yet).
const pharmacySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },                  // 1  Pharmacy Name
    //                                                                      2  Shop Photo: not kept (the tracker has no photos)
    ownerName: { type: String, trim: true, default: '' },                // 3  Owner Name
    phone: { type: String, required: true },                             // 4  Phone No
    email: { type: String, trim: true, default: '' },                    // 5  Email
    drugLicenseNo: { type: String, trim: true, default: '' },            // 6  Drug License No.
    tradeLicenseNo: { type: String, trim: true, default: '' },           // 7  Trade License No.
    address: { type: String, required: true, trim: true },               // 8  Address
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

// What the form may send. Required: name, phone, address, visit date.
export const pharmacyInput = z.object({
  name: requiredText('Please enter the pharmacy name.'),
  ownerName: optionalText(120),
  phone: phoneField,
  email: optionalEmail,
  drugLicenseNo: optionalText(40),
  tradeLicenseNo: optionalText(40),
  address: requiredText('Please enter the pharmacy address.', 300),
  area: optionalText(80),
  district: optionalText(80),
  availableDays: z.array(z.enum(DAYS)).default([]),
  availableFrom: optionalTime,
  availableTo: optionalTime,
  homeDelivery: z.preprocess((value) => (value === '' || value === undefined ? null : value), z.boolean().nullable()),
  paymentMethods: z.array(z.enum(PAYMENT_METHODS)).default([]),
  ...trackingInput,
});
