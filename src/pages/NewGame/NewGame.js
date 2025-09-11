// src/pages/NewGame/NewGame.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  getCountFromServer,
  writeBatch,
} from "firebase/firestore";
import "../../styles/newgame.css";

export default function NewGame() {
  const [allCats, setAllCats] = useState([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState([]); // categoryIds
  const [teamA, setTeamA] = useState("Team A");
  const [teamB, setTeamB] = useState("Team B");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const user = window.__ALMAJLIS__?.user;

  // ---------- Debounced search ----------
  const [queryText, setQueryText] = useState("");
  const searchTimer = useRef(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => setQueryText(search.trim().toLowerCase()),
      250
    );
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [search]);

  // ---------- Load categories (once) ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setCatsLoading(true);
        const snap = await getDocs(
          query(collection(db, "categories"), orderBy("name"))
        );
        if (cancelled) return;
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllCats(rows);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setCatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Filtered list ----------
  const cats = useMemo(() => {
    if (!queryText) return allCats;
    return allCats.filter((c) => c.name?.toLowerCase().includes(queryText));
  }, [allCats, queryText]);

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
  ];

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
    // Fisher–Yates
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, k);
  }

  async function validateStock(categoryIds) {
    for (const id of categoryIds) {
      for (const v of VALUES) {
        const qy = query(
          collection(db, "questions"),
          where("categoryId", "==", id),
          where("value", "==", v),
          where("isActive", "==", true)
        );
        const count = (await getCountFromServer(qy)).data().count || 0;
        if (count < 2) {
          const name = allCats.find((c) => c.id === id)?.name || id;
          return { ok: false, message: `Category "${name}" needs at least 2 questions for ${v}.` };
        }
      }
    }
    return { ok: true };
  }

  const canStart = useMemo(
    () =>
      !!user?.uid &&
      sel.length >= 1 &&
      sel.length <= 6 &&
      teamA.trim().length > 0 &&
      teamB.trim().length > 0 &&
      !busy,
    [user?.uid, sel.length, teamA, teamB, busy]
  );

  async function start() {
    if (!user?.uid) return alert("You must be signed in.");
    if (sel.length < 1) return alert("Pick at least 1 category (up to 6).");
    if (busy) return;

    setBusy(true);
    try {
      // 1) Stock check (cheap counts)
      const check = await validateStock(sel);
      if (!check.ok) {
        alert(check.message);
        setBusy(false);
        return;
      }

      // 2) Pre-pick all questions (real fetches) BEFORE any writes
      const perCategoryPicks = [];
      for (let catPos = 0; catPos < sel.length; catPos++) {
        const categoryId = sel[catPos];
        const buckets = new Map();
        for (const v of VALUES) {
          const all = await fetchQuestions(categoryId, v);
          if (all.length < 2) {
            throw new Error(
              `Not enough questions after validation for category ${categoryId}, value ${v}.`
            );
          }
          buckets.set(v, sampleK(all, 2));
        }
        perCategoryPicks.push({ categoryId, buckets });
      }

      // 3) Single atomic batch (game, categories, tiles)
      const batch = writeBatch(db);
      const gameRef = doc(collection(db, "games"));
      batch.set(gameRef, {
        hostUserId: user.uid,
        status: "active", // we commit everything at once, so activate directly
        teamAName: teamA.trim(),
        teamBName: teamB.trim(),
        teamAScore: 0,
        teamBScore: 0,
        turn: "A",
        startedAt: serverTimestamp(),
        endedAt: null,
      });

      // game_categories
      const gcCol = collection(gameRef, "game_categories");
      sel.forEach((categoryId, i) => {
        batch.set(doc(gcCol), { position: i + 1, categoryId });
      });

      // game_tiles
      const tilesCol = collection(gameRef, "game_tiles");
      for (let catPos = 0; catPos < perCategoryPicks.length; catPos++) {
        const { buckets } = perCategoryPicks[catPos];
        for (let row = 0; row < SEQUENCE.length; row++) {
          const { value, index } = SEQUENCE[row];
          const qpick = buckets.get(value)[index];
          batch.set(doc(tilesCol), {
            categoryPosition: catPos + 1,
            rowIndex: row + 1,
            value,
            opened: false,
            questionId: qpick.id,
            answeredBy: null,
            correct: null,
          });
        }
      }

      await batch.commit();
      nav(`/game/${gameRef.id}`);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to start game. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const selectedNames = useMemo(
    () => sel.map((id) => allCats.find((c) => c.id === id)?.name || id),
    [sel, allCats]
  );

  return (
    <div className="newgame">
      <div className="newgame__layout">
        {/* Left column */}
        <div>
          <input
            className="input-search"
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search categories"
          />

          <div className="mt-12" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ minWidth: 120, fontWeight: 700 }}>
              Selected: {sel.length} / 6
            </div>
          </div>

          {sel.length > 0 && (
            <div className="mt-8" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selectedNames.map((n, i) => (
                <button
                  key={sel[i]}
                  onClick={() => toggle(sel[i])}
                  className="chip chip--selected"
                  title="Remove"
                >
                  {n} ✕
                </button>
              ))}
            </div>
          )}

          <div className="section mt-16">
            {cats.length === 0 && !catsLoading ? (
              <div className="mt-12" style={{ color: "#6b7280" }}>
                لا توجد فئات مطابقة لبحثك.
              </div>
            ) : (
              <div className="category-grid">
                {cats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    className={`category-card ${sel.includes(c.id) ? "is-selected" : ""}`}
                    title={c.name}
                    disabled={busy}
                  >
                    {c.imageUrl ? (
                      <img
                        alt=""
                        src={c.imageUrl}
                        className="category-card__image"
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.display = "none";
                        }}
                      />
                    ) : null}
                    <div className="category-card__footer">{c.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div>
          <div className="panel">
            <h3 dir="ltr">Teams</h3>

            <input
              className="auth-input mt-8"
              value={teamA}
              onChange={(e) => setTeamA(e.target.value)}
              placeholder="Team A"
              dir="ltr"
              disabled={busy}
            />

            <input
              className="auth-input mt-8"
              value={teamB}
              onChange={(e) => setTeamB(e.target.value)}
              placeholder="Team B"
              dir="ltr"
              disabled={busy}
            />

            <button className="btn mt-12" onClick={start} disabled={!canStart}>
              {busy ? "Starting… Wait 10 Sec Please" : "Start Game"}
            </button>

            {!user?.uid && (
              <div className="mt-8" style={{ color: "#ef4444", fontWeight: 700 }}>
                Sign in to start a game.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
