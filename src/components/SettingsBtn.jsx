import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';

export const SettingsContext = createContext(() => {});

// The gear turns half a revolution clockwise, and the panel starts rising just after it begins to turn.
export default function SettingsBtn() {
  const open = useContext(SettingsContext);
  const [turns, setTurns] = useState(0);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const click = () => {
    setTurns((t) => t + 1);
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    clearTimeout(timer.current);
    timer.current = setTimeout(open, calm ? 0 : 170);
  };

  return (
    <button className="iconbtn gearbtn" aria-label="Settings" onClick={click}>
      <span className="gear" style={{ transform: `rotate(${turns * 180}deg)` }}>
        <Icon.Gear />
      </span>
    </button>
  );
}
