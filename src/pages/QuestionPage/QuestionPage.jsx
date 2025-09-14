// src/pages/QuestionPage/QuestionPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { db } from "../../firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import "../../styles/questionpage.css";

function useCountUp(autoStart = true) {
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(autoStart);
  const ref = useRef(null);
  useEffect(() => {
    if (!running) return;
    ref.current = setInterval(() => setMs((m) => m + 100), 100);
    return () => clearInterval(ref.current);
  }, [running]);
  const mm = String(Math.floor(ms / 60000)).padStart(2, "0");
  const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return {
    mm,
    ss,
    running,
    toggle: () => setRunning((v) => !v),
    reset: () => setMs(0),
  };
}

export default function QuestionPage() {
  const { id: gameId, tileId } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const navState = loc.state || null;

  const [game, setGame] = useState(null);
  const [tile, setTile] = useState(null);
  const [question, setQuestion] = useState(null);
  const [categoryName, setCategoryName] = useState("");

  const stageRef = useRef(null);
  const timer = useCountUp(true);
  const isATurn = useMemo(() => game?.turn === "A", [game]);

  useEffect(() => {
    // 0) Instant hydration from GameRoom (no network)
    if (navState) {
      const stGame = navState.game || null;
      const stTile = navState.tile || null;

      // If question wasn't passed, build it from tile's denormalized fields (if present)
      const stQuestion =
        navState.question ||
        (stTile
          ? {
              text: stTile.questionText || "",
              answer: stTile.answerText || "",
              imageUrl: stTile.questionImageUrl || "",
              answerImageUrl: stTile.answerImageUrl || "",
            }
          : null);

      setGame(stGame);
      setTile(stTile);
      setQuestion(stQuestion);
      setCategoryName(navState.categoryName || "");

      // Warm caches
      if (stQuestion?.imageUrl) {
        const qi = new Image();
        qi.fetchPriority = "high";
        qi.decoding = "async";
        qi.src = stQuestion.imageUrl;
      }
      if (stQuestion?.answerImageUrl) {
        const ai = new Image();
        ai.fetchPriority = "high";
        ai.decoding = "async";
        ai.src = stQuestion.answerImageUrl;
      }

      document.title = navState.categoryName ? `السؤال — ${navState.categoryName}` : "السؤال";
      return;
    }

    // 1) Fallback: fetch (deep link / hard refresh)
    (async () => {
      const gref = doc(db, "games", gameId);
      const gs = await getDoc(gref);
      if (!gs.exists()) return nav("/");

      const tRef = doc(gref, "game_tiles", tileId);
      const ts = await getDoc(tRef);
      if (!ts.exists()) return nav(`/game/${gameId}`);
      const t = { id: ts.id, ...ts.data() };

      // Prefer denormalized fields if present; only read questions doc if needed
      let qd = {
        text: t.questionText || "",
        answer: t.answerText || "",
        imageUrl: t.questionImageUrl || "",
        answerImageUrl: t.answerImageUrl || "",
      };
      if (!qd.text && t.questionId) {
        const qs = await getDoc(doc(db, "questions", t.questionId));
        qd = qs.exists() ? qs.data() : { text: "(مفقود)", answer: "", imageUrl: "" };
      }

      // Category name
      const catsSnap = await getDocs(collection(gref, "game_categories"));
      const cats = catsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const catForTile = cats.find((c) => c.position === t.categoryPosition);
      let catName = "";
      if (catForTile) {
        const cs = await getDoc(doc(db, "categories", catForTile.categoryId));
        if (cs.exists()) catName = cs.data().name || "";
      }

      setGame({ id: gs.id, ...gs.data() });
      setTile(t);
      setQuestion(qd);

      // Warm the cache for images so paint is instant
      if (qd?.imageUrl) {
        const qi = new Image();
        qi.fetchPriority = "high";
        qi.decoding = "async";
        qi.src = qd.imageUrl;
      }
      if (qd?.answerImageUrl) {
        const ai = new Image();
        ai.fetchPriority = "high";
        ai.decoding = "async";
        ai.src = qd.answerImageUrl;
      }

      setCategoryName(catName);
      document.title = catName ? `السؤال — ${catName}` : "السؤال";
    })();
  }, [gameId, tileId, nav, navState]);

  // Keyboard shortcuts: Space/Enter toggle, R reset
  useEffect(() => {
    function onKey(e) {
      if ([" ", "Enter"].includes(e.key)) {
        e.preventDefault();
        timer.toggle();
      } else if (e.key.toLowerCase() === "r") {
        timer.reset();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [timer]);

  if (!game || !tile || !question) return null;

  // Fallback: add .has-image for browsers without :has()
 // ✅ no hooks, so hook order is stable
const imgSrc = (tile?.questionImageUrl || question?.imageUrl) || "";
const hasImage = Boolean(imgSrc);


  return (
    <div className="qpage qpage--full" dir="rtl">
      {/* Top gradient bar */}
      <div className="qbar">
        <div className="qbar__left">
          <button className="iconbtn" onClick={() => nav(`/game/${gameId}`)}>
            ↩︎ الرجوع للوحة
          </button>
          <button className="iconbtn" onClick={() => nav(`/game/${gameId}/results`)}>
            ⟶ انتهاء اللعبة
          </button>
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
        <button className="qtimer__btn" onClick={timer.reset} aria-label="Reset">
          ↻
        </button>
        <div className="qtimer__time" aria-live="polite" aria-atomic="true">
          {timer.mm}:{timer.ss}
        </div>
        <button
          className="qtimer__btn"
          onClick={timer.toggle}
          aria-label={timer.running ? "Pause" : "Start"}
        >
          {timer.running ? "⏸" : "▶"}
        </button>
      </div>

      {/* Full-bleed stage */}
      <div
        ref={stageRef}
        className={`qstage qstage--full container${hasImage ? " has-image" : ""}`}
      >
        <div className="pointchip">{tile.value ?? 0} نقطة</div>
        <h1 className="qtext">{tile?.questionText || question?.text}</h1>

        {imgSrc && (
          <>
            {/* Clickable image opens CSS lightbox */}
            <a href={`#zoom-qimage-${tileId}`} className="qzoom">
              <img
                src={imgSrc}
                alt=""
                className="qimage qimage--big"
                loading="eager"
                decoding="async"
                fetchpriority="high"
              />
            </a>

            {/* Lightbox overlay (appears only when targeted) */}
            <a
              href="#"
              id={`zoom-qimage-${tileId}`}
              className="qimage-lightbox"
              aria-label="إغلاق الصورة"
            >
              <img src={imgSrc} alt="" />
            </a>
          </>
        )}

        {/* bottom actions: go to separate answer page */}
        <div className="qactions">
          <button
            className="ansbtn"
            onClick={() =>
              nav(`/game/${gameId}/tile/${tileId}/answer`, {
                state: { game, tile, question, categoryName },
              })
            }
          >
            الإجابة
          </button>
        </div>

        {categoryName && <div className="cattag">{categoryName}</div>}
      </div>
    </div>
  );
}
