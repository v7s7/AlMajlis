import { useEffect, useState } from "react";
import { db } from "../../firebase";
import {
  collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, where, serverTimestamp
} from "firebase/firestore";
import { uploadImage } from "../../lib/upload";
import CldImage from "../../components/CldImage";
import "../../styles/admin.css";

export default function Questions() {
  const role = window.__ALMAJLIS__?.role || "user";
  const [cats, setCats] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [value, setValue] = useState(200);
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");
  const [imageUrl, setImageUrl] = useState(""); // manual URL
  const [file, setFile] = useState(null);       // local file
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "categories"), orderBy("name")));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCats(list);
      if (list[0]) setCategoryId(list[0].id);
    })();
  }, []);

  async function refresh() {
    const col = collection(db, "questions");
    const q = categoryId ? query(col, where("categoryId","==",categoryId)) : query(col);
    const snap = await getDocs(q);
    setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function add() {
    if (role !== "admin") return alert("Not authorized.");
    if (!categoryId || !text.trim() || !answer.trim()) return alert("Fill category, question text, and answer.");
    setBusy(true);
    try {
      let finalUrl = imageUrl.trim();
      let publicId = "";
      if (file) {
        const up = await uploadImage(file);
        finalUrl = up.url;
        publicId = up.publicId;
      }

      await addDoc(collection(db, "questions"), {
        categoryId,
        value: Number(value),
        text: text.trim(),
        answer: answer.trim(),
        imageUrl: finalUrl,       // can be ""
        imagePublicId: publicId,  // can be ""
        isActive: true,
        createdAt: serverTimestamp()
      });
      setText(""); setAnswer(""); setImageUrl(""); setFile(null);
      await refresh();
    } catch (e) {
      console.error(e);
      alert("Add failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id) {
    if (role !== "admin") return alert("Not authorized.");
    if (!confirm("Delete this question?")) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "questions", id));
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
    <div style={{maxWidth:1100, margin:"20px auto", padding:16}}>
      <h2>Questions</h2>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, alignItems:"start"}}>
        <div>
          <select value={categoryId} onChange={e=>setCategoryId(e.target.value)} style={{width:"100%", marginBottom:8}}>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={value} onChange={e=>setValue(e.target.value)} style={{width:"100%", marginBottom:8}}>
            <option value="200">200</option>
            <option value="400">400</option>
            <option value="600">600</option>
          </select>
          <input placeholder="Question text (AR or EN)" value={text} onChange={e=>setText(e.target.value)} style={{width:"100%", marginBottom:8}} />
          <input placeholder="Correct answer" value={answer} onChange={e=>setAnswer(e.target.value)} style={{width:"100%", marginBottom:8}} />
          <input placeholder="Image URL (optional)" value={imageUrl} onChange={e=>setImageUrl(e.target.value)} style={{width:"100%", marginBottom:8}} />
          <input type="file" onChange={e=>setFile(e.target.files?.[0] || null)} />
          <div style={{display:"flex", gap:8, marginTop:8}}>
            <button onClick={add} disabled={busy}>Add Question</button>
            <button onClick={refresh} disabled={busy}>Refresh</button>
          </div>
        </div>
        <div>
          <div style={{display:"grid", gap:10}}>
            {rows
              .filter(r => !categoryId || r.categoryId === categoryId)
              .sort((a,b)=>a.value-b.value)
              .map(r => (
              <div key={r.id} style={{border:"1px solid #ddd", borderRadius:12, padding:10}}>
                <div><strong>{r.value}</strong> — {r.text}</div>
                {(r.imagePublicId || r.imageUrl) && (
                  <div style={{marginTop:6}}>
                    <CldImage publicId={r.imagePublicId} url={r.imageUrl} w={800} h={300} alt="question" />
                  </div>
                )}
                <div>Ans: {r.answer}</div>
                <button onClick={()=>del(r.id)} style={{marginTop:6}} disabled={busy}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
