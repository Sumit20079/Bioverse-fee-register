import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { backend, exitGuest, isDemo, isGuest, rememberSignedIn, signOutSafe, supabase, sync, wasSignedIn } from './lib/db';
import SyncPill from './components/SyncPill';
import { currentMonth, longDateLabel, monthLabel, monthsBetween, todayISO } from './lib/dates';
import { dueList, feeOn, monthView, staleSettled, withBatchMove, withFeeChange } from './lib/calc';
import { download, receiptContact, receiptText, waLink } from './lib/format';
import Login from './components/Login';
import Overview from './components/Overview';
import Batches from './components/Batches';
import BatchDetail from './components/BatchDetail';
import Due from './components/Due';
import Search from './components/Search';
import Collected from './components/Collected';
import StudentHistory from './components/StudentHistory';
import Report from './components/Report';
import PaymentSheet from './components/PaymentSheet';
import StudentSheet from './components/StudentSheet';
import BatchSheet from './components/BatchSheet';
import ImportSheet from './components/ImportSheet';
import BulkDeleteSheet from './components/BulkDeleteSheet';
import Trash from './components/Trash';
import RestoreSheet from './components/RestoreSheet';
import MoveSheet from './components/MoveSheet';
import Leaving from './components/Leaving';
import LockScreen from './components/LockScreen';
import LockSheet from './components/LockSheet';
import { clearLock, loadLock } from './lib/lock';
import { useSwipeTabs } from './lib/useSwipeTabs';
import AboutSheet from './components/AboutSheet';
import SettingsSheet from './components/SettingsSheet';
import { SettingsContext } from './components/SettingsBtn';
import AppearanceSheet from './components/AppearanceSheet';
import { loadLook, applyLook, saveLook, watchSystem } from './lib/look';
import { Icon } from './components/Icons';

// The newest deleted_at among everything in Recently deleted.
const newestInBin = (trash) =>
  [...trash.batches, ...trash.students].reduce((a, t) => (!a || Date.parse(t.deleted_at) > Date.parse(a) ? t.deleted_at : a), null);

// A tiny tick on phones that support it.
const buzz = () => {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* not supported */
  }
};

const TAB_ORDER = ['overview', 'batches', 'search', 'collected', 'due'];

