// src/pages/QuestionPage/QuestionPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../firebase";
import {
  collection, doc, getDoc, getDocs, query
} from "firebase/firestore";
import "../../styles/questionpage.css";

function useCountUp(autoStart = true) {
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(autoStart);
  const ref = useRef(null);
  useEffect(() => {
    if (!running) return;
    ref.current = setInterval(() => setMs(m => m + 100), 100);
    return () => clearInterval(ref.current);
  }, [running]);
  const mm = String(Math.floor(ms / 60000)).padStart(2, "0");
  const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return { mm, ss, running, toggle:()=>setRunning(v=>!v), reset:()=>setMs(0) };
}

export default function QuestionPage() {
  const { id: gameId, tileId } = useParams();
  const nav = useNavigate();

  const [game, setGame] = useState(null);
  const [tile, setTile] = useState(null);
  const [question, setQuestion] = useState(null);
  const [categoryName, setCategoryName] = useState("");

  const timer = useCountUp(true);
  const isATurn = useMemo(() => game?.turn === "A", [game]);

  useEffect(() => {
    (async () => {
      const gref = doc(db, "games", gameId);
      const gs = await getDoc(gref);
      if (!gs.exists()) return nav("/");

      const tRef = doc(gref, "game_tiles", tileId);
      const ts = await getDoc(tRef);
      if (!ts.exists()) return nav(`/game/${gameId}`);
      const t = { id: ts.id, ...ts.data() };

      const qs = await getDoc(doc(db, "questions", t.questionId));
      const qd = qs.exists() ? qs.data() : { text: "(مفقود)", answer: "", imageUrl: "" };

      const catsSnap = await getDocs(collection(gref, "game_categories"));
      const cats = catsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const catForTile = cats.find(c => c.position === t.categoryPosition);
      let catName = "";
      if (catForTile) {
        const cs = await getDoc(doc(db, "categories", catForTile.categoryId));
        if (cs.exists()) catName = cs.data().name || "";
      }

      setGame({ id: gs.id, ...gs.data() });
      setTile(t);
      setQuestion(qd);
      setCategoryName(catName);
    })();
  }, [gameId, tileId, nav]);

  if (!game || !tile || !question) return null;

  return (
    <div className="qpage qpage--full" dir="rtl">
      {/* Top gradient bar */}
      <div className="qbar">
        <div className="qbar__left">
          <button className="iconbtn" onClick={() => nav(`/game/${gameId}`)}>↩︎ الرجوع للوحة</button>
          <button className="iconbtn" onClick={() => nav(`/game/${gameId}/results`)}>⟶ انتهاء اللعبة</button>
          <button className="iconbtn" onClick={() => nav(`/`)}>⎋ الخروج</button>
        </div>
        <div className="qbar__center">{categoryName || " "}</div>
        <div className="qbar__right">
          <div className="turnchip">
            دور فريق : <strong>{isATurn ? game.teamAName : game.teamBName}</strong>
          </div>
        </div>
      </div>

      {/* Centered timer pill */}
      <div className="qtimer container">
        <button className="qtimer__btn" onClick={timer.reset}>↻</button>
        <div className="qtimer__time">{timer.mm}:{timer.ss}</div>
        <button className="qtimer__btn" onClick={timer.toggle}>{timer.running ? "⏸" : "▶"}</button>
      </div>

      {/* Full-bleed stage */}
      <div className="qstage qstage--full container">
        <div className="pointchip">{tile.value} نقطة</div>
        <h1 className="qtext">{question.text}</h1>
        {question.imageUrl && <img src={question.imageUrl} alt="" className="qimage qimage--big" />}

        {/* bottom actions: go to separate answer page */}
        <div className="qactions">
          <button
            className="ansbtn"
            onClick={() => nav(`/game/${gameId}/tile/${tileId}/answer`)}
          >
            الإجابة
          </button>
        </div>

        {categoryName && <div className="cattag">{categoryName}</div>}
      </div>
    </div>
  );
}
