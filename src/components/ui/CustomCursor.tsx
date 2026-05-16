import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface CursorPosition {
  x: number;
  y: number;
}

interface HoveredElement {
  isClickable: boolean;
}

export function CustomCursor() {
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({ x: 0, y: 0 });
  const [ringPosition, setRingPosition] = useState<CursorPosition>({ x: 0, y: 0 });
  const [isHoveringClickable, setIsHoveringClickable] = useState(false);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Hide default cursor
    document.documentElement.style.cursor = 'none';
    document.body.style.cursor = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      
      // Update center dot position immediately
      setCursorPosition({ x: clientX, y: clientY });

      // Smooth ring follow with spring physics
      setRingPosition((prev) => {
        const dx = clientX - prev.x;
        const dy = clientY - prev.y;
        return {
          x: prev.x + dx * 0.15, // Damping factor for smooth follow
          y: prev.y + dy * 0.15,
        };
      });

      // Check if hovering over clickable elements
      const target = e.target as HTMLElement;
      const isClickable =
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') !== null ||
        target.closest('a') !== null ||
        target.closest('[role="button"]') !== null;
      
      setIsHoveringClickable(isClickable);
    };

    const handleMouseLeave = () => {
      setIsHoveringClickable(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.documentElement.style.cursor = 'auto';
      document.body.style.cursor = 'auto';
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <>
      {/* Center Dot */}
      <motion.div
        className="fixed w-1.5 h-1.5 bg-cyan-400 rounded-full pointer-events-none z-[9999] shadow-lg shadow-cyan-400/50"
        animate={{
          x: cursorPosition.x - 3,
          y: cursorPosition.y - 3,
        }}
        transition={{
          type: 'instant',
        }}
        style={{
          mixBlendMode: 'screen',
        }}
      />

      {/* Outer Ring/Reticle */}
      <motion.div
        ref={ringRef}
        className="fixed w-8 h-8 border-2 border-cyan-500 rounded-full pointer-events-none z-[9998] flex items-center justify-center"
        animate={{
          x: ringPosition.x - 16,
          y: ringPosition.y - 16,
          opacity: isHoveringClickable ? 0.8 : 0.5,
          scale: isHoveringClickable ? 1.2 : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 28,
        }}
        style={{
          mixBlendMode: 'screen',
        }}
      >
        {/* Inner reticle brackets */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Top-left bracket */}
          <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-cyan-500" />
          {/* Top-right bracket */}
          <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-cyan-500" />
          {/* Bottom-left bracket */}
          <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-cyan-500" />
          {/* Bottom-right bracket */}
          <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-cyan-500" />
        </div>
      </motion.div>

      {/* Optional: Crosshair center line (subtle) */}
      <motion.div
        className="fixed w-4 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent pointer-events-none z-[9997]"
        animate={{
          x: cursorPosition.x - 8,
          y: cursorPosition.y,
        }}
        transition={{
          type: 'instant',
        }}
      />
    </>
  );
}
