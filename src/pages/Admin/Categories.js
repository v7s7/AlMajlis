// src/pages/Admin/Categories.jsx
import { useEffect, useState } from "react";
import { db } from "../../firebase";
import {
  collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, serverTimestamp
} from "firebase/firestore";
import { uploadImage } from "../../lib/upload";
import CldImage from "../../components/CldImage";
// ⬇️ use a dedicated stylesheet for this page
import "../../styles/categories.css";

export default function Categories() {
  const role = window.__ALMAJLIS__?.role || "user";
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { refresh(); }, []);
  async function refresh() {
    const snap = await getDocs(query(collection(db, "categories"), orderBy("name")));
    setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function add() {
    if (role !== "admin") return alert("Not authorized.");
    if (!name.trim()) return alert("Please enter a category name.");

    setBusy(true); setMsg("Creating...");
    try {
      let finalUrl = imageUrl.trim();
      let publicId = "";

      if (file) {
        setMsg("Uploading image…");
        const up = await uploadImage(file);
        finalUrl = up.url;
        publicId = up.publicId;
      }

      await addDoc(collection(db, "categories"), {
        name: name.trim(),
        imageUrl: finalUrl,
        imagePublicId: publicId,
        isActive: true,
        createdAt: serverTimestamp()
      });

      setName(""); setImageUrl(""); setFile(null);
      await refresh();
    } catch (e) {
      console.error(e);
      alert("Create failed: " + e.message);
    } finally {
      setBusy(false); setMsg("");
    }
  }

  async function del(id) {
    if (role !== "admin") return alert("Not authorized.");
    if (!confirm("Delete this category?")) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "categories", id));
      await refresh();
    } catch (e) {
      console.error(e);
      alert("Delete failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  if (role !== "admin") return <div style={{padding:16}}>Not authorized.</div>;

  return (
    <div className="cats" style={{maxWidth:1100, margin:"20px auto", padding:16}}>
      <h2>Categories</h2>

      <div style={{display:"grid", gridTemplateColumns:"2fr 2fr 1fr 1fr", gap:8, alignItems:"center", marginTop:8}}>
        <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} disabled={busy} />
        <input placeholder="Image URL (optional)" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} disabled={busy} />
        <input type="file" onChange={e=>setFile(e.target.files?.[0] || null)} disabled={busy} />
        <button onClick={add} disabled={busy}>Add</button>
      </div>
      {busy && <div style={{marginTop:8}}>{msg}</div>}

      <div className="cats__grid" style={{display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", marginTop:12}}>
        {rows.map(r => (
          <div key={r.id} className="cats__card" style={{border:"1px solid #ddd", borderRadius:12, padding:10}}>
            {(r.imagePublicId || r.imageUrl) && (
              <CldImage publicId={r.imagePublicId} url={r.imageUrl} w={500} h={120} alt={r.name} />
            )}
            <div style={{marginTop:8, fontWeight:600}}>{r.name}</div>
            <button onClick={()=>del(r.id)} style={{marginTop:8}} disabled={busy}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
