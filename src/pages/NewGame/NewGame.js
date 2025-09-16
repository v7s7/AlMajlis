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
  where,
  limit,
  runTransaction,
} from "firebase/firestore";
import "../../styles/newgame.css";
import RotateGate from "../../components/RotateGate";

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

  // ---------- Group by type ----------
  const grouped = useMemo(() => {
    const map = new Map();
    for (const c of cats) {
      const t = (c.type && String(c.type).trim()) || "Other";
      if (!map.has(t)) map.set(t, []);
      map.get(t).push(c);
    }
    const entries = Array.from(map.entries()).sort((a, b) => {
      if (a[0] === "Other") return 1;
      if (b[0] === "Other") return -1;
      return a[0].localeCompare(b[0], undefined, { sensitivity: "base" });
    });
    return entries;
  }, [cats]);

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

  // Compare by createdAt (oldest first), then by id for stability
  function toMillis(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === "function") return ts.toMillis();
    if (typeof ts === "number") return ts;
    const d = Date.parse(ts);
    return Number.isFinite(d) ? d : 0;
  }
  function cmpCreatedThenId(a, b) {
    const da = toMillis(a.createdAt);
    const db = toMillis(b.createdAt);
    if (da !== db) return da - db; // oldest first
    return String(a.id).localeCompare(String(b.id));
  }

  // Shuffle (Fisher–Yates)
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Small, fast query (only check if >=2 exist)
  function stockQuery(categoryId, value) {
    return query(
      collection(db, "questions"),
      where("categoryId", "==", categoryId),
      where("value", "==", value),
      where("isActive", "==", true),
      limit(2)
    );
  }

  // Pull up to 25 to give unseen-filter room
  function pickQuery(categoryId, value) {
    return query(
      collection(db, "questions"),
      where("categoryId", "==", categoryId),
      where("value", "==", value),
      where("isActive", "==", true),
      limit(25)
    );
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

  // Determine if this user has any prior games (first = FREE)
  async function isFirstGameForUser(uid) {
    const snap = await getDocs(
      query(collection(db, "games"), where("hostUserId", "==", uid), limit(1))
    );
    return snap.size === 0;
  }

  // Load set of questionIds the user has actually OPENED before (seen)
  async function loadUserSeenQuestionIds(uid) {
    // Read all games by this user (ids only)
    const gSnap = await getDocs(query(collection(db, "games"), where("hostUserId", "==", uid)));
    const gameIds = gSnap.docs.map(d => d.id);
    const seen = new Set();
    // For each game, read game_tiles opened == true (only opened count as seen)
    // Note: bounded by number of games; fine for admin/paid logic.
    for (const gid of gameIds) {
      const tilesRef = collection(doc(db, "games", gid), "game_tiles");
      const tSnap = await getDocs(query(tilesRef, where("opened", "==", true)));
      tSnap.forEach(t => {
        const qid = t.data()?.questionId;
        if (qid) seen.add(qid);
      });
    }
    return seen;
  }

  async function validateStockParallel(categoryIds) {
    // Build ALL tiny stock-check queries, run in parallel
    const checks = [];
    for (const id of categoryIds) {
      for (const v of VALUES) {
        checks.push({ id, v, promise: getDocs(stockQuery(id, v)) });
      }
    }
    const results = await Promise.all(checks.map((c) => c.promise));
    for (let i = 0; i < checks.length; i++) {
      const { id, v } = checks[i];
      const snap = results[i];
      if (snap.size < 2) {
        const name = allCats.find((c) => c.id === id)?.name || id;
        return { ok: false, message: `Category "${name}" needs at least 2 questions for ${v}.` };
      }
    }
    return { ok: true };
  }

  async function start() {
    if (!user?.uid) return alert("You must be signed in.");
    if (sel.length < 1) return alert("Pick at least 1 category (up to 6).");
    if (busy) return;

    setBusy(true);
    console.time?.("newgame:start");
    try {
      // FREE if this is the user's first-ever game
      const freeMode = await isFirstGameForUser(user.uid);

      // 1) Fast stock check (all in parallel)
      const check = await validateStockParallel(sel);
      if (!check.ok) {
        alert(check.message);
        return; // finally will reset busy
      }

      // 2) Fetch candidates for ALL (category,value) in parallel
      const jobs = [];
      for (const categoryId of sel) {
        for (const v of VALUES) {
          jobs.push({
            categoryId,
            v,
            promise: getDocs(pickQuery(categoryId, v)),
          });
        }
      }
      const picksMap = new Map(); // key: `${categoryId}:${v}` -> questions[]
      const snaps = await Promise.all(jobs.map((j) => j.promise));
      for (let i = 0; i < jobs.length; i++) {
        const { categoryId, v } = jobs[i];
        let docs = snaps[i].docs.map((d) => ({ id: d.id, ...d.data() }));
        if (docs.length < 2) {
          throw new Error(`Not enough questions after validation for category ${categoryId}, value ${v}.`);
        }
        // FREE: deterministically pick the first two by createdAt (oldest), then id
        if (freeMode) {
          docs = docs.sort(cmpCreatedThenId);
        }
        picksMap.set(`${categoryId}:${v}`, docs);
      }

      // 3) Compose perCategoryPicks
      const perCategoryPicks = [];
      if (freeMode) {
        // FREE: fixed two (oldest) per bucket
        for (let catPos = 0; catPos < sel.length; catPos++) {
          const categoryId = sel[catPos];
          const buckets = new Map();
          for (const v of VALUES) {
            const all = picksMap.get(`${categoryId}:${v}`) || [];
            buckets.set(v, all.slice(0, 2));
          }
          perCategoryPicks.push({ categoryId, buckets });
        }
      } else {
        // PAID: avoid repeats using user's seen set; warn if repeats are needed
        const seenSet = await loadUserSeenQuestionIds(user.uid);

        // Pre-calc deficits per category/value for warning
        const warnLines = [];
        for (const categoryId of sel) {
          let totalDeficit = 0;
          const name = allCats.find(c => c.id === categoryId)?.name || categoryId;
          const parts = [];
          for (const v of VALUES) {
            const all = picksMap.get(`${categoryId}:${v}`) || [];
            const unseen = all.filter(q => !seenSet.has(q.id));
            const deficit = Math.max(0, 2 - unseen.length);
            if (deficit > 0) {
              parts.push(`${v}: need ${deficit} from used`);
              totalDeficit += deficit;
            }
          }
          if (totalDeficit > 0) {
            warnLines.push(`• ${name} → ${parts.join(", ")}`);
          }
        }

        if (warnLines.length > 0) {
          const msg =
            "تنبيه: ستتضمن بعض الأسئلة أسئلة رأيتها سابقًا بسبب قلة الأسئلة الجديدة في بعض الفئات/القيم:\n\n" +
            warnLines.join("\n") +
            "\n\nهل تريد المتابعة؟";
          const ok = window.confirm(msg);
          if (!ok) {
            setBusy(false);
            return;
          }
        }

        // Now actually pick: unseen first, then fill from seen (no duplicates within the same game)
        for (let catPos = 0; catPos < sel.length; catPos++) {
          const categoryId = sel[catPos];
          const buckets = new Map();
          for (const v of VALUES) {
            const all = picksMap.get(`${categoryId}:${v}`) || [];
            const unseen = all.filter(q => !seenSet.has(q.id));
            const seen = all.filter(q => seenSet.has(q.id));

            const chosen = [];
            // shuffle unseen to randomize
            const u = shuffle(unseen);
            for (const q of u) {
              if (chosen.length < 2) chosen.push(q);
              else break;
            }
            if (chosen.length < 2) {
              // fill from seen (also shuffled)
              const s = shuffle(seen);
              for (const q of s) {
                // avoid same q twice within the same bucket
                if (!chosen.find(x => x.id === q.id)) chosen.push(q);
                if (chosen.length === 2) break;
              }
            }
            // Safety: we should always have 2 due to earlier stock check
            buckets.set(v, chosen.slice(0, 2));
          }
          perCategoryPicks.push({ categoryId, buckets });
        }
      }

      // 4) Single atomic TRANSACTION (decrement credit + create game)
      const userRef = doc(db, "users", user.uid);
      let newGameId = null;

      await runTransaction(db, async (trx) => {
        // a) Check & decrement credits
        const us = await trx.get(userRef);
        const current = us.exists() ? Number(us.data()?.gamesRemaining ?? 0) : 0;
        if (!Number.isFinite(current) || current < 1) {
          throw new Error("لا توجد ألعاب متبقية في رصيدك.");
        }
        trx.update(userRef, { gamesRemaining: current - 1 });

        // b) Create game and children
        const gameRef = doc(collection(db, "games"));
        newGameId = gameRef.id;

        trx.set(gameRef, {
          hostUserId: user.uid,
          status: "active",
          teamAName: teamA.trim(),
          teamBName: teamB.trim(),
          teamAScore: 0,
          teamBScore: 0,
          turn: "A",
          startedAt: serverTimestamp(),
          endedAt: null,
          mode: (await isFirstGameForUser(user.uid)) ? "free" : "paid", // metadata (re-check harmless)
        });

        // game_categories
        const gcCol = collection(gameRef, "game_categories");
        sel.forEach((categoryId, i) => {
          trx.set(doc(gcCol), { position: i + 1, categoryId });
        });

        // game_tiles
        const tilesCol = collection(gameRef, "game_tiles");
        for (let catPos = 0; catPos < perCategoryPicks.length; catPos++) {
          const { buckets } = perCategoryPicks[catPos];
          for (let row = 0; row < SEQUENCE.length; row++) {
            const { value, index } = SEQUENCE[row];
            const qpick = buckets.get(value)[index];
            trx.set(doc(tilesCol), {
              categoryPosition: catPos + 1,
              rowIndex: row + 1,
              value,
              opened: false,
              questionId: qpick.id,
              answeredBy: null,
              correct: null,
              questionText: qpick.text || "",
              answerText: qpick.answer || "",
              questionImageUrl: qpick.questionImageUrl || qpick.imageUrl || "",
              answerImageUrl: qpick.answerImageUrl || "",
            });
          }
        }
      });

      console.timeEnd?.("newgame:start");
      if (newGameId) nav(`/game/${newGameId}`);
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
    <RotateGate title="لوحة اللعب">
      <div className="newgame">
        {/* Back button */}
        <button className="btn btn--secondary" onClick={() => nav(-1)} style={{ marginBottom: 12 }}>
          ← Back
        </button>

        <div className="newgame__layout">
          {/* Main column */}
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

            {/* Grouped sections by type */}
            {grouped.length === 0 && !catsLoading ? (
              <div className="mt-12" style={{ color: "#6b7280" }}>
                لا توجد فئات مطابقة لبحثك.
              </div>
            ) : (
              grouped.map(([typeName, list]) => (
                <div key={typeName} className="section mt-16">
                  <div className="section__title">
                    <span>{typeName}</span>
                  </div>
                  <div className="category-grid">
                    {list.map((c) => (
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
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                        ) : null}
                        <div className="category-card__footer">{c.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}

            {/* Teams panel — moved here so it's always at the bottom */}
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
                {busy ? "Starting…" : "Start Game"}
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
    </RotateGate>
  );
}
