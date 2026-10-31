import { useEffect, useState } from 'react';

// True on laptop-sized screens. Keep the number in step with the 900px breakpoint in styles.css.
export function useWide(query = '(min-width: 900px)') {
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return wide;
}
