import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { backend, isDemo, supabase } from './lib/db';
import { currentMonth, longDateLabel, monthLabel, monthsBetween } from './lib/dates';
import { dueList, monthView } from './lib/calc';
import { receiptContact, receiptText, waLink } from './lib/format';
import Login from './components/Login';
import Overview from './components/Overview';
import Batches from './components/Batches';
import BatchDetail from './components/BatchDetail';
import Due from './components/Due';
import Search from './components/Search';
import StudentHistory from './components/StudentHistory';
import Report from './components/Report';
import PaymentSheet from './components/PaymentSheet';
import StudentSheet from './components/StudentSheet';
import BatchSheet from './components/BatchSheet';
import ImportSheet from './components/ImportSheet';
import BulkDeleteSheet from './components/BulkDeleteSheet';
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
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // `action` is an optional { label, href } link shown inside the toast (e.g. send a receipt).
  const flash = useCallback((msg, action) => {
    setToast({ msg, action });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), action ? 8000 : 2600);
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
  // Writes run one at a time, in order, so a quick second tap can't be overwritten by the
  // refresh from the first. A failed write reloads from the server, undoing any instant change.
  const queue = useRef(Promise.resolve());
  const act = useCallback(
    (fn, okMsg) => {
      const run = queue.current.then(async () => {
        try {
          await fn();
          await reload();
          if (okMsg) flash(okMsg);
          return true;
        } catch (e) {
          flash('Could not save: ' + (e.message || e));
          await reload();
          return false;
        }
      });
      queue.current = run;
      return run;
    },
    [reload, flash],
  );

  // Pick up changes made on other devices when this one is switched back to (and every minute
  // while open). It waits behind any pending save, and a failed refresh is ignored quietly
  // so a weak connection never replaces the screen with an error.
  useEffect(() => {
    let last = Date.now();
    const refresh = (force) => {
      if (document.visibilityState !== 'visible') return;
      if (!force && Date.now() - last < 5000) return;
      last = Date.now();
      queue.current = queue.current.then(async () => {
        try {
          setData(await backend.load());
        } catch {
          /* ignore */
        }
      });
    };
    const onShow = () => refresh(false);
    const timer = setInterval(() => refresh(true), 60000);
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
    };
  }, []);

  // Show a payment change on screen straight away; the server catches up behind it.
  const showPayment = useCallback((p) => {
    setData((d) => {
      const prev = d.payments.find((x) => x.student_id === p.student_id && x.month === p.month);
      const rest = d.payments.filter((x) => x !== prev);
      return { ...d, payments: [...rest, { ...prev, id: prev?.id ?? `pending-${Date.now()}`, ...p }] };
    });
  }, []);
  const hidePayment = useCallback((id) => {
    setData((d) => ({ ...d, payments: d.payments.filter((x) => x.id !== id) }));
  }, []);

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

  const openPay = (student, forMonth, fromHistory = false) =>
    setSheet({ type: 'pay', studentId: student.id, month: forMonth, fromHistory });
  // Closing a payment opened from a student's history goes back to that history.
  const closePay = () => (sheet?.fromHistory ? setSheet({ type: 'history', studentId: sheet.studentId }) : close());
  const receiptAction = (student, batch, p) => {
    const c = receiptContact(student);
    if (!c) return undefined;
    const href = waLink(
      c.phone,
      receiptText({ name: student.name, amount: p.amount, monthLabel: monthLabel(p.month), batchName: batch.name, paidOn: longDateLabel(p.paid_on), to: c.to }),
    );
    return href ? { label: `Send receipt to ${c.role.toLowerCase()}`, href } : undefined;
  };
  const newBatch = () => setSheet({ type: 'batch' });
  const addStudent = (defaultBatchId) => {
    if (!data.batches.length) return setSheet({ type: 'batch' });
    setSheet({ type: 'student', defaultBatchId });
  };

  let body;
  if (tab === 'search') {
    body = (
      <Search
        students={data.students}
        batches={data.batches}
        dues={dues}
        onOpen={(s) => setSheet({ type: 'history', studentId: s.id })}
      />
    );
  } else if (tab === 'due') {
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
        onDeleteMany={(ids, done) => setSheet({ type: 'bulkdelete', ids, done })}
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
          onClose={closePay}
          onSave={(p) => {
            showPayment(p);
            closePay();
            act(() => backend.savePayment(p)).then((ok) => {
              if (ok) flash('Payment saved', receiptAction(student, batch, p));
            });
            return Promise.resolve(true);
          }}
          onRemove={(id) => {
            hidePayment(id);
            closePay();
            act(() => backend.removePayment(id), 'Marked as unpaid');
            return Promise.resolve(true);
          }}
        />
      );
    }
  } else if (sheet?.type === 'history') {
    const student = data.students.find((s) => s.id === sheet.studentId);
    const batch = student && data.batches.find((b) => b.id === student.batch_id);
    if (student && batch) {
      sheetEl = (
        <StudentHistory
          student={student}
          batch={batch}
          payments={data.payments.filter((p) => p.student_id === student.id)}
          onPay={(s, m) => openPay(s, m, true)}
          onEdit={(s) => setSheet({ type: 'student', student: s })}
          onClose={close}
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
        paymentCount={sheet.student ? data.payments.filter((p) => p.student_id === sheet.student.id).length : 0}
        onClose={close}
        onSave={(s) => closeAfter(act(() => backend.saveStudent(s), s.id ? 'Student updated' : 'Student added'))}
        onDelete={(id) => closeAfter(act(() => backend.deleteStudent(id), 'Student deleted'))}
        onHistory={(s) => setSheet({ type: 'history', studentId: s.id })}
      />
    );
  } else if (sheet?.type === 'batch') {
    sheetEl = (
      <BatchSheet
        batch={sheet.batch}
        studentCount={sheet.batch ? data.students.filter((s) => s.batch_id === sheet.batch.id).length : 0}
        paymentCount={
          sheet.batch
            ? (() => {
                const ids = new Set(data.students.filter((s) => s.batch_id === sheet.batch.id).map((s) => s.id));
                return data.payments.filter((p) => ids.has(p.student_id)).length;
              })()
            : 0
        }
        onClose={close}
        onSave={(b) => closeAfter(act(() => backend.saveBatch(b), b.id ? 'Batch updated' : 'Batch created'))}
        onDelete={(id) =>
          closeAfter(act(() => backend.deleteBatch(id), 'Batch deleted')).then((ok) => {
            if (ok && batchId === id) setBatchId(null);
            return ok;
          })
        }
      />
    );
  } else if (sheet?.type === 'bulkdelete') {
    const gone = new Set(sheet.ids);
    sheetEl = (
      <BulkDeleteSheet
        students={data.students.filter((s) => gone.has(s.id))}
        paymentCount={data.payments.filter((p) => gone.has(p.student_id)).length}
        onClose={close}
        onConfirm={() => {
          // remove them from the screen at once; the server catches up behind
          setData((d) => ({
            ...d,
            students: d.students.filter((s) => !gone.has(s.id)),
            payments: d.payments.filter((p) => !gone.has(p.student_id)),
          }));
          close();
          sheet.done?.();
          act(() => backend.deleteStudents([...gone]), `${gone.size} student${gone.size === 1 ? '' : 's'} deleted`);
        }}
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
      <div className="screen" key={`${tab}-${batchId || ''}`}>
        {body}
      </div>

      <nav className="nav" aria-label="Main">
        <button className={tab === 'overview' && !batchId ? 'on' : ''} onClick={() => goTab('overview')}>
          <Icon.Home width={22} height={22} /> Overview
        </button>
        <button className={tab === 'batches' || (batchId && tab !== 'due' && tab !== 'search') ? 'on' : ''} onClick={() => goTab('batches')}>
          <Icon.List width={22} height={22} /> Batches
        </button>
        <button className={tab === 'search' ? 'on' : ''} onClick={() => goTab('search')}>
          <Icon.Search width={22} height={22} /> Search
        </button>
        <button className={tab === 'due' ? 'on' : ''} onClick={() => goTab('due')}>
          <Icon.Clock width={22} height={22} /> Due
          {dues.length > 0 && <span className="badge" aria-label={`${dues.length} students due`}>{dues.length}</span>}
        </button>
      </nav>

      {sheetEl}
      {sheet?.type === 'report' && <Report view={view} month={month} onClose={close} />}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.msg}</span>
          {toast.action && (
            <a href={toast.action.href} target="_blank" rel="noreferrer" onClick={() => setToast(null)}>
              {toast.action.label}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
