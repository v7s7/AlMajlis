import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import {
  addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc
} from "firebase/firestore";
import "../../styles/newgame.css";

export default function NewGame() {
  const [cats, setCats] = useState([]);
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState([]); // categoryIds
  const [teamA, setTeamA] = useState("Team A");
  const [teamB, setTeamB] = useState("Team B");
  const nav = useNavigate();
  const user = window.__ALMAJLIS__?.user;

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "categories"), orderBy("name")));
      let rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (search) rows = rows.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));
      setCats(rows);
    })();
  }, [search]);

  function toggle(id) {
    setSel(s => s.includes(id) ? s.filter(x => x !== id) : (s.length < 6 ? [...s, id] : s));
  }

  async function start() {
    if (sel.length < 1) return alert("Pick at least 1 category (up to 6).");
    // Create game
    const gameRef = await addDoc(collection(db, "games"), {
      hostUserId: user.uid,
      status: "pending",
      teamAName: teamA, teamBName: teamB,
      teamAScore: 0, teamBScore: 0,
      turn: "A",
      startedAt: serverTimestamp()
    });

    // game_categories (ordered)
    const gcCol = collection(gameRef, "game_categories");
    for (let i = 0; i < sel.length; i++) {
      await addDoc(gcCol, { position: i + 1, categoryId: sel[i] });
    }

    // seed tiles: one per (category, value ∈ 200/400/600)
    const tilesCol = collection(gameRef, "game_tiles");
    const values = [200, 400, 600];
    for (let i = 0; i < sel.length; i++) {
      const categoryId = sel[i];
      for (const v of values) {
        // pick any question from that category/value (MVP). Enhance later with repeat-prevention.
        const qsnap = await getDocs(query(collection(db, "questions")));
        const all = qsnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(q => q.categoryId === categoryId && q.value === v);
        if (all.length === 0) {
          alert(`No questions for category ${categoryId} value ${v}. Add content in Admin.`);
          continue;
        }
        const pick = all[Math.floor(Math.random() * all.length)];
        await addDoc(tilesCol, {
          categoryPosition: i + 1,
          value: v,
          opened: false,
          questionId: pick.id
        });
      }
    }

    // flip active
    await setDoc(doc(db, "games", gameRef.id), { status: "active" }, { merge: true });
    nav(`/game/${gameRef.id}`);
  }

  return (
    <div style={{maxWidth:1100, margin:"20px auto", padding:16}}>
      <h2>New Game</h2>
      <div style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:16}}>
        <div>
          <input placeholder="Search categories…" value={search} onChange={e=>setSearch(e.target.value)} />
          <div style={{display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", marginTop:12}}>
            {cats.map(c => (
              <button key={c.id} onClick={()=>toggle(c.id)} style={{
                textAlign:"left", border: sel.includes(c.id)?"2px solid #f97316":"1px solid #ddd",
                borderRadius:12, padding:10, background:"#fff"
              }}>
                {c.imageUrl && <img alt="" src={c.imageUrl} style={{width:"100%", height:110, objectFit:"cover", borderRadius:10}} />}
                <div style={{marginTop:8, fontWeight:600}}>{c.name}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{border:"1px solid #ddd", borderRadius:12, padding:12}}>
            <h3>Teams</h3>
            <input value={teamA} onChange={e=>setTeamA(e.target.value)} placeholder="Team A" />
            <input value={teamB} onChange={e=>setTeamB(e.target.value)} placeholder="Team B" style={{marginTop:8}} />
            <div style={{marginTop:8}}>Selected: {sel.length} / 6</div>
            <button style={{marginTop:12}} onClick={start}>Start Game</button>
          </div>
        </div>
      </div>
    </div>
  );
}
