// src/components/RotateGate.jsx
import { useEffect, useState, useCallback } from "react";

export default function RotateGate({ children, title = "Al Majlis" }) {
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== "undefined"
      ? window.matchMedia("(orientation: landscape)").matches
      : true
  );
  const [tryingLock, setTryingLock] = useState(false);
  const [lockError, setLockError] = useState("");

  useEffect(() => {
    const mql = window.matchMedia("(orientation: landscape)");
    const onChange = () => setIsLandscape(mql.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const tryFullscreenAndLock = useCallback(async () => {
    setTryingLock(true);
    setLockError("");
    try {
      // 1) Fullscreen request (required by many browsers for orientation lock)
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();

      // 2) Orientation lock (Android Chrome / installed PWA)
      if (screen.orientation?.lock) {
        await screen.orientation.lock("landscape");
      }
    } catch (e) {
      // Common on iOS Safari or when not in PWA
      setLockError(e?.message || "Orientation lock not available on this device/browser.");
    } finally {
      setTryingLock(false);
    }
  }, []);

  if (isLandscape) return children;

  return (
    <div className="rotate-overlay" role="dialog" aria-modal="true" aria-label="Rotate device">
      <div className="rotate-card">
        <div className="rotate-icon" aria-hidden>📱↻</div>
        <h2 className="rotate-title">{title}</h2>
        <p className="rotate-text">رجاءً حرّف الهاتف إلى الوضع الأفقي للحصول على عرض كامل مثل الشاشة الكبيرة.</p>

        <button className="rotate-btn" onClick={tryFullscreenAndLock} disabled={tryingLock}>
          {tryingLock ? "..." : "حاول التدوير تلقائياً"}
        </button>

        {lockError ? <p className="rotate-note">لا يمكن التدوير تلقائياً على هذا المتصفح. قم بتدوير الهاتف يدوياً.</p> : null}
      </div>
    </div>
  );
}
