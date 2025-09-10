// src/pages/Dashboard.jsx
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { useMemo, useState, useCallback } from "react";

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
  // safer 6-digit hex (was 8-digit)
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
  name: { fontWeight: 700, color: "#0f172a" },
  chips: { display: "flex", alignItems: "center", gap: 10 },

  // Primary CTA stays as-is
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

  // Medium pill (e.g., لوحة المشرف) — matches screenshot ghost style
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

  // Small pill (e.g., خروج) — smaller size from the screenshot
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
  // use a real weight (70 -> 600)
  heroSub: { fontSize: 31, fontWeight: 60 },
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

  const handleSignOut = useCallback(async () => {
    try { setSigningOut(true); await signOut(auth); nav("/login"); }
    catch { setSigningOut(false); alert("صار خلل بالخروج. جرّب مرّة ثانية."); }
  }, [nav]);

  return (
    <div style={styles.page} dir="rtl">
      {/* Top bar */}
      <div style={styles.topbarWrap}>
        <div style={{ ...styles.topbar, ...styles.shell }}>
          {/* Right nav (مثل: العب | تواصل معنا | ألعابي) */}
          <div style={styles.rightNav}>
            <Link to="/new" style={styles.navLink}>العب</Link>
            <Link to="/contact" style={styles.navLink}>تواصل معنا</Link>
          </div>

          {/* Brand (استبدل النص بشعارك إن وُجد) */}
          <div style={styles.brand}>
            <div style={styles.brandText}>المجلس</div>
          </div>

          {/* User & chips (يسار) */}
          <div style={styles.leftUser}>
            <div style={styles.name}>UserName</div>
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
<p style={styles.heroSub}>  تبي تشوف الفئات الموجودة؟ أو تبي تلعب لعبة جديدة؟ اضغط (لعبة جديدة).
</p>
<p style={styles.heroSub}>  لشراء لعبة جديدة اضغط (شراء العاب)
</p>

          <div style={styles.ctas}>
            <Link to="/new" style={styles.btnPrimary}>لعبة جديدة</Link>
            <Link to="/games" style={styles.btnGhost}>شراء العاب</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
