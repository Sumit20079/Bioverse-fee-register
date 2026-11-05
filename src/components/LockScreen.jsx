import { useEffect, useRef, useState } from 'react';
import PinPad from './PinPad';
import { verifyPin } from '../lib/lock';

export default function LockScreen({ onUnlock, onForgot }) {
  const [armed, setArmed] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | ok | leaving
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const check = async (pin) => {
    const r = await verifyPin(pin);
    if (r.ok) {
      // dots ripple, then the whole screen eases away to show the app
      const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (calm) {
        onUnlock();
        return null;
      }
      setPhase('ok');
      timers.current.push(setTimeout(() => setPhase('leaving'), 340), setTimeout(onUnlock, 340 + 240));
      return null;
    }
    if (r.wait) return `Too many tries. Wait ${r.wait} seconds.`;
    return r.left ? `Wrong PIN. ${r.left} ${r.left === 1 ? 'try' : 'tries'} left before a short wait.` : 'Wrong PIN.';
  };
  return (
    <div className={'lockscreen' + (phase === 'leaving' ? ' leaving' : '')} role="dialog" aria-modal="true" aria-label="App locked">
      <PinPad title="Enter your PIN" hint="Fee Register is locked" success={phase !== 'idle'} check={check} />
      <button type="button" className="forgot" onClick={() => (armed ? onForgot() : setArmed(true))}>
        {armed ? 'Tap again: sign out and remove this PIN' : 'Forgot PIN?'}
      </button>
    </div>
  );
}
