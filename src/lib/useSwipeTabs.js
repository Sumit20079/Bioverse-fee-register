import { useEffect } from 'react';

// Swipe left/right on a phone to move between tabs. The page follows the finger, then slides away
// (or springs back when you let go early, or rubber-bands at the first/last tab).
const DISTANCE = 70; // px to commit
const FLICK = 0.45; // px per ms to commit a quick flick
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

// A swipe that starts on something that scrolls sideways (filter chips, tables) or on a control belongs to that element.
function claimedByChild(target, root) {
  for (let n = target; n && n !== root; n = n.parentElement) {
    if (n.matches?.('input, textarea, select, [data-noswipe]')) return true;
    const ox = getComputedStyle(n).overflowX;
    if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
  }
  return false;
}

export function useSwipeTabs({ area, pageRef, enabled, index, count, onGo }) {
  useEffect(() => {
    if (!area || !enabled) return undefined;
    const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let s = null;
    let timer = 0;

    const reset = (animate) => {
      const page = pageRef.current;
      if (!page) return;
      page.style.transition = animate ? `transform 0.32s ${EASE}, opacity 0.32s ease` : 'none';
      page.style.transform = '';
      page.style.opacity = '';
      clearTimeout(timer);
      timer = setTimeout(() => page.style && (page.style.transition = ''), 340);
    };

    const down = (e) => {
      if (e.pointerType === 'mouse' || !e.isPrimary || e.target.closest?.('.nav, .fabwrap, .toast')) return;
      if (claimedByChild(e.target, area)) return;
      s = { x: e.clientX, y: e.clientY, t: performance.now(), mode: 'wait', id: e.pointerId, dx: 0 };
    };

    const move = (e) => {
      if (!s || e.pointerId !== s.id) return;
      const page = pageRef.current;
      if (!page) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (s.mode === 'wait') {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dx) > Math.abs(dy) * 1.4) {
          s.mode = 'drag';
          area.setPointerCapture?.(e.pointerId);
          page.style.transition = 'none';
        } else {
          s = null;
          return;
        }
      }
      s.dx = dx;
      const atEnd = (dx > 0 && index === 0) || (dx < 0 && index === count - 1);
      const shown = atEnd ? dx * 0.25 : dx;
      page.style.transform = `translateX(${shown}px)`;
      page.style.opacity = String(1 - Math.min(0.5, (Math.abs(shown) / (page.clientWidth || 400)) * 0.6));
    };

    const up = (e) => {
      if (!s || e.pointerId !== s.id) return;
      const was = s;
      s = null;
      if (was.mode !== 'drag') return;
      const page = pageRef.current;
      const dx = was.dx;
      const v = dx / Math.max(1, performance.now() - was.t);
      const dir = dx < 0 ? 1 : -1; // swipe left = next tab
      const target = index + dir;
      const commit = target >= 0 && target < count && (Math.abs(dx) > DISTANCE || (Math.abs(v) > FLICK && Math.abs(dx) > 25));
      if (!commit || !page) return reset(true);
      if (calm()) {
        reset(false);
        return onGo(target, dir);
      }
      page.style.transition = `transform 0.18s cubic-bezier(0.4, 0, 1, 1), opacity 0.18s ease`;
      page.style.transform = `translateX(${dir * -1 * (page.clientWidth || 400)}px)`;
      page.style.opacity = '0';
      timer = setTimeout(() => onGo(target, dir), 170);
    };

    const cancel = (e) => {
      if (!s || e.pointerId !== s.id) return;
      const wasDrag = s.mode === 'drag';
      s = null;
      if (wasDrag) reset(true);
    };

    area.addEventListener('pointerdown', down);
    area.addEventListener('pointermove', move);
    area.addEventListener('pointerup', up);
    area.addEventListener('pointercancel', cancel);
    return () => {
      area.removeEventListener('pointerdown', down);
      area.removeEventListener('pointermove', move);
      area.removeEventListener('pointerup', up);
      area.removeEventListener('pointercancel', cancel);
      clearTimeout(timer);
      reset(false);
    };
  }, [area, pageRef, enabled, index, count, onGo]);
}
