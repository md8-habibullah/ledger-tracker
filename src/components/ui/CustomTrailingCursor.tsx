import { useEffect, useRef, useState } from 'react';

interface CursorPos {
  x: number;
  y: number;
}

export function CustomTrailingCursor() {
  const [trailingPos, setTrailingPos] = useState<CursorPos>({ x: 0, y: 0 });
  const mousePos = useRef<CursorPos>({ x: 0, y: 0 });
  const trailingPosRef = useRef<CursorPos>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
    };

    // Spring physics loop
    const updateTrailingCursor = () => {
      const stiffness = 400;
      const damping = 30;
      const springConstant = stiffness / 1000;
      const dampingFactor = damping / 1000;

      const dx = mousePos.current.x - trailingPosRef.current.x;
      const dy = mousePos.current.y - trailingPosRef.current.y;

      // Simple spring calculation: F = -kx, then update with damping
      const smooth = 0.08; // Damping coefficient
      trailingPosRef.current = {
        x: trailingPosRef.current.x + dx * smooth,
        y: trailingPosRef.current.y + dy * smooth,
      };

      setTrailingPos({ ...trailingPosRef.current });
      rafRef.current = requestAnimationFrame(updateTrailingCursor);
    };

    window.addEventListener('mousemove', handleMouseMove);
    rafRef.current = requestAnimationFrame(updateTrailingCursor);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Trailing hollow circle - smooth spring follow */}
      <div
        className="fixed pointer-events-none z-[9999] w-6 h-6 border-2 border-cyan-500 rounded-full"
        style={{
          left: `${trailingPos.x - 12}px`,
          top: `${trailingPos.y - 12}px`,
          opacity: 0.7,
          transform: 'translate(0, 0)',
          transition: 'none',
        }}
      />
    </>
  );
}
