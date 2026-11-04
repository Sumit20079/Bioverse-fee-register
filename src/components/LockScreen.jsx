import { useState } from 'react';
import PinPad from './PinPad';
import { verifyPin } from '../lib/lock';

export default function LockScreen({ onUnlock, onForgot }) {
  const [armed, setArmed] = useState(false);
  const check = async (pin) => {
    const r = await verifyPin(pin);
    if (r.ok) {
      onUnlock();
      return null;
    }
    if (r.wait) return `Too many tries. Wait ${r.wait} seconds.`;
    return r.left ? `Wrong PIN. ${r.left} ${r.left === 1 ? 'try' : 'tries'} left before a short wait.` : 'Wrong PIN.';
  };
  return (
    <div className="lockscreen" role="dialog" aria-modal="true" aria-label="App locked">
      <PinPad title="Enter your PIN" hint="Fee Register is locked" check={check} />
      <button type="button" className="forgot" onClick={() => (armed ? onForgot() : setArmed(true))}>
        {armed ? 'Tap again: sign out and remove this PIN' : 'Forgot PIN?'}
      </button>
    </div>
  );
}
