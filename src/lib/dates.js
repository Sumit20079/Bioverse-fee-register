// Months are handled as 'YYYY-MM' strings. They sort correctly as plain strings.

export const pad = (n) => String(n).padStart(2, '0');

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const currentMonth = () => todayISO().slice(0, 7);

export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

export function monthsBetween(from, to) {
  const out = [];
  for (let k = from; k <= to && out.length < 240; k = addMonths(k, 1)) out.push(k);
  return out;
}

const dateOf = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
};

export const monthLabel = (key) => dateOf(key).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthShort = (key) => SHORT[Number(key.split('-')[1]) - 1];

export function dateLabel(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function longDateLabel(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// "Oct", "Sep + Oct", "Aug – Oct · 3 months"
export function monthsText(months) {
  if (months.length === 1) return monthShort(months[0]);
  if (months.length === 2) return `${monthShort(months[0])} + ${monthShort(months[1])}`;
  return `${monthShort(months[0])} – ${monthShort(months[months.length - 1])} · ${months.length} months`;
}
