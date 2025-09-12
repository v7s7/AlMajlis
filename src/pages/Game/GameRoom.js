// src/pages/GameRoom/GameRoom.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import {
  doc, onSnapshot, collection, getDocs, getDoc, updateDoc
} from "firebase/firestore";

function Timer() {
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!running) return;
    ref.current = setInterval(() => setMs((m) => m + 100), 100);
    return () => clearInterval(ref.current);
  }, [running]);
  const mm = String(Math.floor(ms / 60000)).padStart(2, "0");
  const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return (
    <div className="timer">
      <span className="timer__display">{mm}:{ss}</span>
      <button className="btn" onClick={()=>setRunning(v=>!v)}>{running ? "إيقاف" : "بدء"}</button>
      <button className="btn" onClick={()=>setMs(0)}>إعادة الضبط</button>
    </div>
  );
}

function ScoreCard({ name, score, onMinus, onPlus }) {
  const wrap = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "#fff",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "10px 12px",
    boxShadow: "0 2px 6px rgba(0,0,0,.06)",
  };
  const left = { display: "flex", alignItems: "center", gap: 10 };
  const team = {
    background: "var(--brand-pill)",
    color: "#fff",
    padding: "6px 14px",
    borderRadius: 999,
    fontWeight: 900,
    border: "1px solid #1e3a8a",
  };
  const points = { fontSize: 28, fontWeight: 900, color: "var(--text-color)" };
  const actions = { display: "flex", gap: 8 };
  const btn = {
    minWidth: 56,
    height: 44,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "#f8fbff",
    color: "#0f172a",
    fontWeight: 800,
    cursor: "pointer",
  };
  const btnPrimary = { ...btn, background: "var(--brand-1)", color: "#fff", borderColor: "#1e40af" };

  return (
    <div style={wrap} role="group" aria-label={`نقاط ${name}`}>
      <div style={left}>
        <span style={team}>{name}</span>
        <span style={points}>{score}</span>
      </div>
      <div style={actions}>
        <button style={btn} onClick={onMinus} aria-label="طرح 50">-</button>
        <button style={btnPrimary} onClick={onPlus} aria-label="إضافة 50">+</button>
      </div>
    </div>
  );
}

