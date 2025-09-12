// src/pages/Dashboard.jsx
import { Link, useNavigate } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";
import { useMemo, useState, useCallback, useEffect } from "react";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #dbeafe 0%, #c7e2ff 45%, #bfe4ff 100%)",
    color: "#0f172a",
  },
  shell: { maxWidth: 1200, margin: "0 auto" },
  topbarWrap: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "#eff6ffcc",
    backdropFilter: "blur(6px)",
    borderBottom: "1px solid #dbeafe",
  },
  topbar: {
    height: 68,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
  },
  rightNav: { display: "flex", alignItems: "center", gap: 28 },
  navLink: { color: "#0f172a", textDecoration: "none", fontWeight: 800, fontSize: 20 },

  // شارة "الألعاب المتبقية"
  gamesLeftPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#e8fff3",
    color: "#065f46",
    border: "2px solid #bbf7d0",
    fontWeight: 900,
    fontSize: 14,
    lineHeight: 1,
  },

  navPillActive: {
    padding: "8px 18px",
    borderRadius: 999,
    background: "#1d4ed8",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 18,
    boxShadow: "0 6px 18px rgba(29,78,216,.25)",
  },
  brand: { display: "flex", alignItems: "center", gap: 10 },
  brandLogo: {
    width: 46,
    height: 46,
    borderRadius: 12,
    background: "linear-gradient(180deg,#1d4ed8,#60a5fa)",
    display: "grid",
    placeItems: "center",
    color: "#fff",
    fontWeight: 900,
  },
  brandText: { fontSize: 28, lineHeight: 1, fontWeight: 900, color: "#3d4aff" },
  leftUser: { display: "flex", alignItems: "center", gap: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "#cbd5e1",
    display: "grid",
    placeItems: "center",
    color: "#475569",
    fontWeight: 800,
  },
  name: { fontSize: 20, fontWeight: 700, color: "#0f172a" },
  chips: { display: "flex", alignItems: "center", gap: 10 },

  chipPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#1d4ed8",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 800,
    border: "1px solid #1e40af",
    transition: "transform .05s ease",
  },

  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    borderRadius: 999,
    background: "#ECF6FF",
    color: "#0B5CAD",
    border: "2px solid #CFE7FF",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 16,
    lineHeight: 1,
    transition: "transform .05s ease, background .15s ease, border-color .15s ease",
  },

  chipSm: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    borderRadius: 999,
    background: "#ECF6FF",
    color: "#0B5CAD",
    border: "2px solid #CFE7FF",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
    lineHeight: 1,
    transition: "transform .05s ease, background .15s ease, border-color .15s ease",
  },

  hero: {
    padding: "56px 16px 64px",
    background: "linear-gradient(90deg,#93c5fd 0%, #8dd5ff 50%, #bfe4ff 100%)",
    color: "#fff",
  },
  heroInner: { maxWidth: 1000, margin: "0 auto", textAlign: "center" },
  heroTitle: { fontSize: 60, fontWeight: 900, marginBottom: 12 },
  // fix: fontWeight was '60' (invalid). Use 600.
  heroSub: { fontSize: 31, fontWeight: 600 },
  ctas: { marginTop: 28, display: "flex", gap: 18, justifyContent: "center", flexWrap: "wrap" },

  btnPrimary: {
    padding: "16px 28px",
    borderRadius: 999,
    background: "#1d4ed8",
    color: "#fff",
    fontWeight: 900,
    fontSize: 20,
    border: "1px solid #1e40af",
    textDecoration: "none",
    boxShadow: "0 10px 28px rgba(29,78,216,.28)",
  },
  btnGhost: {
    padding: "16px 28px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#1e3a8a",
    fontWeight: 900,
    fontSize: 20,
    border: "1px solid #c7d2fe",
    textDecoration: "none",
  },
};

