import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { backend, isDemo, supabase } from './lib/db';
import { currentMonth, monthsBetween } from './lib/dates';
import { dueList, monthView } from './lib/calc';
import Login from './components/Login';
import Overview from './components/Overview';
import Batches from './components/Batches';
import BatchDetail from './components/BatchDetail';
import Due from './components/Due';
import Report from './components/Report';
import PaymentSheet from './components/PaymentSheet';
import StudentSheet from './components/StudentSheet';
import BatchSheet from './components/BatchSheet';
import ImportSheet from './components/ImportSheet';
import { Icon } from './components/Icons';

export default function App() {
  // undefined = still checking the saved login
  const [session, setSession] = useState(isDemo ? { demo: true } : undefined);

  useEffect(() => {
    if (isDemo) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="center muted">Loading…</div>;
  if (!session) return <Login />;
  return <Register />;
}

function Register() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('overview');
  const [batchId, setBatchId] = useState(null);
  const [month, setMonth] = useState(currentMonth());
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const flash = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  const reload = useCallback(async () => {
    try {
      setData(await backend.load());
      setLoadError('');
    } catch (e) {
      setLoadError(e.message || String(e));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Run a write, refresh, and report. Returns true when it worked.
  const act = useCallback(
    async (fn, okMsg) => {
      try {
        await fn();
        await reload();
        if (okMsg) flash(okMsg);
        return true;
      } catch (e) {
        flash('Could not save: ' + (e.message || e));
        return false;
      }
    },
    [reload, flash],
  );

  const view = useMemo(() => (data ? monthView(data, month) : null), [data, month]);
  const dues = useMemo(() => (data ? dueList(data, month) : []), [data, month]);

  if (loadError) {
    return (
      <div className="center">
        <div className="stack" style={{ maxWidth: 360 }}>
          <h2>Could not load your data</h2>
          <p className="muted">{loadError}</p>
          <p className="muted">If this is a new Supabase project, check that supabase/schema.sql has been run.</p>
          <button className="btn" onClick={reload}>Try again</button>
        </div>
      </div>
    );
  }
  if (!data) return <div className="center muted">Loading…</div>;

  const close = () => setSheet(null);
  const closeAfter = (promise) => promise.then((ok) => {
    if (ok) close();
    return ok;
  });

  const goTab = (t) => {
    setTab(t);
    setBatchId(null);
  };
  const detail = batchId ? view.batches.find((b) => b.batch.id === batchId) : null;

  const openPay = (student, forMonth) => setSheet({ type: 'pay', studentId: student.id, month: forMonth });
  const newBatch = () => setSheet({ type: 'batch' });
  const addStudent = (defaultBatchId) => {
    if (!data.batches.length) return setSheet({ type: 'batch' });
    setSheet({ type: 'student', defaultBatchId });
  };

  let body;
  if (tab === 'due') {
    body = <Due list={dues} batches={data.batches} month={month} setMonth={setMonth} onPay={openPay} />;
  } else if (detail) {
    body = (
      <BatchDetail
        v={detail}
        month={month}
        setMonth={setMonth}
        onBack={() => setBatchId(null)}
        onPay={openPay}
        onEditStudent={(student) => setSheet({ type: 'student', student })}
        onEditBatch={() => setSheet({ type: 'batch', batch: detail.batch })}
        onAddStudent={() => addStudent(detail.batch.id)}
      />
    );
  } else if (tab === 'batches') {
    body = (
      <Batches
        view={view}
        onOpenBatch={setBatchId}
        onEditBatch={(batch) => setSheet({ type: 'batch', batch })}
        onNewBatch={newBatch}
      />
    );
  } else {
    body = (
      <>
        <Overview
          view={view}
          month={month}
          setMonth={setMonth}
          isDemo={isDemo}
          onOpenBatch={setBatchId}
          onNewBatch={newBatch}
          onImport={() => setSheet({ type: 'import' })}
          onReport={() => setSheet({ type: 'report' })}
          onSignOut={() => supabase.auth.signOut()}
        />
        {view.batches.length > 0 && (
          <div className="fabwrap">
            <button className="fab" aria-label="Add student" onClick={() => addStudent()}>
              <Icon.Plus width={24} height={24} strokeWidth={2} />
            </button>
          </div>
        )}
      </>
    );
  }

  // Sheets
  let sheetEl = null;
  if (sheet?.type === 'pay') {
    const student = data.students.find((s) => s.id === sheet.studentId);
    const batch = student && data.batches.find((b) => b.id === student.batch_id);
    if (student && batch) {
      const paidMap = new Map(data.payments.filter((p) => p.student_id === student.id).map((p) => [p.month, p]));
      const options = new Set(monthsBetween(student.joined_month, currentMonth()));
      options.add(sheet.month);
      paidMap.forEach((_p, m) => options.add(m));
      sheetEl = (
        <PaymentSheet
          student={student}
          batch={batch}
          month={sheet.month}
          monthOptions={[...options].sort()}
          paidMap={paidMap}
          onClose={close}
          onSave={(p) => closeAfter(act(() => backend.savePayment(p), 'Payment saved'))}
          onRemove={(id) => closeAfter(act(() => backend.removePayment(id), 'Marked as unpaid'))}
        />
      );
    }
  } else if (sheet?.type === 'student') {
    sheetEl = (
      <StudentSheet
        student={sheet.student}
        batches={data.batches}
        defaultBatchId={sheet.defaultBatchId}
        month={month}
        onClose={close}
        onSave={(s) => closeAfter(act(() => backend.saveStudent(s), s.id ? 'Student updated' : 'Student added'))}
      />
    );
  } else if (sheet?.type === 'batch') {
    sheetEl = (
      <BatchSheet
        batch={sheet.batch}
        onClose={close}
        onSave={(b) => closeAfter(act(() => backend.saveBatch(b), b.id ? 'Batch updated' : 'Batch created'))}
      />
    );
  } else if (sheet?.type === 'import') {
    sheetEl = (
      <ImportSheet
        batches={data.batches}
        students={data.students}
        defaultBatchId={batchId}
        onClose={close}
        onImport={(list) => closeAfter(act(() => backend.addStudents(list), `${list.length} students added`))}
      />
    );
  }

  return (
    <div className="app">
      {body}

      <nav className="nav" aria-label="Main">
        <button className={tab === 'overview' && !batchId ? 'on' : ''} onClick={() => goTab('overview')}>
          <Icon.Home width={22} height={22} /> Overview
        </button>
        <button className={tab === 'batches' || (batchId && tab !== 'due') ? 'on' : ''} onClick={() => goTab('batches')}>
          <Icon.List width={22} height={22} /> Batches
        </button>
        <button className={tab === 'due' ? 'on' : ''} onClick={() => goTab('due')}>
          <Icon.Clock width={22} height={22} /> Due
          {dues.length > 0 && <span className="badge" aria-label={`${dues.length} students due`}>{dues.length}</span>}
        </button>
      </nav>

      {sheetEl}
      {sheet?.type === 'report' && <Report view={view} month={month} onClose={close} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