export default function App() {
  // undefined = still checking the saved login
  const [session, setSession] = useState(isDemo ? { demo: true } : undefined);

  useEffect(() => {
    if (isDemo) return undefined;
    // Offline, the saved login can't be refreshed, so a device that was signed in keeps working on its own copy.
    const gotSession = (s) => {
      if (s) rememberSignedIn(true);
      setSession(s || (wasSignedIn() && !navigator.onLine ? { offline: true } : null));
    };
    supabase.auth.getSession().then(({ data }) => gotSession(data.session), () => setSession(wasSignedIn() ? { offline: true } : null));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => gotSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="center muted">Loading…</div>;
  if (!session) return <Login />;
  return <Register />;
}

function Register() {
  // optional PIN lock (per device): lockCfg is the saved setting, locked is whether the PIN screen is up
  const [lockCfg, setLockCfg] = useState(loadLock);
  const [locked, setLocked] = useState(() => !!loadLock());
  const hiddenAt = useRef(0);
  useEffect(() => {
    const onVis = () => {
      const cfg = loadLock();
      if (!cfg) return;
      if (document.hidden) {
        hiddenAt.current = Date.now();
        if (cfg.delay === 0) setLocked(true);
      } else if (hiddenAt.current && Date.now() - hiddenAt.current >= cfg.delay * 60000) {
        setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [net, setNet] = useState(() => (sync ? sync.snapshot() : null));
  useEffect(() => (sync ? sync.subscribe(setNet) : undefined), []);
  const [tab, setTab] = useState('overview');
  const [batchId, setBatchId] = useState(null);
  const [month, setMonth] = useState(currentMonth());
  const [sheet, setSheet] = useState(null);
  const [look, setLook] = useState(loadLook);
  const lookRef = useRef(look);
  lookRef.current = look;
  useEffect(() => watchSystem(() => lookRef.current), []);
  // Android/browser Back steps back one level at a time: a sub-page (Appearance...) -> Settings -> closed, a batch ->
  // its tab, another tab -> Overview; only Back on a clean Overview leaves the app.
  // Browsers (Chrome on Android) skip history entries that were added without a fresh tap, and an app can't tell. So
  // the app only ever adds ONE entry, at the tap that leaves the clean Overview. Each Back that still leaves the app
  // "deep" steps one level in the app and then returns to that entry with history.forward(), which has no such limit.
  const nav = useRef({});
  nav.current = { sheet, batchId, tab };
  const deep = tab !== 'overview' || !!batchId || !!sheet;
  const pushed = useRef(false);
  const skipPop = useRef(0);
  useEffect(() => {
    if (deep && !pushed.current) {
      pushed.current = true;
      history.pushState({ fee: 1 }, '');
    } else if (!deep && pushed.current) {
      pushed.current = false; // back at Overview from inside the app: drop the unused entry
      skipPop.current += 1;
      history.go(-1);
    }
  });
  useEffect(() => {
    const onPop = () => {
      if (skipPop.current) {
        skipPop.current -= 1;
        return;
      }
      if (!pushed.current) return;
      const n = nav.current;
      let stillDeep = true;
      if (n.sheet) {
        setSheet(n.sheet.from === 'settings' ? { type: 'settings' } : null);
        stillDeep = n.sheet.from === 'settings' || n.tab !== 'overview' || !!n.batchId;
      } else if (n.batchId) {
        setBatchId(null);
        stillDeep = n.tab !== 'overview';
      } else {
        setTab('overview');
        stillDeep = false;
      }
      if (stillDeep) {
        skipPop.current += 1;
        history.forward(); // we are on the entry below ours: step back up onto it
      } else {
        pushed.current = false;
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // swipe between the five main tabs on a phone
  const [appEl, setAppEl] = useState(null);
  const pageRef = useRef(null);
  const [swipeDir, setSwipeDir] = useState(null);
  const tabIndex = TAB_ORDER.indexOf(tab);
  const onPhone = typeof matchMedia === 'function' && !matchMedia('(min-width: 900px)').matches;
  const goSwipe = useCallback((next, dir) => {
    buzz();
    setSwipeDir(dir > 0 ? 'right' : 'left');
    setTab(TAB_ORDER[next]);
    setBatchId(null);
  }, []);
  useSwipeTabs({ area: appEl, pageRef, enabled: onPhone && tabIndex >= 0 && !batchId && !sheet && !locked, index: tabIndex, count: TAB_ORDER.length, onGo: goSwipe });
  const changeLook = (l) => {
    setLook(l);
    applyLook(l);
    saveLook(l);
  };
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // `action` is an optional { label, href } link or { label, onClick } button shown inside the toast
  // (e.g. send a receipt, or undo a delete).
  const flash = useCallback((msg, action) => {
    setToast({ msg, action });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), action ? 8000 : 2600);
  }, []);

  // A sheet opening takes over the bottom of the screen, so an old toast shouldn't cover it.
  useEffect(() => {
    if (sheet) setToast(null);
  }, [sheet]);

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

  // The moment the signal comes back, send what is waiting and refresh.
  useEffect(() => {
    if (!sync) return undefined;
    const back = () => {
      queue.current = queue.current.then(reload);
    };
    window.addEventListener('online', back);
    return () => window.removeEventListener('online', back);
  }, [reload]);

  // A change the server refused while syncing is reported once.
  useEffect(() => {
    if (net?.error) {
      flash(net.error);
      sync.clearError();
    }
  }, [net?.error, flash]);

  const syncNow = () => act(async () => {}).then(() => flash(sync.snapshot().pending ? 'Still offline: changes are saved on this device' : 'Up to date'));

  // Show a payment change on screen straight away; the server catches up behind it.
  const showPayment = useCallback((p) => {
    setData((d) => {
      if (p.id) return { ...d, payments: d.payments.map((x) => (x.id === p.id ? { ...x, ...p } : x)) };
      return { ...d, payments: [...d.payments, { ...p, id: `pending-${Date.now()}` }] };
    });
  }, []);
  const hidePayments = useCallback((ids) => {
    setData((d) => ({ ...d, payments: d.payments.filter((x) => !ids.includes(x.id)) }));
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
  // sheets opened from Settings go back to Settings when closed
  const closeBack = () => (sheet?.from === 'settings' ? setSheet({ type: 'settings' }) : setSheet(null));
  const closeAfter = (promise) => promise.then((ok) => {
    if (ok) close();
    return ok;
  });

  const goTab = (t) => {
    setSwipeDir(null);
    setTab(t);
    setBatchId(null);
  };
  const detail = batchId ? view.batches.find((b) => b.batch.id === batchId) : null;

  const openPay = (student, forMonth, fromHistory = false) =>
    setSheet({ type: 'pay', studentId: student.id, month: forMonth, fromHistory });
  // Closing a payment opened from a student's history goes back to that history.
  const closePay = () => (sheet?.fromHistory ? setSheet({ type: 'history', studentId: sheet.studentId }) : close());
  const receiptAction = (student, batch, p, balance = 0) => {
    const c = receiptContact(student);
    if (!c) return undefined;
    const href = waLink(
      c.phone,
      receiptText({ name: student.name, amount: p.amount, monthLabel: monthLabel(p.month), batchName: batch.name, paidOn: longDateLabel(p.paid_on), balance, to: c.to }),
    );
    return href ? { label: `Send receipt to ${c.role.toLowerCase()}`, href } : undefined;
  };
  // After a delete: say so, with an Undo that brings it straight back.
  const undoable = (ok, msg, restore) => {
    if (ok) flash(msg, { label: 'Undo', onClick: () => act(restore, 'Restored') });
    return ok;
  };
  const backup = async () => {
    try {
      const dump = await backend.backup();
      const out = { app: 'bioverse-fee-register', version: 1, exported_at: new Date().toISOString(), ...dump };
      download(`fee-register-backup-${todayISO()}.json`, JSON.stringify(out, null, 2), 'application/json');
      flash(`Backup saved: ${dump.students.length} students, ${dump.payments.length} payments`);
    } catch (e) {
      flash('Backup failed: ' + (e.message || e));
    }
  };
  const newBatch = () => setSheet({ type: 'batch' });
  const addStudent = (defaultBatchId) => {
    if (!data.batches.length) return setSheet({ type: 'batch' });
    setSheet({ type: 'student', defaultBatchId });
  };

  let body;
  let fabEl = null;
  if (tab === 'search') {
    body = (
      <Search
        students={data.students}
        batches={data.batches}
        dues={dues}
        onOpen={(s) => setSheet({ type: 'history', studentId: s.id })}
      />
    );
  } else if (tab === 'collected') {
    body = <Collected data={data} onOpen={(student, m) => openPay(student, m)} />;
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
        onMoveMany={(ids, done) => setSheet({ type: 'move', ids, done })}
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
          onBackup={backup}
          onRestoreFile={() => setSheet({ type: 'restore' })}
          onTrash={() => setSheet({ type: 'trash' })}
          onAppearance={() => setSheet({ type: 'appearance' })}
          trashCount={data.trash.batches.length + data.trash.students.length}
          onSignOut={signOutSafe}
        />
      </>
    );
    if (view.batches.length > 0)
      fabEl = (
        <div className="fabwrap">
          <button className="fab" aria-label="Add student" onClick={() => addStudent()}>
            <Icon.Plus width={24} height={24} strokeWidth={2} />
          </button>
        </div>
      );
  }

  // Sheets
  let sheetEl = null;
  if (sheet?.type === 'pay') {
    const student = data.students.find((s) => s.id === sheet.studentId);
    const batch = student && data.batches.find((b) => b.id === student.batch_id);
    if (student && batch) {
      const byMonth = new Map();
      for (const p of data.payments) {
        if (p.student_id !== student.id) continue;
        if (!byMonth.has(p.month)) byMonth.set(p.month, []);
        byMonth.get(p.month).push(p);
      }
      const options = new Set(monthsBetween(student.joined_month, currentMonth()));
      options.add(sheet.month);
      byMonth.forEach((_p, m) => options.add(m));
      sheetEl = (
        <PaymentSheet
          student={student}
          batch={batch}
          batches={data.allBatches || data.batches}
          month={sheet.month}
          monthOptions={[...options].sort()}
          paymentsByMonth={byMonth}
          onClose={closePay}
          onSave={(p) => {
            buzz();
            showPayment(p);
            closePay();
            const before = byMonth.get(p.month) || [];
            const after = p.id ? before.map((x) => (x.id === p.id ? { ...x, ...p } : x)) : [...before, p];
            // editing an earlier instalment can leave the others flagged "settled" although the month is now short
            const stale = p.id ? staleSettled(before, after, feeOn(student, data.allBatches || data.batches, p.month)).filter((x) => x.id !== p.id) : [];
            for (const x of stale) {
              showPayment({ ...x, settled: false });
              act(() => backend.savePayment({ ...x, settled: false }));
            }
            const others = before.filter((x) => x.id !== p.id).reduce((t, x) => t + x.amount, 0);
            const balance = p.settled ? 0 : Math.max(0, feeOn(student, data.allBatches || data.batches, p.month) - others - p.amount);
            act(() => backend.savePayment(p)).then((ok) => {
              if (ok) flash('Payment saved', receiptAction(student, batch, p, balance));
            });
            return Promise.resolve(true);
          }}
          onRemove={(ids, m) => {
            const before = byMonth.get(m) || [];
            const all = before.every((x) => ids.includes(x.id));
            const after = before.filter((x) => !ids.includes(x.id));
            const stale = staleSettled(before, after, feeOn(student, data.allBatches || data.batches, m));
            hidePayments(ids);
            for (const x of stale) showPayment({ ...x, settled: false });
            closePay();
            for (const x of stale) act(() => backend.savePayment({ ...x, settled: false }));
            act(() => backend.removePayments(ids), all ? 'Marked as unpaid' : 'Payment removed');
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
          batches={data.allBatches || data.batches}
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
        onSave={(s) => {
          const cur = sheet.student;
          if (s.id && cur && s.batch_id !== cur.batch_id) {
            // changing the batch is a move: keep the old months where they were
            const row = { id: s.id, ...withBatchMove(cur, s.batch_id, s.move_from || currentMonth(), currentMonth()) };
            return closeAfter(
              act(async () => {
                await backend.saveStudent({ ...s, batch_id: cur.batch_id });
                await backend.moveStudents([row]);
              }, 'Student updated'),
            );
          }
          return closeAfter(act(() => backend.saveStudent(s), s.id ? 'Student updated' : 'Student added'));
        }}
        onDelete={(id) =>
          closeAfter(act(() => backend.deleteStudent(id))).then((ok) =>
            undoable(ok, 'Student deleted', () => backend.restoreStudents([id])),
          )
        }
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
        onSave={(b) => {
          // a changed fee on an existing batch is recorded from the chosen month, so earlier months keep theirs
          const old = b.id && data.batches.find((x) => x.id === b.id);
          const row = old && b.fee !== old.fee ? { ...b, ...withFeeChange(old, b.fee, b.from || currentMonth()) } : { ...b, fee: old ? old.fee : b.fee };
          return closeAfter(act(() => backend.saveBatch(row), b.id ? 'Batch updated' : 'Batch created'));
        }}
        onDelete={(id) =>
          closeAfter(act(() => backend.deleteBatch(id))).then((ok) => {
            if (ok && batchId === id) setBatchId(null);
            return undoable(ok, 'Batch deleted', () => backend.restoreBatch(id));
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
          const ids = [...gone];
          act(() => backend.deleteStudents(ids)).then((ok) =>
            undoable(ok, `${ids.length} student${ids.length === 1 ? '' : 's'} deleted`, () => backend.restoreStudents(ids)),
          );
        }}
      />
    );
  } else if (sheet?.type === 'move' && detail) {
    const mv = new Set(sheet.ids);
    const from = detail.batch;
    sheetEl = (
      <MoveSheet
        students={data.students.filter((s) => mv.has(s.id))}
        from={from}
        batches={data.batches}
        onClose={close}
        month={month}
        onConfirm={(dest, fromMonth) => {
          const moving = data.students.filter((s) => mv.has(s.id));
          const rows = moving.map((s) => ({ id: s.id, ...withBatchMove(s, dest.id, fromMonth, currentMonth()) }));
          const undoRows = moving.map((s) => ({ id: s.id, batch_id: s.batch_id, batch_history: s.batch_history ?? null }));
          close();
          sheet.done?.();
          let kept = true;
          act(async () => {
            kept = await backend.moveStudents(rows);
          }).then((ok) => {
            if (ok) {
              flash(
                `Moved ${rows.length} student${rows.length === 1 ? '' : 's'} to ${dest.name}${kept ? '' : ' (history not saved: run add-move-history.sql in Supabase)'}`,
                { label: 'Undo', onClick: () => act(() => backend.moveStudents(undoRows), 'Moved back') },
              );
            }
          });
        }}
      />
    );
  } else if (sheet?.type === 'restore') {
    sheetEl = (
      <RestoreSheet
        loadCurrent={() => backend.backup()}
        onClose={closeBack}
        onRestore={(plan) =>
          closeAfter(
            act(
              () => backend.restore(plan),
              `Restored ${plan.students.length} student${plan.students.length === 1 ? '' : 's'}, ${plan.payments.length} payment${plan.payments.length === 1 ? '' : 's'}`,
            ),
          )
        }
      />
    );
  } else if (sheet?.type === 'settings') {
    sheetEl = (
      <SettingsSheet
        onClose={close}
        onAppearance={() => setSheet({ type: 'appearance', from: 'settings' })}
        onAbout={() => setSheet({ type: 'about', from: 'settings' })}
        lockCfg={lockCfg}
        onLock={() => setSheet({ type: 'lock', from: 'settings' })}
        onBackup={backup}
        onRestore={() => setSheet({ type: 'restore', from: 'settings' })}
        onTrash={() => setSheet({ type: 'trash', from: 'settings' })}
        trashCount={data.trash.batches.length + data.trash.students.length}
        isDemo={isDemo}
        isGuest={isGuest}
        onExitDemo={exitGuest}
        onSignOut={signOutSafe}
        net={isDemo ? null : net}
        onSyncNow={syncNow}
      />
    );
  } else if (sheet?.type === 'lock') {
    sheetEl = <LockSheet cfg={lockCfg} onChanged={() => setLockCfg(loadLock())} onClose={closeBack} />;
  } else if (sheet?.type === 'about') {
    sheetEl = <AboutSheet onClose={closeBack} />;
  } else if (sheet?.type === 'appearance') {
    sheetEl = <AppearanceSheet look={look} onChange={changeLook} onClose={closeBack} />;
  } else if (sheet?.type === 'trash') {
    sheetEl = (
      <Trash
        trash={data.trash}
        onClose={closeBack}
        onRestoreStudent={(id) => act(() => backend.restoreStudents([id]), 'Student restored')}
        onRestoreBatch={(id) => act(() => backend.restoreBatch(id), 'Batch restored')}
        onPurgeStudent={(id) => act(() => backend.purgeStudents([id]), 'Deleted forever')}
        onPurgeBatch={(id) => act(() => backend.purgeBatch(id), 'Deleted forever')}
        onRestoreAll={() => {
          flash('Restoring…');
          act(() => backend.restoreTrash(newestInBin(data.trash)), 'Everything restored');
        }}
        onPurgeAll={() => {
          // empty the list on screen at once; the server catches up behind
          const upTo = newestInBin(data.trash);
          setData((d) => ({ ...d, trash: { batches: [], students: [] } }));
          flash('Emptying…');
          act(() => backend.purgeTrash(upTo), 'Recently deleted emptied');
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
    <div className={'app' + (onPhone && tabIndex >= 0 && !batchId ? ' swipeable' : '')} ref={setAppEl}>
      {locked && lockCfg && (
        <LockScreen
          onUnlock={() => {
            hiddenAt.current = 0;
            setLocked(false);
          }}
          onForgot={() => {
            clearLock();
            setLockCfg(null);
            setLocked(false);
            if (!isDemo) signOutSafe();
          }}
        />
      )}
      {!isDemo && <SyncPill net={net} />}
      <div className={'screen' + (swipeDir ? ` from-${swipeDir}` : '')} key={`${tab}-${batchId || ''}`} ref={pageRef}>
        <SettingsContext.Provider value={() => setSheet({ type: 'settings' })}>{body}</SettingsContext.Provider>
      </div>
      {fabEl}

      <nav className="nav" aria-label="Main">
        <span className="nav-ind" style={{ '--i': tab === 'search' ? 2 : tab === 'collected' ? 3 : tab === 'due' ? 4 : tab === 'batches' || batchId ? 1 : 0 }} aria-hidden="true" />
        <button className={tab === 'overview' && !batchId ? 'on' : ''} onClick={() => goTab('overview')}>
          <Icon.Home width={22} height={22} /> Overview
        </button>
        <button className={tab === 'batches' || (batchId && tab !== 'due' && tab !== 'search' && tab !== 'collected') ? 'on' : ''} onClick={() => goTab('batches')}>
          <Icon.List width={22} height={22} /> Batches
        </button>
        <button className={tab === 'search' ? 'on' : ''} onClick={() => goTab('search')}>
          <Icon.Search width={22} height={22} /> Search
        </button>
        <button className={tab === 'collected' ? 'on' : ''} onClick={() => goTab('collected')}>
          <Icon.Rupee width={22} height={22} /> Collected
        </button>
        <button className={tab === 'due' ? 'on' : ''} onClick={() => goTab('due')}>
          <Icon.Clock width={22} height={22} /> Due
          {dues.length > 0 && <span className="badge" aria-label={`${dues.length} students due`}>{dues.length}</span>}
        </button>
      </nav>

      <Leaving>{sheetEl}</Leaving>
      {sheet?.type === 'report' && <Report view={view} month={month} onClose={close} />}
      <Leaving ms={200}>
        {toast && (
          <div className="toast" role="status">
            <span>{toast.msg}</span>
            {toast.action?.href && (
              <a href={toast.action.href} target="_blank" rel="noreferrer" onClick={() => setToast(null)}>
                {toast.action.label}
              </a>
            )}
            {toast.action?.onClick && (
              <button
                onClick={() => {
                  setToast(null);
                  toast.action.onClick();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </Leaving>
    </div>
  );
}
