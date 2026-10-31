export const rupees = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

// Opens WhatsApp with a ready message. Bare 10-digit numbers are treated as Indian.
export function waLink(phone, text) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = '91' + d;
  if (d.length < 11) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export function reminderText({ name, amount, monthsLabel, batchName }) {
  return (
    `Hello ${name}, a gentle reminder that the tuition fee of ${rupees(amount)} ` +
    `for ${monthsLabel} (${batchName}) is still pending. ` +
    `Please pay when you can. Thank you!`
  );
}

export const telLink = (phone) => {
  const d = String(phone || '').replace(/[^\d+]/g, '');
  return d ? `tel:${d}` : null;
};

// "name, phone" per line (comma, tab or semicolon separated). A header row is skipped.
export function parseStudents(text) {
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = line.split(/[,\t;]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    const name = cells[0];
    if (!name) continue;
    if (out.length === 0 && /^(student\s*)?name$/i.test(name)) continue;
    out.push({ name, phone: (cells[1] || '').replace(/[^\d+]/g, '') });
  }
  return out;
}

const esc = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export const toCsv = (rows) => rows.map((r) => r.map(esc).join(',')).join('\r\n');

export function download(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
