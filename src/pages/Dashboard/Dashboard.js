import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import { signOut } from "firebase/auth";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

export default function Dashboard() {
  const [cats, setCats] = useState([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState(window.__ALMAJLIS__?.role || "user");
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "categories"), orderBy("name")));
      let rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (search) rows = rows.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));
      setCats(rows);
    })();
  }, [search]);

  return (
    <div style={{maxWidth:1100, margin:"20px auto", padding:16}}>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
        <h2>Al Majlis</h2>
        <div style={{display:"flex", gap:8}}>
          {role === "admin" && <Link to="/admin" className="btn">Admin</Link>}
          <button onClick={()=>signOut(auth).then(()=>nav("/login"))}>Logout</button>
        </div>
      </div>

      <div style={{display:"flex", gap:8, marginTop:12}}>
        <input placeholder="Search categories…" value={search} onChange={e=>setSearch(e.target.value)} />
        <Link to="/new"><button>Create Game</button></Link>
      </div>

      <div style={{display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", marginTop:12}}>
        {cats.map(c => (
          <div key={c.id} style={{border:"1px solid #ddd", borderRadius:12, padding:10}}>
            {c.imageUrl && <img src={c.imageUrl} alt="" style={{width:"100%", height:120, objectFit:"cover", borderRadius:10}} />}
            <div style={{marginTop:8, fontWeight:600}}>{c.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
