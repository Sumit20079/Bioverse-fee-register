import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';

// Four dots and a number pad. `check(pin)` resolves to an error message, or null when the PIN was accepted.
export default function PinPad({ title, hint, hintBad = false, success = false, check }) {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const [wrong, setWrong] = useState(false);
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
      if (!msg) {
        busy.current = false;
        setDigits('');
        return;
      }
      // wrong: the four dots turn red and shake, then clear (input stays blocked meanwhile)
      setError(msg);
      setWrong(true);
      setShake((n) => n + 1);
      navigator.vibrate?.([30, 40, 30]);
      setTimeout(() => {
        busy.current = false;
        setWrong(false);
        setDigits('');
      }, 380);
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
      <div key={shake} className={'pin-dots' + (wrong ? ' shake bad' : '') + (success ? ' ok' : '')} aria-label={`${digits.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={success || wrong || i < digits.length ? 'on' : ''} style={{ '--i': i }} />
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
