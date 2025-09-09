import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import {
  doc, onSnapshot, collection, getDocs, getDoc, updateDoc
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
  const [cats, setCats] = useState([]);       // [{position, categoryId, name, imageUrl}]
  const [tiles, setTiles] = useState([]);     // [{id, categoryPosition, value, opened, questionId}]
  const [modal, setModal] = useState(null);   // {tile, question, revealed:boolean}

  useEffect(() => {
    const gref = doc(db, "games", id);
    const unsub = onSnapshot(gref, async (snap) => {
      if (!snap.exists()) return;
      const g = snap.data();
      setGame({ id: snap.id, ...g });

      // categories
      const catsSnap = await getDocs(collection(gref, "game_categories"));
      const raw = catsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=>a.position-b.position);
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
  const values = [200, 400, 600];

  async function openTile(t) {
    if (!t || t.opened) return;
    const qs = await getDoc(doc(db, "questions", t.questionId));
    const qd = qs.exists() ? qs.data() : { text: "(مفقود)", answer:"", imageUrl:"" };
    setModal({ tile: t, question: qd, revealed: false });
  }

  async function assign(to) {
    if (!modal) return;
    const t = modal.tile;
    const gref = doc(db, "games", id);
    const tref = doc(gref, "game_tiles", t.id);

    const newScores = { teamAScore: game.teamAScore || 0, teamBScore: game.teamBScore || 0 };
    let correct = false;
    if (to === "A" || to === "B") {
      correct = true;
      if (to === "A") newScores.teamAScore += t.value;
      else newScores.teamBScore += t.value;
    }

    await updateDoc(tref, { opened: true, answeredBy: to, correct });
    await updateDoc(gref, {
      teamAScore: newScores.teamAScore,
      teamBScore: newScores.teamBScore,
      turn: (game.turn === "A" ? "B" : "A")
    });

    setModal(null);

    // Check if all opened
    const stillClosed = tiles.filter(x => !x.opened && x.id !== t.id);
    if (stillClosed.length === 0) nav(`/game/${id}/results`);
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
          <div className="appbar__title">{game.teamAName && game.teamBName ? `${game.teamAName} × ${game.teamBName}` : "Al Majlis"}</div>
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
              {values.map(v => {
                const t = tiles.find(x => x.categoryPosition === (colIdx + 1) && x.value === v);
                const opened = t?.opened;
                return (
                  <button
                    key={v}
                    className="value-btn"
                    onClick={()=>openTile(t)}
                    disabled={!t || opened}
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

      {/* Question modal */}
      {modal && (
        <div className="modal">
          <div className="modal__head"><strong>{modal.tile.value} نقطة</strong></div>
          {modal.question.imageUrl && (
            <img src={modal.question.imageUrl} alt="" className="modal__img" />
          )}
          <div className="modal__body">
            {!modal.revealed ? modal.question.text : `الإجابة: ${modal.question.answer}`}
          </div>
          <div className="modal__actions">
            {!modal.revealed ? (
              <button className="btn" onClick={()=>setModal(m=>({...m, revealed:true}))}>إظهار الإجابة</button>
            ) : (
              <>
                <button className="btn btn--a" onClick={()=>assign("A")}>لفريق {game.teamAName}</button>
                <button className="btn btn--b" onClick={()=>assign("B")}>لفريق {game.teamBName}</button>
                <button className="btn" onClick={()=>assign("none")}>لا أحد</button>
              </>
            )}
            <button className="btn" onClick={()=>setModal(null)}>إغلاق</button>
          </div>
        </div>
      )}
    </>
  );
}
