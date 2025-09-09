import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../../firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

export default function Results() {
  const { id } = useParams();
  const [game, setGame] = useState(null);

  useEffect(() => {
    (async () => {
      const ref = doc(db, "games", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const g = snap.data();
      setGame({ id: snap.id, ...g });
      if (g.status !== "ended") {
        await updateDoc(ref, { status: "ended", endedAt: serverTimestamp() });
      }
    })();
  }, [id]);

  if (!game) return <div style={{padding:16}}>Loading…</div>;

  return (
    <div style={{maxWidth:600, margin:"40px auto", padding:16, textAlign:"center"}}>
      <h2>Final Scores</h2>
      <div style={{display:"grid", gap:8, marginTop:12}}>
        <div><strong>{game.teamAName}</strong>: {game.teamAScore || 0}</div>
        <div><strong>{game.teamBName}</strong>: {game.teamBScore || 0}</div>
      </div>
      <div style={{marginTop:16}}>
        <Link to="/"><button>Back to Dashboard</button></Link>
      </div>
    </div>
  );
}
