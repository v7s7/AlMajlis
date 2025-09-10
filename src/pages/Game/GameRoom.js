// src/pages/GameRoom/GameRoom.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import {
  doc, onSnapshot, collection, getDocs, getDoc
} from "firebase/firestore";
import "../../styles/game.css";

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

export default function GameRoom() {
  const { id } = useParams();
  const nav = useNavigate();
  const [game, setGame] = useState(null);
  const [cats, setCats] = useState([]);
  const [tiles, setTiles] = useState([]);

  useEffect(() => {
    const gref = doc(db, "games", id);
    const unsub = onSnapshot(gref, async (snap) => {
      if (!snap.exists()) return;
      const g = snap.data();
      setGame({ id: snap.id, ...g });

      // categories (ordered)
      const catsSnap = await getDocs(collection(gref, "game_categories"));
      const raw = catsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a,b)=>a.position-b.position);

      const enriched = await Promise.all(raw.map(async r => {
        const cs = await getDoc(doc(db, "categories", r.categoryId));
        const cd = cs.exists() ? cs.data() : { name: "(محذوف)", imageUrl:"" };
        return { position: r.position, categoryId: r.categoryId, name: cd.name, imageUrl: cd.imageUrl };
      }));
      setCats(enriched);

      // tiles
      const tsnap = await getDocs(collection(gref, "game_tiles"));
      setTiles(tsnap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [id]);

  const columns = useMemo(() => (cats.length || 0), [cats]);

  // 6-row sequence (matches seeding)
  const ROW_VALUES = [200, 200, 400, 400, 600, 600];

  // Fast lookup: "catPos:rowIndex" -> tile
  const tileIndex = useMemo(() => {
    const m = new Map();
    for (const t of tiles) {
      // categoryPosition and rowIndex are 1-based in seeding
      m.set(`${t.categoryPosition}:${t.rowIndex}`, t);
    }
    return m;
  }, [tiles]);

  function openTile(t) {
    if (!t || t.opened) return;
    nav(`/game/${id}/tile/${t.id}`); // go full-screen question page
  }

  if (!game) return null;

  return (
    <>
      {/* Top bar */}
      <div className="appbar">
        <div className="appbar__row container">
          <div className="appbar__actions">
            <button className="btn" onClick={()=>nav(-1)}>الرجوع للوحة</button>
            <button className="btn" onClick={()=>nav(`/game/${id}/results`)}>انتهاء اللعبة</button>
          </div>
          <div className="appbar__title">
            {game.teamAName && game.teamBName ? `${game.teamAName} × ${game.teamBName}` : "Al Majlis"}
          </div>
          <div className="turn-badge">
            دور فريق: <strong>{game.turn === "A" ? game.teamAName : game.teamBName}</strong>
          </div>
        </div>
      </div>

      <div className="container">
        {/* Timer & End */}
        <div className="controls">
          <Timer />
          <div>
            <button className="btn" onClick={()=>nav(`/game/${id}/results`)}>إنهاء مبكر</button>
          </div>
        </div>

        {/* Board */}
        <div className="board" style={{ ['--col-count']: columns }}>
          {cats.map((c, colIdx) => (
            <div key={c.position} className="col">
              <div className="cat-card">
                {c.imageUrl && <img className="cat-card__img" src={c.imageUrl} alt="" />}
                <div className="cat-card__label">{c.name}</div>
              </div>

              {ROW_VALUES.map((v, rowIdx) => {
                // Lookup by (categoryPosition, rowIndex)
                const t = tileIndex.get(`${colIdx + 1}:${rowIdx + 1}`);
                const opened = t?.opened;
                return (
                  <button
                    key={`${c.position}-${rowIdx}`}
                    className={`value-btn ${opened ? "is-opened" : ""}`}
                    onClick={() => openTile(t)}
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

        {/* Footer scores */}
        <div className="footer">
          <div className="team-panel">
            <button className="score-btn">−</button>
            <div className="team-name">{game.teamBName}</div>
            <div className="score">{game.teamBScore || 0}</div>
            <button className="score-btn">＋</button>
          </div>
          <div className="helpers">وسائل المساعدة</div>
          <div className="team-panel">
            <button className="score-btn">−</button>
            <div className="team-name">{game.teamAName}</div>
            <div className="score">{game.teamAScore || 0}</div>
            <button className="score-btn">＋</button>
          </div>
        </div>
      </div>
    </>
  );
}
