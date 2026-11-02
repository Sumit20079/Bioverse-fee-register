import { useEffect, useRef, useState } from 'react';

// Keeps the last thing shown on screen for a moment after it goes away, so it can animate out
// instead of vanishing. While it is leaving it can't be tapped.
export default function Leaving({ children, ms = 220 }) {
  const last = useRef(null);
  const [, redraw] = useState(0);
  const has = !!children;
  if (has) last.current = children;
  // Each time something new opens it gets a fresh identity, so it never inherits the state of the
  // one that was still animating out.
  const wasOpen = useRef(false);
  const gen = useRef(0);
  if (has && !wasOpen.current) gen.current += 1;
  wasOpen.current = has;

  useEffect(() => {
    if (has) return undefined;
    const t = setTimeout(() => {
      last.current = null;
      redraw((n) => n + 1);
    }, ms);
    return () => clearTimeout(t);
  }, [has, ms]);

  const el = has ? children : last.current;
  if (!el) return null;
  return (
    <div key={gen.current} className={'presence' + (has ? '' : ' leaving')}>
      {el}
    </div>
  );
}
