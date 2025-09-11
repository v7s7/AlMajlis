// src/pages/Admin/Questions.jsx
import { useEffect, useState, useRef } from "react";import { db } from "../../firebase";
import {
  collection, addDoc, getDocs, deleteDoc, doc, orderBy, query, where, serverTimestamp
} from "firebase/firestore";
import { uploadImage } from "../../lib/upload";
import CldImage from "../../components/CldImage";
import "../../styles/questions.css";
export default function Questions() {
  const role = window.__ALMAJLIS__?.role || "user";
  const [cats, setCats] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [value, setValue] = useState(200);
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");

  // NEW: separate image inputs for question & answer
  const [qImageUrl, setQImageUrl] = useState("");  // optional manual URL (question)
  const [qFile, setQFile] = useState(null);        // optional local file (question)
  const [aImageUrl, setAImageUrl] = useState("");  // optional manual URL (answer)
  const [aFile, setAFile] = useState(null);        // optional local file (answer)

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
      // Upload (or take manual URL) for the QUESTION image
      let qFinalUrl = qImageUrl.trim();
      let qPublicId = "";
      if (qFile) {
        const up = await uploadImage(qFile);
        qFinalUrl = up.url;
        qPublicId = up.publicId;
      }

      // Upload (or take manual URL) for the ANSWER image
      let aFinalUrl = aImageUrl.trim();
      let aPublicId = "";
      if (aFile) {
        const up = await uploadImage(aFile);
        aFinalUrl = up.url;
        aPublicId = up.publicId;
      }

      // Back-compat: keep legacy imageUrl/imagePublicId aligned to the QUESTION image
      await addDoc(collection(db, "questions"), {
        categoryId,
        value: Number(value),
        text: text.trim(),
        answer: answer.trim(),

        // Legacy single-image fields (question-side for older pages):
        imageUrl: qFinalUrl || "",               // legacy
        imagePublicId: qPublicId || "",          // legacy

        // New explicit fields:
        questionImageUrl: qFinalUrl || "",
        questionImagePublicId: qPublicId || "",
        answerImageUrl: aFinalUrl || "",
        answerImagePublicId: aPublicId || "",

        isActive: true,
        createdAt: serverTimestamp()
      });

      // Reset form
      setText(""); setAnswer("");
      setQImageUrl(""); setQFile(null);
      setAImageUrl(""); setAFile(null);

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
<div className="qs" style={{maxWidth:1100, margin:"20px auto", padding:16}}>      <h2>Questions</h2>
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

          <input
            placeholder="Question text (AR or EN)"
            value={text}
            onChange={e=>setText(e.target.value)}
            style={{width:"100%", marginBottom:8}}
          />
          <input
            placeholder="Correct answer"
            value={answer}
            onChange={e=>setAnswer(e.target.value)}
            style={{width:"100%", marginBottom:8}}
          />

          {/* QUESTION image (optional) */}
          <input
            placeholder="Question Image URL (optional)"
            value={qImageUrl}
            onChange={e=>setQImageUrl(e.target.value)}
            style={{width:"100%", marginBottom:8}}
          />
          <input
            type="file"
            onChange={e=>setQFile(e.target.files?.[0] || null)}
            style={{marginBottom:8}}
          />

          {/* ANSWER image (optional) */}
          <input
            placeholder="Answer Image URL (optional)"
            value={aImageUrl}
            onChange={e=>setAImageUrl(e.target.value)}
            style={{width:"100%", marginBottom:8}}
          />
          <input
            type="file"
            onChange={e=>setAFile(e.target.files?.[0] || null)}
          />

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
<div key={r.id} className="qcard" style={{border:"1px solid #ddd", borderRadius:12, padding:10}}>                <div><strong>{r.value}</strong> — {r.text}</div>

                {/* QUESTION image (supports legacy or new fields) */}
                {(r.imagePublicId || r.imageUrl || r.questionImagePublicId || r.questionImageUrl) && (
                  <div style={{marginTop:6}}>
                    <div style={{fontSize:12, fontWeight:700, color:"#64748b", marginBottom:4}}>صورة السؤال</div>
                    <CldImage
                      publicId={r.questionImagePublicId || r.imagePublicId}
                      url={r.questionImageUrl || r.imageUrl}
                      w={800}
                      h={300}
                      alt="question"
                    />
                  </div>
                )}

                {/* ANSWER image (new fields) */}
                {(r.answerImagePublicId || r.answerImageUrl) && (
                  <div style={{marginTop:6}}>
                    <div style={{fontSize:12, fontWeight:700, color:"#64748b", marginBottom:4}}>صورة الإجابة</div>
                    <CldImage
                      publicId={r.answerImagePublicId}
                      url={r.answerImageUrl}
                      w={800}
                      h={300}
                      alt="answer"
                    />
                  </div>
                )}

                <div style={{marginTop:6}}>Ans: {r.answer}</div>
                <button onClick={()=>del(r.id)} style={{marginTop:6}} disabled={busy}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
