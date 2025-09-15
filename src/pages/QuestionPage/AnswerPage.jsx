// src/pages/QuestionPage/AnswerPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { db } from "../../firebase";
import {
  collection, doc, getDoc, getDocs, updateDoc, serverTimestamp
} from "firebase/firestore";
import CldImage from "../../components/CldImage";
import RotateGate from "../../components/RotateGate"; // ⬅️ added
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

  // helpers
  const isVideoUrl = (u = "") =>
    /\.(mp4|webm|ogv|ogg|mov|m4v)$/i.test((u || "").toLowerCase());
  const inferType = (url, declared) => declared || (isVideoUrl(url) ? "video" : "image");

  useEffect(() => {
    // If QuestionPage handed us the data, hydrate immediately (no network)
    if (navState) {
      const stGame = navState.game || null;
      const stTile = navState.tile || null;

      // normalize question shape
      const stQuestion =
        navState.question ||
        (stTile
          ? {
              text: stTile.questionText || "",
              answer: stTile.answerText || "",
              // question media
              questionImageUrl: stTile.questionImageUrl || stTile.imageUrl || "",
              questionImagePublicId: stTile.questionImagePublicId || stTile.imagePublicId || "",
              questionMediaType:
                stTile.questionMediaType ||
                inferType(stTile.questionImageUrl || stTile.imageUrl),
              // answer media
              answerImageUrl: stTile.answerImageUrl || "",
              answerImagePublicId: stTile.answerImagePublicId || "",
              answerMediaType: stTile.answerMediaType || inferType(stTile.answerImageUrl),
            }
          : null);

      setGame(stGame);
      setTile(stTile);
      setQuestion(stQuestion);
      setCategoryName(navState.categoryName || "");
      return;
    }

    // Fallback: fetch (deep link / hard refresh)
    (async () => {
      const gref = doc(db, "games", gameId);
      const gs = await getDoc(gref);
      if (!gs.exists()) return nav("/");

      const tRef = doc(gref, "game_tiles", tileId);
      const ts = await getDoc(tRef);
      if (!ts.exists()) return nav(`/game/${gameId}`);
      const t = { id: ts.id, ...ts.data() };

      // Prefer denormalized fields on the tile; else read the question doc
      let qd = {
        text: t.questionText || "",
        answer: t.answerText || "",
        // question media (denormalized)
        questionImageUrl: t.questionImageUrl || t.imageUrl || "",
        questionImagePublicId: t.questionImagePublicId || t.imagePublicId || "",
        questionMediaType: t.questionMediaType || inferType(t.questionImageUrl || t.imageUrl),
        // answer media (denormalized)
        answerImageUrl: t.answerImageUrl || "",
        answerImagePublicId: t.answerImagePublicId || "",
        answerMediaType: t.answerMediaType || inferType(t.answerImageUrl),
      };

      // If no text/media denormalized, pull the master question doc
      if ((!qd.text && !qd.questionImageUrl) && t.questionId) {
        const qs = await getDoc(doc(db, "questions", t.questionId));
        if (qs.exists()) {
          const qData = qs.data();
          qd = {
            text: qData.text || "",
            answer: qData.answer || "",
            questionImageUrl: qData.questionImageUrl || qData.imageUrl || "",
            questionImagePublicId: qData.questionImagePublicId || qData.imagePublicId || "",
            questionMediaType:
              qData.questionMediaType || inferType(qData.questionImageUrl || qData.imageUrl),
            answerImageUrl: qData.answerImageUrl || "",
            answerImagePublicId: qData.answerImagePublicId || "",
            answerMediaType: qData.answerMediaType || inferType(qData.answerImageUrl),
          };
        } else {
          qd = {
            text: "", answer: "",
            questionImageUrl: "", questionImagePublicId: "", questionMediaType: "image",
            answerImageUrl: "", answerImagePublicId: "", answerMediaType: "image",
          };
        }
      }

      // Category name
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

      // Fire and go back
      Promise.all([
        updateDoc(tref, { opened: true, answeredBy: to, correct }),
        updateDoc(gref, {
          teamAScore: next.teamAScore,
          teamBScore: next.teamBScore,
          turn: game.turn === "A" ? "B" : "A",
          updatedAt: serverTimestamp(),
        }),
      ]).catch(console.error);
      nav(`/game/${gameId}`);
    } finally {
      setBusy(false);
    }
  }

  if (!game || !tile || !question) return null;

  // Derive what to show
  const answerText = (tile?.answerText ?? question?.answer ?? "") || "";
  const aUrl = tile?.answerImageUrl || question?.answerImageUrl || "";
  const aPublicId = tile?.answerImagePublicId || question?.answerImagePublicId || "";
  const aType = inferType(aUrl, question?.answerMediaType || tile?.answerMediaType);

  // If there is no text answer but there is media, we still render correctly
  const showAnswerText = !!answerText.trim();

  return (
    <RotateGate title="الإجابة">
      <div className="apage" dir="rtl">
        {/* Top bar */}
        <div className="abar">
          <div className="abar__left">
            <button className="iconbtn" onClick={() => nav(`/game/${gameId}`)}>
              ↩︎ الرجوع للوحة
            </button>
          </div>
          <div className="abar__center">{categoryName || " "}</div>
          <div className="abar__right"></div>
        </div>

        {/* Answer stage */}
        <div className="astage container">
          {showAnswerText && (
            <div className="answer">
              الإجابة: <strong>{answerText}</strong>
            </div>
          )}

          {/* Answer media (image or video) */}
          {(aUrl || aPublicId) && (
            <div style={{ marginTop: 10 }}>
              {aType === "video" ? (
                <video
                  src={aUrl}
                  className="aimage"
                  style={{ width: "100%", maxWidth: 900, borderRadius: 14 }}
                  controls
                  playsInline
                />
              ) : (
                <CldImage
                  publicId={aPublicId}
                  url={aUrl}
                  w={900}
                  h={420}
                  alt="answer"
                />
              )}
            </div>
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
    </RotateGate>
  );
}
