import { useState } from 'react';
import Sheet from './Sheet';
import PinPad from './PinPad';
import { DELAYS, clearLock, delayLabel, setDelay, setPin, verifyPin } from '../lib/lock';

export default function LockSheet({ cfg, onChanged, onClose }) {
  const [step, setStep] = useState('menu'); // menu | new | confirm | verify-change | verify-off
  const [first, setFirst] = useState('');
  const [notice, setNotice] = useState('');
  const toMenu = () => setStep('menu');

  const verify = (next) => async (pin) => {
    const r = await verifyPin(pin);
    if (!r.ok) return r.wait ? `Too many tries. Wait ${r.wait} seconds.` : 'Wrong PIN.';
    next();
    return null;
  };

  let body;
  if (step === 'new') {
    body = <PinPad key="new" title="Choose a 4-digit PIN" hint={notice || 'You will type it when the app opens'} hintBad={!!notice} check={(pin) => { setNotice(''); setFirst(pin); setStep('confirm'); return null; }} />;
  } else if (step === 'confirm') {
    body = (
      <PinPad
        key="confirm"
        title="Type it once more"
        hint="To make sure it is the one you meant"
        check={async (pin) => {
          if (pin !== first) {
            setNotice('The two PINs did not match. Start again.');
            setStep('new');
            return null;
          }
          await setPin(pin, cfg?.delay ?? 1);
          onChanged();
          toMenu();
          return null;
        }}
      />
    );
  } else if (step === 'verify-change') {
    body = <PinPad key="vc" title="Enter your current PIN" check={verify(() => setStep('new'))} />;
  } else if (step === 'verify-off') {
    body = (
      <PinPad
        key="vo"
        title="Enter your PIN to turn the lock off"
        check={verify(() => {
          clearLock();
          onChanged();
          toMenu();
        })}
      />
    );
  }

  return (
    <Sheet title="App lock" subtitle="Saved on this device only" onClose={onClose}>
      {step === 'menu' ? (
        cfg ? (
          <>
            <p className="muted">The lock is <b>on</b>. It asks for your PIN when the app opens and {delayLabel(cfg.delay)}.</p>
            <div className="field">
              <span className="lbl">Lock again</span>
              <div className="seg" role="radiogroup" aria-label="Lock again">
                {DELAYS.map(([d, label]) => (
                  <button key={d} type="button" role="radio" aria-checked={cfg.delay === d} className={cfg.delay === d ? 'on' : ''} onClick={() => { setDelay(d); onChanged(); }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn secondary" onClick={() => setStep('verify-change')}>Change PIN</button>
            <button className="btn danger" onClick={() => setStep('verify-off')}>Turn off app lock</button>
          </>
        ) : (
          <>
            <p className="muted">Ask for a 4-digit PIN whenever the app opens, so nobody can look at student names and phone numbers if they pick up this phone. It only applies to this device.</p>
            <button className="btn" onClick={() => { setNotice(''); setStep('new'); }}>Turn on app lock</button>
          </>
        )
      ) : (
        <>
          {body}
          <button className="btn secondary" onClick={toMenu}>Cancel</button>
        </>
      )}
    </Sheet>
  );
}
