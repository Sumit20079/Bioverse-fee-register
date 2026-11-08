import { supabase } from './db';

const need = () => {
  if (!supabase) throw new Error('Tests need the online version');
};

export async function loadExams(batchId) {
  need();
  const { data, error } = await supabase.from('exams').select('*').eq('batch_id', batchId).order('held_on', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createExam(batchId, { name, total, held_on }) {
  need();
  const { data, error } = await supabase.from('exams').insert({ batch_id: batchId, name: name.trim(), total: Number(total), held_on }).select().single();
  if (error) throw error;
  return data;
}

export async function deleteExam(id) {
  need();
  const { error } = await supabase.from('exams').delete().eq('id', id);
  if (error) throw error;
}

export async function loadMarks(examId) {
  need();
  const { data, error } = await supabase.from('exam_marks').select('*').eq('exam_id', examId);
  if (error) throw error;
  return data;
}

export async function loadMarksFor(examIds) {
  if (!examIds.length) return [];
  const { data, error } = await supabase.from('exam_marks').select('exam_id,student_id,score,absent').in('exam_id', examIds);
  if (error) throw error;
  return data;
}

// rows: [{student_id, score|null, absent}] to keep; clearIds: students whose mark was cleared
export async function saveMarks(examId, rows, clearIds) {
  need();
  const { data: u } = await supabase.auth.getUser();
  if (rows.length) {
    const { error } = await supabase.from('exam_marks').upsert(
      rows.map((r) => ({ owner_id: u.user.id, exam_id: examId, student_id: r.student_id, score: r.absent ? null : r.score, absent: !!r.absent })),
      { onConflict: 'exam_id,student_id' },
    );
    if (error) throw error;
  }
  if (clearIds.length) {
    const { error } = await supabase.from('exam_marks').delete().eq('exam_id', examId).in('student_id', clearIds);
    if (error) throw error;
  }
}

export async function sendResults(examId) {
  const { data } = await supabase.auth.getSession();
  const r = await fetch('/api/results', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token}` }, body: JSON.stringify({ exam_id: examId }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server said ${r.status}`);
  return j;
}

export async function getResultsAuto() {
  const { data } = await supabase.from('reminder_settings').select('results_auto').maybeSingle();
  return !!data?.results_auto;
}
export async function setResultsAuto(on) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('reminder_settings').upsert({ owner_id: u.user.id, results_auto: on }, { onConflict: 'owner_id' });
  if (error) throw error;
}