export default function GameRoom() {
  const { id } = useParams();
  const nav = useNavigate();

  const [game, setGame] = useState(null);
  const [cats, setCats] = useState([]);
  const [tiles, setTiles] = useState([]);

  // cache of prefetched question payloads by tile.id
  const qCache = useRef(new Map());

  // --- Subscribe to game doc (fast, cached) ---
  useEffect(() => {
    const gref = doc(db, "games", id);
    const unsub = onSnapshot(gref, (snap) => {
      if (!snap.exists()) return;
      setGame({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [id]);

  // --- Subscribe to tiles live (fast return from Answer) ---
  useEffect(() => {
    const tilesCol = collection(doc(db, "games", id), "game_tiles");
    const unsub = onSnapshot(tilesCol, (tsnap) => {
      const list = tsnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTiles(list);

      // If all tiles are opened, go to results (avoid loops)
      if (list.length > 0 && list.every(t => t.opened)) {
        if (!window.location.pathname.endsWith("/results")) {
          nav(`/game/${id}/results`);
        }
      }
    });
    return () => unsub();
  }, [id, nav]);

  // --- Load categories once (not on every game change) ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const gref = doc(db, "games", id);
      const catsSnap = await getDocs(collection(gref, "game_categories"));
      const raw = catsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.position - b.position);

      const enriched = await Promise.all(
        raw.map(async r => {
          const cs = await getDoc(doc(db, "categories", r.categoryId));
          const cd = cs.exists() ? cs.data() : { name: "(محذوف)", imageUrl: "" };
          return {
            position: r.position,
            categoryId: r.categoryId,
            name: cd.name,
            imageUrl: cd.imageUrl
          };
        })
      );
      if (!cancelled) setCats(enriched);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const columns = useMemo(() => (cats.length || 0), [cats]);
  const ROW_VALUES = [200, 200, 400, 400, 600, 600];

  // Fast lookup: "catPos:rowIndex" -> tile
  const tileIndex = useMemo(() => {
    const m = new Map();
    for (const t of tiles) m.set(`${t.categoryPosition}:${t.rowIndex}`, t);
    return m;
  }, [tiles]);

  function getCategoryNameForTile(t) {
    return cats.find(c => c.position === t?.categoryPosition)?.name || "";
  }

  async function prefetchTile(t) {
    if (!t || !t.questionId || qCache.current.has(t.id)) return;
    try {
      const qs = await getDoc(doc(db, "questions", t.questionId));
      if (!qs.exists()) return;
      const d = qs.data() || {};
      const q = {
        text: d.text || "",
        answer: d.answer || "",
        imageUrl: d.questionImageUrl || d.imageUrl || "",
        answerImageUrl: d.answerImageUrl || "",
      };
      if (q.imageUrl) {
        const img = new Image();
        img.fetchPriority = "high";
        img.decoding = "async";
        img.src = q.imageUrl;
      }
      qCache.current.set(t.id, q);
    } catch {
      // swallow prefetch errors
    }
  }

  function openTile(t) {
    if (!t || t.opened) return;
    const q = qCache.current.get(t.id) || null;
    const categoryName = getCategoryNameForTile(t);
    nav(`/game/${id}/tile/${t.id}`, {
      state: { game, tile: t, question: q, categoryName },
    });
  }

  async function adjustScore(teamKey, delta) {
    const gRef = doc(db, "games", id);
    const nextA = Math.max(0, (game?.teamAScore || 0) + (teamKey === "A" ? delta : 0));
    const nextB = Math.max(0, (game?.teamBScore || 0) + (teamKey === "B" ? delta : 0));
    try {
      await updateDoc(gRef, { teamAScore: nextA, teamBScore: nextB });
      setGame((old) => ({ ...old, teamAScore: nextA, teamBScore: nextB }));
    } catch (e) {
      alert("تعذّر تعديل النقاط. جرّب مرّة ثانية.");
      console.error(e);
    }
  }

  if (!game) return null;

  return (
    <>
      {/* Top bar */}
      <div className="appbar">
        <div className="appbar__row container">
          <div className="appbar__actions">
            <button className="btn" onClick={()=>nav(`/game/${id}/results`)}>إنهاء اللعبة</button>
          </div>
          <div className="appbar__title">
            {game.teamAName && game.teamBName ? `${game.teamAName} × ${game.teamBName}` : "Al Majlis"}
          </div>
          <div className="turn-badge">
            الدور: <strong>{game.turn === "A" ? game.teamAName : game.teamBName}</strong>
          </div>
        </div>
      </div>

      <div className="container">
        {/* Timer & End */}
        <div className="controls"></div>

        {/* Board */}
        <div className="board" style={{ ['--col-count']: columns }}>
          {cats.map((c, colIdx) => (
            <div key={c.position} className="col">
              <div className="cat-card">
                {c.imageUrl && <img className="cat-card__img" src={c.imageUrl} alt="" />}
                <div className="cat-card__label">{c.name}</div>
              </div>

              {ROW_VALUES.map((v, rowIdx) => {
                const t = tileIndex.get(`${colIdx + 1}:${rowIdx + 1}`);
                const opened = t?.opened;
                return (
                  <button
                    key={`${c.position}-${rowIdx}`}
                    className={`value-btn ${opened ? "is-opened" : ""}`}
                    onClick={() => openTile(t)}
                    onMouseEnter={() => prefetchTile(t)}
                    onFocus={() => prefetchTile(t)}
                    disabled={!t || opened}
                    aria-label={`افتح سؤال ${v} في ${c.name}`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Scores */}
        <div className="footer" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <ScoreCard
            name={game.teamAName}
            score={game.teamAScore || 0}
            onMinus={() => adjustScore("A", -50)}
            onPlus={() => adjustScore("A", +50)}
          />
          <ScoreCard
            name={game.teamBName}
            score={game.teamBScore || 0}
            onMinus={() => adjustScore("B", -50)}
            onPlus={() => adjustScore("B", +50)}
          />
        </div>
      </div>
    </>
  );
}
