import { useEffect } from "react";

const THRESHOLD = 10;
const CLICK_GUARD_MS = 450;

export function TouchScrollGuard() {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let moved = false;
    let guardUntil = 0;
    let clearTimer = 0;

    const arm = () => {
      moved = true;
      guardUntil = Date.now() + CLICK_GUARD_MS;
      document.documentElement.classList.add("is-scrolling");
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => {
        document.documentElement.classList.remove("is-scrolling");
      }, CLICK_GUARD_MS);
    };

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      moved = false;
    };

    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || moved) return;
      if (
        Math.abs(touch.clientX - startX) > THRESHOLD ||
        Math.abs(touch.clientY - startY) > THRESHOLD
      ) {
        arm();
      }
    };

    const onEnd = () => {
      if (!moved) return;
      guardUntil = Date.now() + CLICK_GUARD_MS;
    };

    const onClick = (event: MouseEvent) => {
      if (Date.now() > guardUntil) return;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    document.addEventListener("click", onClick, true);

    return () => {
      window.clearTimeout(clearTimer);
      document.documentElement.classList.remove("is-scrolling");
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
