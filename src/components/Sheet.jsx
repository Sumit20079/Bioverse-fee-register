import { useEffect, useRef, useState } from 'react';

export default function Sheet({ title, subtitle, onClose, children }) {
  // Dragging the handle down follows the finger; let go past ~110px (or flick) to close.
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [gone, setGone] = useState(false);
  const from = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const down = (e) => {
    from.current = { y: e.clientY, t: performance.now() };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (from.current) setDy(Math.max(0, e.clientY - from.current.y));
  };
  const up = () => {
    if (!from.current) return;
    const speed = dy / Math.max(1, performance.now() - from.current.t);
    from.current = null;
    setDragging(false);
    if (dy > 110 || (speed > 0.6 && dy > 30)) {
      setGone(true);
      setDy(window.innerHeight);
      setTimeout(onClose, 200);
    } else {
      setDy(0);
    }
  };

  const ease = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)';
  return (
    <div className="scrim" onClick={onClose} style={{ '--dim': gone ? 0 : 1 - Math.min(0.8, dy / 500), transition: dragging ? 'none' : 'background-color 0.2s ease' }}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-gone={gone || undefined}
        onClick={(e) => e.stopPropagation()}
        style={dy ? { transform: `translateY(${dy}px)`, transition: dragging ? 'none' : ease } : undefined}
      >
        <div className="grabzone" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div className="grab" />
        </div>
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
