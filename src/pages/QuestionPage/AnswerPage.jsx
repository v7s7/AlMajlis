// src/pages/QuestionPage/AnswerPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { db } from "../../firebase";
import {
  collection, doc, getDoc, getDocs, limit, query, updateDoc, where, serverTimestamp
} from "firebase/firestore";
import "../../styles/answerpage.css";

export default function AnswerPage() {
  const { id: gameId, tileId } = useParams();
  const nav = useNavigate();
const loc = useLocation();
const navState = loc.state || null;
  const [game, setGame] = useState(null);
  const [tile, setTile] = useState(null);
  const [question, setQuestion] = useState(null);
  const [categoryName, setCategoryName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
// If QuestionPage handed us the data, hydrate immediately (no network)
if (navState) {
  setGame(navState.game || null);
  setTile(navState.tile || null);
  setQuestion(navState.question || null);
  setCategoryName(navState.categoryName || "");
  return; // skip fetching
}

(async () => {   
     const gref = doc(db, "games", gameId);
      const gs = await getDoc(gref);
      if (!gs.exists()) return nav("/");

      const tRef = doc(gref, "game_tiles", tileId);
      const ts = await getDoc(tRef);
      if (!ts.exists()) return nav(`/game/${gameId}`);
      const t = { id: ts.id, ...ts.data() };

      const qs = await getDoc(doc(db, "questions", t.questionId));
const qd = qs.exists() ? qs.data() : { text: "", answer: "", imageUrl: "", answerImageUrl: "" };
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
}, [gameId, tileId, nav, navState]);
  async function assign(to) {
    if (!game || !tile || busy) return;
    setBusy(true);

    try {
      const gref = doc(db, "games", gameId);
      const tref = doc(gref, "game_tiles", tile.id);

      const next = {
        teamAScore: game.teamAScore || 0,
        teamBScore: game.teamBScore || 0,
      };
      let correct = false;
      if (to === "A" || to === "B") {
        correct = true;
        if (to === "A") next.teamAScore += tile.value;
        else next.teamBScore += tile.value;
      }

      await updateDoc(tref, { opened: true, answeredBy: to, correct });
      await updateDoc(gref, {
        teamAScore: next.teamAScore,
        teamBScore: next.teamBScore,
        turn: (game.turn === "A" ? "B" : "A"),
        updatedAt: serverTimestamp(),
      });

      const qy = query(collection(gref, "game_tiles"), where("opened", "==", false), limit(1));
      const remaining = await getDocs(qy);
      if (remaining.empty) nav(`/game/${gameId}/results`);
      else nav(`/game/${gameId}`);
    } finally {
      setBusy(false);
    }
  }

  if (!game || !tile || !question) return null;

  return (
    <div className="apage" dir="rtl">
      {/* Top bar */}
      <div className="abar">
        <div className="abar__left">
          <button className="iconbtn" onClick={() => nav(`/game/${gameId}`)}>↩︎ الرجوع للوحة</button>
        </div>
        <div className="abar__center">{categoryName || " "}</div>
        <div className="abar__right"></div>
      </div>

      {/* Answer stage */}
      <div className="astage container">
        <div className="answer">الإجابة: <strong>{tile?.answerText || question?.answer}</strong></div>
{question.answerImageUrl && (
  <img
src={tile?.answerImageUrl || question?.answerImageUrl}    alt=""
   className="aimage"
 loading="eager"
 fetchpriority="high"
 decoding="async"
  />
)}
        <div className="assignrow">
  <button className="btn btn--lg btn--a" disabled={busy} onClick={() => assign("A")}>
    {game.teamAName}
  </button>
  <button className="btn btn--lg btn--b" disabled={busy} onClick={() => assign("B")}>
    {game.teamBName}
  </button>
  <button className="btn btn--lg" disabled={busy} onClick={() => assign("none")}>
    لا أحد
  </button>
</div>

{/* bottom-right back */}
<button
  className="btn btn--main backpill"
  onClick={() => nav(`/game/${gameId}/tile/${tileId}`)}
>
  ارجع للسؤال
</button>
      </div>
    </div>
  );
}
