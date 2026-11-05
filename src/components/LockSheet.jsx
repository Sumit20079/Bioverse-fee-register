import { useState } from 'react';
import Sheet from './Sheet';
import PinPad from './PinPad';
import { DELAYS, MAX_DELAY, clearLock, delayLabel, prettyMinutes, setDelay, setPin, verifyPin } from '../lib/lock';

export default function LockSheet({ cfg, onChanged, onClose }) {
  const [step, setStep] = useState('menu'); // menu | new | confirm | verify-change | verify-off
  const [first, setFirst] = useState('');
  const [notice, setNotice] = useState('');
  const toMenu = () => setStep('menu');
  const isPreset = (d) => DELAYS.some(([v]) => v === d);
  const [customOpen, setCustomOpen] = useState(() => !!cfg && !isPreset(cfg.delay));
  const [text, setText] = useState(() => String(cfg && !isPreset(cfg.delay) ? cfg.delay : 10));
  const showCustom = customOpen || (!!cfg && !isPreset(cfg.delay));
  const applyCustom = (raw) => {
    const digits = raw.replace(/[^\d]/g, '').slice(0, 4);
    setText(digits);
    const n = Math.min(MAX_DELAY, Number(digits));
    if (digits && n >= 1) {
      setDelay(n);
      onChanged();
    }
  };

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
                  <button key={d} type="button" role="radio" aria-checked={!showCustom && cfg.delay === d} className={!showCustom && cfg.delay === d ? 'on' : ''} onClick={() => { setCustomOpen(false); setDelay(d); onChanged(); }}>
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  role="radio"
                  aria-checked={showCustom}
                  className={showCustom ? 'on' : ''}
                  onClick={() => {
                    setCustomOpen(true);
                    if (isPreset(cfg.delay)) applyCustom(text || '10');
                  }}
                >
                  Custom
                </button>
              </div>
              <div className={'collapse' + (showCustom ? ' open' : '')} aria-hidden={!showCustom}>
                <div className="collapse-in">
                  <div className="customtime">
                    <label htmlFor="lock-min">Lock after</label>
                    <input id="lock-min" inputMode="numeric" value={text} onChange={(e) => applyCustom(e.target.value)} onBlur={() => !text && applyCustom('10')} aria-describedby="lock-min-hint" />
                    <span>minutes</span>
                  </div>
                  <p id="lock-min-hint" className="hint">{Number(text) > 0 ? `Locks ${delayLabel(Math.min(MAX_DELAY, Number(text)))}` : 'Type a number of minutes'} · up to 24 hours</p>
                </div>
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
