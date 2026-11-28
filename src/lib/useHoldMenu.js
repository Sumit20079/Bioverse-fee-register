import { useRef } from 'react';

// Press and hold (or right-click) something to open its menu. A normal tap still does what it always did.
// Call the result with the thing being held, and spread what it returns onto the element.
export function useHoldMenu(open) {
  const t = useRef(null);
  const start = useRef(null);
  const fired = useRef(false);
  const cancel = () => {
    clearTimeout(t.current);
    t.current = null;
  };
  return (item) => ({
    onPointerDown: (e) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      cancel();
      t.current = setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(15);
        open(item);
      }, 500);
    },
    onPointerMove: (e) => {
      const s = start.current;
      if (t.current && s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e) => {
      e.preventDefault();
      cancel();
      if (!fired.current) {
        fired.current = true;
        open(item);
      }
    },
    // the tap that ends a long press must not also open Edit
    onClickCapture: (e) => {
      if (fired.current) {
        e.stopPropagation();
        e.preventDefault();
        fired.current = false;
      }
    },
  });
}
