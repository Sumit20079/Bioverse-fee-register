// Marks for one test. Absent students (and blanks) are left out of the average and the rank.
// Ranks share a place on a tie (1, 2, 2, 4).
export function examStats(marks) {
  const scored = marks.filter((m) => !m.absent && m.score !== null && m.score !== undefined && m.score !== '' && Number.isFinite(Number(m.score))).map((m) => ({ id: m.student_id, score: Number(m.score) }));
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const rank = new Map();
  sorted.forEach((m, i) => rank.set(m.id, i > 0 && sorted[i - 1].score === m.score ? rank.get(sorted[i - 1].id) : i + 1));
  const sum = scored.reduce((t, m) => t + m.score, 0);
  return { count: scored.length, average: scored.length ? sum / scored.length : 0, highest: scored.length ? sorted[0].score : 0, rank };
}

export const pct = (score, total) => Math.round((Number(score) / Number(total)) * 1000) / 10;
export const num = (n) => String(Math.round(Number(n) * 100) / 100);
