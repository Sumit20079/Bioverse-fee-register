// Pressing an arrow makes the whole button lean the way it points and spring back.
export function lean(el, dir) {
  if (!el?.animate || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  const d = dir * 9;
  el.animate(
    [
      { transform: 'translateX(0) scale(1)' },
      { transform: `translateX(${d}px) scale(0.92)`, offset: 0.3 },
      { transform: `translateX(${-d * 0.35}px) scale(1.04)`, offset: 0.65 },
      { transform: 'translateX(0) scale(1)' },
    ],
    { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
  );
}

