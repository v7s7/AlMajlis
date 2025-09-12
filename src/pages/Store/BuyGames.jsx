// src/pages/Store/BuyGames.jsx
import { useMemo, useState, useCallback } from "react";
import { auth } from "../../firebase";
import { useNavigate } from "react-router-dom";

const styles = {
  wrap: { minHeight: "100vh", background: "#eef4ff", color: "#0f172a" },
  shell: { maxWidth: 960, margin: "0 auto", padding: "32px 16px" },
  title: { fontSize: 32, fontWeight: 900, textAlign: "center", marginBottom: 12 },
  sub: { textAlign: "center", color: "#475569", marginBottom: 26 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 14,
    marginTop: 10,
  },
  card: {
    background: "#fff",
    border: "2px solid #cfe7ff",
    borderRadius: 16,
    padding: 16,
    cursor: "pointer",
    userSelect: "none",
    transition: "transform .06s ease, box-shadow .15s ease, border-color .15s ease",
  },
  cardActive: {
    borderColor: "#1d4ed8",
    boxShadow: "0 8px 22px rgba(29,78,216,.18)",
    transform: "translateY(-1px)",
  },
  cardTitle: { fontWeight: 900, fontSize: 18, marginBottom: 6 },
  price: { fontWeight: 900, fontSize: 22 },
  foot: { display: "flex", gap: 10, marginTop: 18, alignItems: "center" },
  input: {
    flex: 1,
    height: 44,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #cfe7ff",
    background: "#fff",
    fontSize: 16,
  },
  btn: {
    height: 48,
    padding: "0 20px",
    borderRadius: 999,
    border: 0,
    background: "#1d4ed8",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 26px rgba(29,78,216,.22)",
  },
  back: {
    display: "inline-block",
    marginTop: 16,
    color: "#0b5cad",
    textDecoration: "underline",
    cursor: "pointer",
    fontWeight: 700,
  },
};

// FIX: Use explicit env mapping at build-time (more reliable than dynamic process.env[key])
const PLANS = [
  { key: "1", label: "لعبة واحدة", url: process.env.REACT_APP_LS_BUY_1, price: "BHD 1.500" },
  { key: "2", label: "٢ ألعاب",    url: process.env.REACT_APP_LS_BUY_2, price: "BHD 2.500" },
  { key: "5", label: "٥ ألعاب",    url: process.env.REACT_APP_LS_BUY_5, price: "BHD 5.500" },
  { key: "8", label: "٨ ألعاب",    url: process.env.REACT_APP_LS_BUY_8, price: "BHD 8.500" },
];

export default function BuyGames() {
  const nav = useNavigate();
  const [sel, setSel] = useState(null);
  const [coupon, setCoupon] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  // Selected plan object
  const selPlan = useMemo(() => PLANS.find(p => p.key === sel) || null, [sel]);

  // Resolve checkout link from env (fixed to use .url)
  const checkoutBase = useMemo(() => (selPlan?.url && typeof selPlan.url === "string" ? selPlan.url : ""), [selPlan]);

  const gotoCheckout = useCallback(() => {
    if (!selPlan) {
      alert("اختر باقة أولاً.");
      return;
    }
    if (!checkoutBase) {
      alert("رابط الدفع غير مهيأ. تأكد من إعداد متغيّر البيئة الصحيح.");
      return;
    }

    // Ensure URL is valid
    let url;
    try {
      url = new URL(checkoutBase);
      // Optional hardening: require https (message already hints at it)
      if (url.protocol !== "https:") throw new Error("must be https");
    } catch {
      alert("رابط الدفع غير صالح. تأكد من أنه يبدأ بـ https://");
      return;
    }

    // UID to match order later (webhook)
    const uid =
      auth.currentUser?.uid ||
      window.__ALMAJLIS__?.user?.uid ||
      "";

    // Redirects
    url.searchParams.set("checkout[success_url]", `${window.location.origin}/pay/success`);
    url.searchParams.set("checkout[cancel_url]", `${window.location.origin}/pay/cancel`);

    // Attach custom meta for the webhook to use
    if (uid) url.searchParams.set("checkout[custom][uid]", uid);
    url.searchParams.set("checkout[custom][planKey]", selPlan.key);
    url.searchParams.set("checkout[custom][credits]", String(Number(selPlan.key) || 0));

    // Coupon (Lemon Squeezy accepts `discount`; some setups use checkout[discount_code])
    const code = coupon.trim();
    if (code) {
      url.searchParams.set("discount", code);
      url.searchParams.set("checkout[discount_code]", code); // harmless fallback
    }

    setRedirecting(true);
    window.location.href = url.toString();
  }, [selPlan, checkoutBase, coupon]);

  return (
    <div style={styles.wrap} dir="rtl">
      <div style={styles.shell}>
        <h1 style={styles.title}>شراء ألعاب</h1>
        <p style={styles.sub}>اختر الباقة المناسبة أو أدخل كوبون خصم</p>

        <div style={styles.grid}>
          {PLANS.map((p) => {
            const active = sel === p.key;
            return (
              <div
                key={p.key}
                role="button"
                tabIndex={0}
                aria-pressed={active ? "true" : "false"}
                style={{ ...styles.card, ...(active ? styles.cardActive : null) }}
                onClick={() => setSel(p.key)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? setSel(p.key) : null)}
              >
                <div style={styles.cardTitle}>{p.label}</div>
                <div style={styles.price}>{p.price}</div>
              </div>
            );
          })}
        </div>

        <div style={styles.foot}>
          <input
            style={styles.input}
            placeholder="كوبون خصم (اختياري)"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            dir="ltr"
            inputMode="text"
          />
          <button
            style={{ ...styles.btn, opacity: !selPlan || redirecting ? 0.7 : 1 }}
            onClick={gotoCheckout}
            disabled={!selPlan || redirecting}
            aria-busy={redirecting ? "true" : "false"}
          >
            {redirecting ? "جارٍ التحويل..." : "ادفع الآن"}
          </button>
        </div>

        <span style={styles.back} onClick={() => nav("/")}>← الرجوع للواجهة</span>
      </div>
    </div>
  );
}
