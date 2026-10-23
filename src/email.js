import nodemailer from 'nodemailer';

import { env } from './config.js';

// Email, over SMTP (Gmail, Google Workspace, Brevo…: the SMTP_* settings in .env decide which).
// Only one kind of email so far: "you were assigned to this form", with the whole form in it.
// Without SMTP settings nothing is sent and the API says so in its answer, so it works everywhere.

const STATUS_LABELS = { ongoing: 'Ongoing', setup: 'Setup', implementation: 'Implementation', support: 'Support' };
const TYPE_LABELS = { doctor: 'Doctor', pharmacy: 'Pharmacy' };
const TYPE_PATHS = { doctor: '/doctors', pharmacy: '/pharmacies' };

let transport = null;
function mailer() {
  transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // 465 is TLS from the start; 587 upgrades to TLS (STARTTLS)
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transport;
}

// Emails each newly assigned teammate the full form. Never throws: the result says who got the
// email and who didn't, so the admin can be told ("Assigned, but the email to Rafi failed").
//   → { configured, sent: [names], failed: [names] }
export async function sendAssignmentEmails({ record, type, assignees, assignedBy }) {
  const report = { configured: env.emailEnabled, sent: [], failed: [] };
  if (!env.emailEnabled) {
    if (assignees.length > 0) console.warn('⚠ Email is not set up (SMTP_* in .env), so no assignment email was sent.');
    return report;
  }

  const results = await Promise.allSettled(
    assignees.map((person) => mailer().sendMail(assignmentEmail({ record, type, person, assignedBy }))),
  );
  results.forEach((result, index) => {
    const { name } = assignees[index];
    if (result.status === 'fulfilled') report.sent.push(name);
    else {
      report.failed.push(name);
      console.error(`✖ Could not email ${name}: ${result.reason?.message ?? result.reason}`);
    }
  });
  return report;
}

// ---------------------------------------------------------------------------
// The email itself
// ---------------------------------------------------------------------------
function assignmentEmail({ record, type, person, assignedBy }) {
  const kind = TYPE_LABELS[type];
  const visit = formatVisit(record.visitDate);
  const link = `${env.appUrl}${TYPE_PATHS[type]}/${record._id}`;
  const rows = [
    ...formRows(type, record),
    ['Status', STATUS_LABELS[record.status] ?? record.status],
    ['Visit', visit],
    ['Notes', record.notes],
    ['Implementation steps', record.implementationSteps.map((step) => `${step.done ? '☑' : '☐'} ${step.title}`).join('\n')],
    ['Submitted by', personLine(record.createdBy)],
    ['Assigned by', personLine(assignedBy)],
  ].filter(([, value]) => value); // leave out empty fields

  return {
    from: env.EMAIL_FROM,
    to: `"${person.name}" <${person.email}>`,
    replyTo: assignedBy.email,
    subject: `Assigned to you: ${record.name} (${kind}) · visit ${visit}`,
    text: textBody({ person, assignedBy, kind, record, rows, link }),
    html: htmlBody({ person, assignedBy, kind, record, rows, link }),
  };
}

function textBody({ person, assignedBy, kind, record, rows, link }) {
  const lines = rows.map(([label, value]) => `${label}: ${value}`);
  return [
    `Hi ${firstName(person.name)},`,
    '',
    `${assignedBy.name} assigned you to the ${kind.toLowerCase()} onboarding of ${record.name}.`,
    '',
    ...lines,
    '',
    `Open it in the tracker: ${link}`,
    '',
    'PharmaZ247 Tracker',
  ].join('\n');
}