export default function Dashboard() {
  const role = useMemo(() => window.__ALMAJLIS__?.role || "user", []);
  const nav = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [userName, setUserName] = useState("");
  const [gamesLeft, setGamesLeft] = useState(null); // credits pill

  useEffect(() => {
    let unsubUser = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // clean previous user subscription (if any)
      if (unsubUser) { unsubUser(); unsubUser = null; }

      if (!user) {
        setUserName("");
        setGamesLeft(null);
        return;
      }

      const uref = doc(db, "users", user.uid);

      // Seed user doc if missing (do NOT touch gamesRemaining here)
      getDoc(uref)
        .then((snap) => {
          if (!snap.exists()) {
            setDoc(uref, { name: user.displayName || "" }, { merge: true })
              .catch(console.error);
          }
        })
        .catch(console.error);

      // Live subscription so credits update immediately after a purchase/webhook
      unsubUser = onSnapshot(
        uref,
        (snap) => {
          const data = snap.exists() ? snap.data() : {};
          const name = (user.displayName || data?.name || "").trim();
          setUserName(name);
          const remaining = Number(data?.gamesRemaining ?? 0);
          setGamesLeft(Number.isFinite(remaining) ? remaining : 0);
        },
        (err) => {
          console.error(err);
          setUserName((user.displayName || "").trim());
          setGamesLeft(0);
        }
      );
    });

    // cleanup both listeners on unmount
    return () => {
      if (unsubUser) unsubUser();
      unsubAuth();
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    try { setSigningOut(true); await signOut(auth); nav("/login"); }
    catch { setSigningOut(false); alert("صار خلل بالخروج. جرّب مرّة ثانية."); }
  }, [nav]);

  return (
    <div style={styles.page} dir="rtl">
      {/* Top bar */}
      <div style={styles.topbarWrap}>
        <div style={{ ...styles.topbar, ...styles.shell }}>
          {/* Right nav */}
          <div style={styles.rightNav}>
            <Link to="/new" style={styles.navLink}>العب</Link>
            <Link to="/contact" style={styles.navLink}>تواصل معنا</Link>

            {/* الألعاب المتبقية */}
            {typeof gamesLeft === "number" && (
              <span style={styles.gamesLeftPill} title="الألعاب المتبقية">
                الألعاب المتبقية: <strong>{gamesLeft}</strong>
              </span>
            )}
          </div>

          {/* Brand */}
          <div style={styles.brand}>
            <div style={styles.brandText}>المجلس</div>
          </div>

          {/* User & chips */}
          <div style={styles.leftUser}>
            <div style={styles.name}>أهلا , {userName || "ضيف"}</div>
            <div style={styles.chips}>
              <Link to="/new" style={styles.chipPrimary}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                </svg>
                انشئ لعبة جديدة
              </Link>

              {role === "admin" && (
                <Link
                  to="/admin"
                  style={styles.chip}
                  onMouseDown={(e)=>e.currentTarget.style.transform="scale(0.98)"}
                  onMouseUp={(e)=>e.currentTarget.style.transform="scale(1)"}
                  onMouseLeave={(e)=>e.currentTarget.style.transform="scale(1)"}
                  onKeyDown={(e)=>([" ","Enter"].includes(e.key) && (e.currentTarget.style.transform="scale(0.98)"))}
                  onKeyUp={(e)=>([" ","Enter"].includes(e.key) && (e.currentTarget.style.transform="scale(1)"))}
                >
                  لوحة المشرف
                </Link>
              )}

              <button
                onClick={handleSignOut}
                disabled={signingOut}
                style={styles.chip}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onKeyDown={(e) => ([" ", "Enter"].includes(e.key) && (e.currentTarget.style.transform = "scale(0.98)"))}
                onKeyUp={(e) => ([" ", "Enter"].includes(e.key) && (e.currentTarget.style.transform = "scale(1)"))}
              >
                {signingOut ? "جاري الخروج..." : "خروج"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section style={styles.hero}>
        <div style={styles.heroInner}>
          <h1 style={styles.heroTitle}>لعبة جماعية نختبر فيها معرفتكم</h1>
          <p style={styles.heroSub}>
            تبي تشوف الفئات الموجودة؟ أو تبي تلعب لعبة جديدة؟ اضغط (لعبة جديدة).
          </p>
          <p style={styles.heroSub}>
            لشراء لعبة جديدة اضغط (شراء لعبة)
          </p>

          <div style={styles.ctas}>
            <Link to="/new" style={styles.btnPrimary}>لعبة جديدة</Link>
            <button type="button" style={styles.btnGhost} onClick={() => nav("/games")}>
              شراء ألعاب
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
