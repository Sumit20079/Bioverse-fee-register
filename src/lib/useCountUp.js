import { useEffect, useRef, useState } from 'react';

// Eases a number toward its target. Starts from 0 on first render, then from wherever it was.
export function useCountUp(target, ms = 700) {
  const [value, setValue] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || current.current === target) {
      current.current = target;
      setValue(target);
      return undefined;
    }
    const from = current.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      current.current = Math.round(from + (target - from) * eased);
      setValue(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return value;
}
