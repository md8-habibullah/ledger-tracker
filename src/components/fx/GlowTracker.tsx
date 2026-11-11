import { useEffect } from "react";

/**
 * Tilting a banknote shifts its foil. This is the same idea for every glass panel: while the pointer is over
 * one, we set the spotlight position (--mx/--my) and the foil's hue angle (--ang) on that panel only.
 * One listener for the whole app, one panel updated per frame, nothing on touch screens.
 */
export function GlowTracker() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let panel: HTMLElement | null = null;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      if (!panel) return;
      const box = panel.getBoundingClientRect();
      const px = x - box.left;
      const py = y - box.top;
      panel.style.setProperty("--mx", `${px.toFixed(0)}px`);
      panel.style.setProperty("--my", `${py.toFixed(0)}px`);
      const angle = (Math.atan2(py - box.height / 2, px - box.width / 2) * 180) / Math.PI + 90;
      panel.style.setProperty("--ang", `${angle.toFixed(0)}deg`);
    };
    const onMove = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(".glass") : null;
      panel = target;
      x = event.clientX;
      y = event.clientY;
      if (panel && !frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
