import { useState } from 'react';
import Sheet from './Sheet';

const CLASSES = ['5', '6', '7', '8', '9', '10', '11', '12', 'Dropper', '11+NEET', '12+NEET'];
const BOARDS = ['ICSE', 'CBSE', 'WBBSE', 'WBCHSE', 'Other'];
const GENDERS = ['Male', 'Female', 'Other'];
const LOCATIONS = ['Habra', 'Jaguli', 'Haringhata', 'Gobardanga', 'Nahata'];
const REFERRED = ['Teacher', 'Student', 'Friend', 'Senior', 'Social media', 'Other'];
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const ten = (s) => {
  let d = String(s || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
};
const phoneOk = (s) => /^[0-9]{10}$/.test(ten(s));
const orNull = (s) => (String(s ?? '').trim() ? String(s).trim() : null);

export default function ApplicationEdit({ app: a, onSave, onClose }) {
  const [f, setF] = useState({
    student_name: a.student_name || '',
    gender: a.gender,
    class: a.class,
    school: a.school || '',
    board: a.board,
    student_phone: a.student_phone || '',
    student_email: a.student_email || '',
    address: a.address || '',
    blood_group: a.blood_group || '',
    hobby: a.hobby || '',
    father_name: a.father_name || '',
    father_phone: a.father_phone || '',
    father_profession: a.father_profession || '',
    mother_name: a.mother_name || '',
    mother_phone: a.mother_phone || '',
    mother_profession: a.mother_profession || '',
    main_contact: a.main_contact,
    result_obtained: String(Number(a.result_obtained)),
    result_total: String(Number(a.result_total)),
    batch_location: a.batch_location,
    result_expectation: a.result_expectation || '',
    referred_from: a.referred_from,
    wants_counselling: a.wants_counselling,
    wants_scholarship: a.wants_scholarship,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const problem = () => {
    if (f.student_name.trim().length < 2) return 'Enter the student’s name.';
    if (!f.school.trim()) return 'Enter the school.';
    if (!phoneOk(f.student_phone)) return 'The student’s phone must be 10 digits.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.student_email.trim())) return 'Enter a valid email address.';
    if (!f.address.trim()) return 'Enter the address.';
    if (!f.father_name.trim() && !f.mother_name.trim()) return 'At least one parent’s name is needed.';
    if (f.father_phone.trim() && !phoneOk(f.father_phone)) return 'The father’s phone must be 10 digits.';
    if (f.mother_phone.trim() && !phoneOk(f.mother_phone)) return 'The mother’s phone must be 10 digits.';
    const main = f.main_contact === 'father' ? 'father' : 'mother';
    if (!f[`${main}_name`].trim() || !phoneOk(f[`${main}_phone`])) return `The main contact (${main}) needs a name and a 10-digit phone number.`;
    const o = Number(f.result_obtained);
    const t = Number(f.result_total);
    if (!Number.isFinite(o) || !Number.isFinite(t) || t <= 0 || o < 0) return 'Enter the marks and the total marks.';
    if (o > t) return 'Marks obtained can’t be more than the total.';
    return '';
  };

  const save = async (e) => {
    e.preventDefault();
    const p = problem();
    setErr(p);
    if (p) return;
    setBusy(true);
    const ok = await onSave({
      student_name: f.student_name.trim(),
      gender: f.gender,
      class: f.class,
      school: f.school.trim(),
      board: f.board,
      student_phone: ten(f.student_phone),
      student_email: f.student_email.trim(),
      address: f.address.trim(),
      blood_group: f.blood_group || null,
      hobby: orNull(f.hobby),
      father_name: orNull(f.father_name),
      father_phone: f.father_phone.trim() ? ten(f.father_phone) : null,
      father_profession: orNull(f.father_profession),
      mother_name: orNull(f.mother_name),
      mother_phone: f.mother_phone.trim() ? ten(f.mother_phone) : null,
      mother_profession: orNull(f.mother_profession),
      main_contact: f.main_contact,
      result_obtained: Number(f.result_obtained),
      result_total: Number(f.result_total),
      batch_location: f.batch_location,
      result_expectation: orNull(f.result_expectation),
      referred_from: f.referred_from,
      wants_counselling: f.wants_counselling,
      wants_scholarship: f.wants_scholarship,
    });
    if (!ok) setBusy(false);
  };

  const text = (id, label, extra = {}) => (
    <div className="field">
      <label htmlFor={`ae-${id}`}>{label}</label>
      <input id={`ae-${id}`} value={f[id]} onChange={set(id)} {...extra} />
    </div>
  );
  const select = (id, label, list) => (
    <div className="field">
      <label htmlFor={`ae-${id}`}>{label}</label>
      <select id={`ae-${id}`} value={f[id]} onChange={set(id)}>
        {id === 'blood_group' && <option value="">Not given</option>}
        {list.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );

  return (
    <Sheet title="Edit details" subtitle={`${a.admission_id}. Careers can’t be edited here.`} onClose={onClose}>
      <form className="stack" style={{ gap: 16 }} onSubmit={save}>
        {text('student_name', 'Student name')}
        {select('gender', 'Gender', GENDERS)}
        {select('class', 'Class', CLASSES)}
        {text('school', 'School')}
        {select('board', 'Board', BOARDS)}
        {text('student_phone', 'Student WhatsApp number', { type: 'tel', inputMode: 'tel' })}
        {text('student_email', 'Student email', { type: 'email' })}
        <div className="field">
          <label htmlFor="ae-address">Address</label>
          <textarea id="ae-address" rows={3} value={f.address} onChange={set('address')} />
        </div>
        {select('blood_group', 'Blood group', BLOOD)}
        {text('hobby', 'Hobby')}

        {text('father_name', 'Father’s name')}
        {text('father_phone', 'Father’s phone', { type: 'tel', inputMode: 'tel' })}
        {text('father_profession', 'Father’s profession')}
        {text('mother_name', 'Mother’s name')}
        {text('mother_phone', 'Mother’s phone', { type: 'tel', inputMode: 'tel' })}
        {text('mother_profession', 'Mother’s profession')}
        <div className="field">
          <label htmlFor="ae-main">Main contact</label>
          <select id="ae-main" value={f.main_contact} onChange={set('main_contact')}>
            <option value="father">Father</option>
            <option value="mother">Mother</option>
          </select>
        </div>

        {text('result_obtained', 'Marks obtained', { type: 'number', inputMode: 'decimal', step: 'any' })}
        {text('result_total', 'Out of', { type: 'number', inputMode: 'decimal', step: 'any' })}
        {text('result_expectation', 'Expected result')}
        {select('batch_location', 'Preferred batch location', LOCATIONS)}
        {select('referred_from', 'Referred from', REFERRED)}
        <label className="check">
          <input type="checkbox" checked={f.wants_counselling} onChange={(e) => setF((p) => ({ ...p, wants_counselling: e.target.checked }))} />
          Wants career counselling
        </label>
        <label className="check">
          <input type="checkbox" checked={f.wants_scholarship} onChange={(e) => setF((p) => ({ ...p, wants_scholarship: e.target.checked }))} />
          Wants the scholarship test
        </label>

        {err && (
          <p className="notice" role="alert">
            {err}
          </p>
        )}
        <button className="btn" disabled={busy}>
          Save changes
        </button>
      </form>
    </Sheet>
  );
}
