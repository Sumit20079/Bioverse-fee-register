import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';

// Four dots and a number pad. `check(pin)` resolves to an error message, or null when the PIN was accepted.
export default function PinPad({ title, hint, hintBad = false, check }) {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const busy = useRef(false);

  const press = (d) => {
    if (busy.current) return;
    navigator.vibrate?.(8);
    setError('');
    setDigits((cur) => (cur.length < 4 ? cur + d : cur));
  };
  const back = () => !busy.current && setDigits((cur) => cur.slice(0, -1));

  useEffect(() => {
    if (digits.length !== 4 || busy.current) return;
    busy.current = true;
    Promise.resolve(check(digits)).then((msg) => {
      busy.current = false;
      if (msg) {
        setError(msg);
        setShake((n) => n + 1);
        navigator.vibrate?.([30, 40, 30]);
      }
      setDigits('');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="pin">
      <h2>{title}</h2>
      <p className={'pin-msg' + (error || hintBad ? ' bad' : '')} role="status">{error || hint || ' '}</p>
      <div key={shake} className={'pin-dots' + (shake ? ' shake' : '')} aria-label={`${digits.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i < digits.length ? 'on' : ''} />
        ))}
      </div>
      <div className="pin-keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)}>{d}</button>
        ))}
        <span />
        <button type="button" onClick={() => press('0')}>0</button>
        <button type="button" className="del" aria-label="Delete" onClick={back}><Icon.Backspace /></button>
      </div>
    </div>
  );
}
