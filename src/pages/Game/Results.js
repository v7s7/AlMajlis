// src/pages/Game/Results.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
} from "firebase/firestore";

export default function Results() {
  const { id } = useParams();
  const nav = useNavigate();

  const [game, setGame] = useState(null);
  const [cats, setCats] = useState([]);    // [{position, categoryId, name}]
  const [tiles, setTiles] = useState([]);  // tiles of the game
  const [loading, setLoading] = useState(true);

  // Winner memo (safe defaults)
  const winner = useMemo(() => {
    const a = game?.teamAScore ?? 0;
    const b = game?.teamBScore ?? 0;
    if (a === b) return "TIE";
    return a > b ? "A" : "B";
  }, [game]);

  // Group tiles by category position (hook must be above early returns)
  const tilesByCat = useMemo(() => {
    const map = new Map();
    for (const t of tiles) {
      const key = t.categoryPosition;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    for (const arr of map.values()) {
      arr.sort((x, y) => x.rowIndex - y.rowIndex);
    }
    return map;
  }, [tiles]);

  // Tiny confetti (no deps) — hook stays above early return
  const confettiRef = useRef(null);
  useEffect(() => {
    if (!game) return;
    const canvas = confettiRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const onResize = () => {
      w = (canvas.width = window.innerWidth);
      h = (canvas.height = window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    const colors = ["#60a5fa", "#22c55e", "#f59e0b", "#ef4444", "#a78bfa", "#14b8a6"];
    const particles = Array.from({ length: 140 }, () => ({
      x: Math.random() * w,
      y: -20 - Math.random() * h * 0.4,
      s: 4 + Math.random() * 6,
      a: Math.random() * Math.PI * 2,
      v: 1 + Math.random() * 3.2,
      color: colors[(Math.random() * colors.length) | 0],
      spin: (Math.random() - 0.5) * 0.3,
    }));

    let stopped = false;
    const start = performance.now();
    function tick(t) {
      if (stopped) return;
      const elapsed = t - start;
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.y += p.v;
        p.a += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 1.6);
        ctx.restore();
        if (p.y > h + 40) {
          p.y = -20;
          p.x = Math.random() * w;
        }
      });
      if (elapsed < 2500) requestAnimationFrame(tick);
      else stopped = true;
    }
    requestAnimationFrame(tick);

    return () => window.removeEventListener("resize", onResize);
  }, [game]);

  // Load data once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);

        const gref = doc(db, "games", id);
        const gs = await getDoc(gref);
        if (!gs.exists()) return;

        const gdata = { id: gs.id, ...gs.data() };
        if (!cancelled) setGame(gdata);

        // Mark as ended if not yet
        if (gdata.status !== "ended") {
          updateDoc(gref, { status: "ended", endedAt: serverTimestamp() }).catch(() => {});
        }

        // Categories (ordered)
        const catsSnap = await getDocs(collection(gref, "game_categories"));
        const rawCats = catsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.position - b.position);

        const named = [];
        for (const r of rawCats) {
          const cs = await getDoc(doc(db, "categories", r.categoryId));
          named.push({
            position: r.position,
            categoryId: r.categoryId,
            name: cs.exists() ? cs.data()?.name || "" : "(محذوف)",
          });
        }
        if (!cancelled) setCats(named);

        // Tiles
        const tileSnap = await getDocs(collection(gref, "game_tiles"));
        const list = tileSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!cancelled) setTiles(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Early return AFTER all hooks are declared
  if (loading || !game) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#0f172a" }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Loading results…</div>
      </div>
    );
  }

  const a = game.teamAScore || 0;
  const b = game.teamBScore || 0;
  const isTie = winner === "TIE";
  const winnerName = isTie ? "تعادل" : winner === "A" ? game.teamAName : game.teamBName;
  const diff = Math.abs(a - b);

  return (
    <div style={styles.page} dir="rtl">
      <canvas ref={confettiRef} style={styles.canvas} />

      <div style={styles.shell}>
        {/* Header card */}
        <div style={styles.headerCard}>
          <div style={styles.headerInner}>
            <div style={styles.badge}>نتيجة المباراة</div>

            <div style={styles.title}>{isTie ? "تعادل!" : "الفائز"}</div>

            <div style={styles.podium}>
              {!isTie ? (
                <>
                  <div style={styles.winnerName}>{winnerName}</div>
                  <div style={styles.scoreline}>
                    <span style={styles.scoreA}>{a}</span>
                    <span style={styles.times}>×</span>
                    <span style={styles.scoreB}>{b}</span>
                  </div>
                  <div style={styles.delta}>{diff > 0 ? `بفارق ${diff} نقطة` : ""}</div>
                </>
              ) : (
                <>
                  <div style={styles.winnerName}>تعادل</div>
                  <div style={styles.scoreline}>
                    <span style={styles.scoreA}>{a}</span>
                    <span style={styles.times}>×</span>
                    <span style={styles.scoreB}>{b}</span>
                  </div>
                </>
              )}
            </div>

            <div style={styles.actions}>
              <Link to="/" style={{ textDecoration: "none" }}>
                <button style={styles.primaryBtn}>العودة للرئيسية</button>
              </Link>
              <button style={styles.ghostBtn} onClick={() => nav("/new")}>
                لعبة جديدة
              </button>
            </div>
          </div>
        </div>

        {/* Breakdown */}
       
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg,#eaf2ff,#ffffff)",
    color: "#0f172a",
    position: "relative",
    overflowX: "hidden",
    paddingBottom: 40,
  },
  canvas: {
    position: "fixed",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: 0,
  },
  shell: { maxWidth: 1100, margin: "0 auto", padding: "20px 16px", position: "relative", zIndex: 1 },

  headerCard: {
    borderRadius: 24,
    border: "2px solid #bed7ff",
    background: "linear-gradient(180deg,#f6fbff,#ffffff)",
    boxShadow: "0 20px 40px rgba(17,24,39,.08)",
    overflow: "hidden",
  },
  headerInner: {
    padding: "28px 20px 24px",
    display: "grid",
    gap: 8,
    justifyItems: "center",
    textAlign: "center",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#e0efff",
    color: "#0b5cad",
    border: "1px solid #cfe7ff",
    padding: "6px 12px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 14,
  },
  title: { fontSize: 28, fontWeight: 900, marginTop: 6, color: "#1e3a8a" },
  podium: { marginTop: 6, display: "grid", gap: 6, justifyItems: "center" },
  winnerName: { fontSize: 26, fontWeight: 900 },
  scoreline: { display: "flex", alignItems: "baseline", gap: 12, marginTop: 2 },
  scoreA: { fontSize: 40, fontWeight: 900, color: "#1d4ed8" },
  times: { fontSize: 26, fontWeight: 900, color: "#334155" },
  scoreB: { fontSize: 40, fontWeight: 900, color: "#1d4ed8" },
  delta: { marginTop: 2, color: "#0b5cad", fontWeight: 800 },

  actions: { display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap", justifyContent: "center" },
  primaryBtn: {
    padding: "12px 20px",
    borderRadius: 999,
    background: "#1d4ed8",
    border: "1px solid #1e40af",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(29,78,216,.22)",
  },
  ghostBtn: {
    padding: "12px 20px",
    borderRadius: 999,
    background: "#ECF6FF",
    color: "#0B5CAD",
    border: "2px solid #CFE7FF",
    fontWeight: 900,
    cursor: "pointer",
  },

  sectionTitle: { marginTop: 20, fontSize: 20, fontWeight: 900, color: "#0b5cad" },
  grid: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
    gap: 12,
  },
  card: {
    background: "#fff",
    borderRadius: 18,
    border: "1px solid #dbeafe",
    boxShadow: "0 8px 20px rgba(0,0,0,.06)",
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "auto 1fr",
  },
  cardHead: {
    padding: "12px 14px",
    background: "linear-gradient(90deg,#eaf2ff 0%, #f7fbff 100%)",
    borderBottom: "1px solid #e5efff",
  },
  cardTitle: { fontWeight: 900, color: "#1e3a8a" },
  cardBody: { padding: 10, display: "grid", gap: 8 },
  empty: { color: "#64748b", fontWeight: 700 },

  row: {
    display: "grid",
    gridTemplateColumns: "64px 1fr auto auto",
    alignItems: "center",
    gap: 10,
    border: "1px solid #eef5ff",
    borderRadius: 12,
    padding: "8px 10px",
    background: "#fbfdff",
  },
  valuePill: {
    justifySelf: "start",
    background: "#1d4ed8",
    color: "#fff",
    padding: "6px 10px",
    borderRadius: 12,
    fontWeight: 900,
    textAlign: "center",
    minWidth: 52,
  },
  qtext: {
    color: "#0f172a",
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tag: { fontWeight: 900 },
  by: { color: "#334155", fontWeight: 800, justifySelf: "end" },
};
