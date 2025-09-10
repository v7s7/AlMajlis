// src/pages/NewGame/NewGame.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import "../../styles/newgame.css";

export default function NewGame() {
  const [cats, setCats] = useState([]);
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState([]); // categoryIds
  const [teamA, setTeamA] = useState("Team A");
  const [teamB, setTeamB] = useState("Team B");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const user = window.__ALMAJLIS__?.user;

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "categories"), orderBy("name")));
      let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (search) rows = rows.filter((c) => c.name?.toLowerCase().includes(search.toLowerCase()));
      setCats(rows);
    })();
  }, [search]);

  function toggle(id) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 6 ? [...s, id] : s));
  }

  // ----- Helpers -----
  const VALUES = [200, 400, 600];
  const SEQUENCE = [
    { value: 200, index: 0 },
    { value: 200, index: 1 },
    { value: 400, index: 0 },
    { value: 400, index: 1 },
    { value: 600, index: 0 },
    { value: 600, index: 1 },
  ]; // rowIndex 1..6

  async function fetchQuestions(categoryId, value) {
    const qy = query(
      collection(db, "questions"),
      where("categoryId", "==", categoryId),
      where("value", "==", value),
      where("isActive", "==", true)
    );
    const snap = await getDocs(qy);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  function sampleK(arr, k) {
    const a = [...arr];
    if (a.length < k) throw new Error(`Not enough items to sample ${k}`);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, k);
  }

  async function validateStock(categoryIds) {
    // Ensure each selected category has at least TWO questions per value
    for (const id of categoryIds) {
      for (const v of VALUES) {
        const all = await fetchQuestions(id, v);
        if (all.length < 2) {
          return {
            ok: false,
            message: `Category is missing questions: need at least 2 for ${v} in category "${cats.find(c=>c.id===id)?.name || id}".`,
          };
        }
      }
    }
    return { ok: true };
  }

  // ----- Start flow -----
  async function start() {
    if (!user?.uid) return alert("You must be signed in.");
    if (sel.length < 1) return alert("Pick at least 1 category (up to 6).");
    if (busy) return;
    setBusy(true);

    try {
      // Validate stock (2 per value per category)
      const check = await validateStock(sel);
      if (!check.ok) {
        alert(check.message);
        setBusy(false);
        return;
      }

      // Create game (pending)
      const gameRef = await addDoc(collection(db, "games"), {
        hostUserId: user.uid,
        status: "pending",
        teamAName: teamA,
        teamBName: teamB,
        teamAScore: 0,
        teamBScore: 0,
        turn: "A",
        startedAt: serverTimestamp(),
        endedAt: null,
      });

      // game_categories (ordered)
      const gcCol = collection(gameRef, "game_categories");
      for (let i = 0; i < sel.length; i++) {
        await addDoc(gcCol, { position: i + 1, categoryId: sel[i] });
      }

      // game_tiles: for each category, create 6 tiles [200a,200b,400a,400b,600a,600b]
      const tilesCol = collection(gameRef, "game_tiles");
      for (let catPos = 0; catPos < sel.length; catPos++) {
        const categoryId = sel[catPos];

        // Build buckets value -> two sampled questions
        const buckets = new Map();
        for (const v of VALUES) {
          const all = await fetchQuestions(categoryId, v);
          // We validated already; still guard:
          if (all.length < 2) {
            throw new Error(
              `Not enough questions after validation for category ${categoryId}, value ${v}.`
            );
          }
          buckets.set(v, sampleK(all, 2));
        }

        // Write six tiles with rowIndex 1..6
        for (let row = 0; row < SEQUENCE.length; row++) {
          const { value, index } = SEQUENCE[row];
          const qpick = buckets.get(value)[index];

          await addDoc(tilesCol, {
            categoryPosition: catPos + 1, // 1-based
            rowIndex: row + 1, // 1..6
            value, // 200/400/600
            opened: false,
            questionId: qpick.id,
            answeredBy: null,
            correct: null,
          });
        }
      }

      // Activate game
      await setDoc(doc(db, "games", gameRef.id), { status: "active" }, { merge: true });
      nav(`/game/${gameRef.id}`);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to start game. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="newgame">

  <div className="newgame__layout">
    <div>
      <input
        className="input-search"
        placeholder="Search categories…"
        value={search}
        onChange={(e)=>setSearch(e.target.value)}
      />

      <div className="section mt-16">
        <div className="section__title"><span>تفكير</span></div>

        <div className="category-grid">
          {cats.map(c => (
            <button
              key={c.id}
              onClick={()=>toggle(c.id)}
              className={`category-card ${sel.includes(c.id) ? "is-selected" : ""}`}
            >
              <span className="badge badge--info">i</span>
              {/* optional remaining: <span className="badge badge--right badge--sparkle">باقي 61 لعبة</span> */}
              {c.imageUrl && <img alt="" src={c.imageUrl} className="category-card__image" />}
              <div className="category-card__footer">{c.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>

    <div>
      <div className="panel">
        <h3>Teams</h3>
        <input className="mt-8" value={teamA} onChange={e=>setTeamA(e.target.value)} placeholder="Team A" />
        <input className="mt-8" value={teamB} onChange={e=>setTeamB(e.target.value)} placeholder="Team B" />
        <div className="mt-8">Selected: {sel.length} / 6</div>
        <button className="btn mt-12" onClick={start} disabled={busy}>
          {busy ? "Starting…" : "Start Game"}
        </button>
      </div>
    </div>
  </div>
</div>

  );
}