function htmlBody({ person, assignedBy, kind, record, rows, link }) {
  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top">${escape(label)}</td>` +
        `<td style="padding:6px 0;color:#111827;white-space:pre-line">${escape(value)}</td></tr>`,
    )
    .join('');

  return `<!doctype html>
<html><body style="margin:0;background:#f5f6fa;font-family:Segoe UI,Arial,sans-serif;color:#111827">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <p style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:.08em;color:#1e2a5e">PHARMAZ 24/7 TRACKER</p>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px">
      <p style="margin:0 0 12px">Hi ${escape(firstName(person.name))},</p>
      <p style="margin:0 0 20px">
        <strong>${escape(assignedBy.name)}</strong> assigned you to the ${escape(kind.toLowerCase())} onboarding of
        <strong>${escape(record.name)}</strong>.
      </p>
      <table style="border-collapse:collapse;font-size:14px;width:100%">${tableRows}</table>
      <p style="margin:24px 0 0">
        <a href="${escape(link)}" style="display:inline-block;background:#1e2a5e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open in the tracker</a>
      </p>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#6b7280">Reply to this email to reach ${escape(assignedBy.name)}.</p>
  </div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// The form's fields, numbered as on the paper form, with values in words
// ---------------------------------------------------------------------------
const CONSULTATION_TYPES = { in_person: 'In-Person', teleconsultation: 'Teleconsultation' };
const PAYMENT_METHODS = { cash: 'Cash', bkash: 'bKash', nagad: 'Nagad', card: 'Card' };
const DAY_LABELS = { sat: 'Sat', sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' };

function formRows(type, record) {
  if (type === 'doctor') {
    return [
      ['1. Full Name', record.name],
      ['3. BMDC Reg. No.', record.bmdcRegNo],
      ['4. Phone No', formatPhone(record.phone)],
      ['5. Email', record.email],
      ['6. Chamber Name', record.chamberName],
      ['7. Chamber Address', `${record.address}\n${mapsLink(record.address)}`],
      ['8. Consultation Type', record.consultationTypes.map((value) => CONSULTATION_TYPES[value] ?? value).join(', ')],
      ['9. Chamber No.', record.chamberNo],
      ['10. Slot Duration', record.slotDuration ? `${record.slotDuration} mins` : ''],
      ['11. Available Days & Time', formatAvailability(record)],
      ['12. First Visit', formatTaka(record.fees?.firstVisit)],
      ['13. Report View', formatTaka(record.fees?.reportView)],
      ['14. 2nd Visit (within 1 mo.)', formatTaka(record.fees?.secondVisit)],
      ['15. After 1 mo.', formatTaka(record.fees?.afterOneMonth)],
    ];
  }
  return [
    ['1. Pharmacy Name', record.name],
    ['3. Owner Name', record.ownerName],
    ['4. Phone No', formatPhone(record.phone)],
    ['5. Email', record.email],
    ['6. Drug License No.', record.drugLicenseNo],
    ['7. Trade License No.', record.tradeLicenseNo],
    ['8. Address', `${record.address}\n${mapsLink(record.address)}`],
    ['9. Area / Thana', record.area],
    ['10. District', record.district],
    ['11. Opening Days & Time', formatAvailability(record)],
    ['12. Home Delivery', yesOrNo(record.homeDelivery)],
    ['13. Payment Methods', record.paymentMethods.map((value) => PAYMENT_METHODS[value] ?? value).join(', ')],
  ];
}

// ---------------------------------------------------------------------------
// Small formatters (the web app has the same ones in lib/format.js)
// ---------------------------------------------------------------------------
const firstName = (name = '') => name.trim().split(/\s+/)[0] ?? '';
const mapsLink = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
const personLine = (person) => (person ? [person.name, formatPhone(person.phone)].filter(Boolean).join(' · ') : '');

function yesOrNo(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '';
}

// +8801711234567 → +880 1711-234567
function formatPhone(phone) {
  const match = /^\+880(\d{4})(\d{6})$/.exec(phone ?? '');
  return match ? `+880 ${match[1]}-${match[2]}` : (phone ?? '');
}

const formatTaka = (amount) => (amount === null || amount === undefined ? '' : `৳${new Intl.NumberFormat('en-IN').format(amount)}`);

// "Thu 29 Oct 2026, 4:00 PM" in Dhaka time
function formatVisit(date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date));
}

// "17:00" → "5:00 PM"
function formatTime(time) {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

// Days + hours → "Sat, Mon, Wed · 5:00 PM – 9:00 PM"
function formatAvailability({ availableDays = [], availableFrom, availableTo }) {
  const days = availableDays.map((day) => DAY_LABELS[day] ?? day).join(', ');
  const hours = availableFrom && availableTo ? `${formatTime(availableFrom)} – ${formatTime(availableTo)}` : formatTime(availableFrom || availableTo);
  return [days, hours].filter(Boolean).join(' · ');
}

// Text that goes into HTML must not be read as HTML.
function escape(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
