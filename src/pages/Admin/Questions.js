// src/pages/Admin/Questions.jsx
import { useEffect, useState } from "react";
import { db } from "../../firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
  where,
  serverTimestamp,
  updateDoc
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

  // add form image states
  const [qImageUrl, setQImageUrl] = useState("");
  const [qFile, setQFile] = useState(null);
  const [aImageUrl, setAImageUrl] = useState("");
  const [aFile, setAFile] = useState(null);

  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  // edit states
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

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
    const q = categoryId ? query(col, where("categoryId", "==", categoryId)) : query(col);
    const snap = await getDocs(q);
    setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function add() {
    if (role !== "admin") return alert("Not authorized.");
    if (!categoryId || !text.trim() || !answer.trim())
      return alert("Fill category, question text, and answer.");

    setBusy(true);
    try {
      let qFinalUrl = qImageUrl.trim();
      let qPublicId = "";
      if (qFile) {
        const up = await uploadImage(qFile);
        qFinalUrl = up.url;
        qPublicId = up.publicId;
      }

      let aFinalUrl = aImageUrl.trim();
      let aPublicId = "";
      if (aFile) {
        const up = await uploadImage(aFile);
        aFinalUrl = up.url;
        aPublicId = up.publicId;
      }

      await addDoc(collection(db, "questions"), {
        categoryId,
        value: Number(value),
        text: text.trim(),
        answer: answer.trim(),
        imageUrl: qFinalUrl || "",
        imagePublicId: qPublicId || "",
        questionImageUrl: qFinalUrl || "",
        questionImagePublicId: qPublicId || "",
        answerImageUrl: aFinalUrl || "",
        answerImagePublicId: aPublicId || "",
        isActive: true,
        createdAt: serverTimestamp()
      });

      setText("");
      setAnswer("");
      setQImageUrl("");
      setQFile(null);
      setAImageUrl("");
      setAFile(null);

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

  async function saveEdit(id) {
    if (role !== "admin") return alert("Not authorized.");
    setBusy(true);
    try {
      let qFinalUrl = editValues.questionImageUrl?.trim() || "";
      let qPublicId = editValues.questionImagePublicId || "";
      if (editValues.qFile) {
        const up = await uploadImage(editValues.qFile);
        qFinalUrl = up.url;
        qPublicId = up.publicId;
      }

      let aFinalUrl = editValues.answerImageUrl?.trim() || "";
      let aPublicId = editValues.answerImagePublicId || "";
      if (editValues.aFile) {
        const up = await uploadImage(editValues.aFile);
        aFinalUrl = up.url;
        aPublicId = up.publicId;
      }

      await updateDoc(doc(db, "questions", id), {
        categoryId: editValues.categoryId,
        value: Number(editValues.value),
        text: editValues.text.trim(),
        answer: editValues.answer.trim(),
        imageUrl: qFinalUrl,
        imagePublicId: qPublicId,
        questionImageUrl: qFinalUrl,
        questionImagePublicId: qPublicId,
        answerImageUrl: aFinalUrl,
        answerImagePublicId: aPublicId,
        updatedAt: serverTimestamp()
      });

      setEditingId(null);
      setEditValues({});
      await refresh();
    } catch (e) {
      console.error(e);
      alert("Update failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  if (role !== "admin") return <div style={{ padding: 16 }}>Not authorized.</div>;

  return (
    <div className="qs" style={{ maxWidth: 1100, margin: "20px auto", padding: 16 }}>
      <h2>Questions</h2>
      <button className="btn" onClick={() => nav(-1)}>
          ↩︎ رجوع
        </button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Add form */}
        <div>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          >
            {cats.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={value}
            onChange={e => setValue(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          >
            <option value="200">200</option>
            <option value="400">400</option>
            <option value="600">600</option>
          </select>

          <input
            placeholder="Question text"
            value={text}
            onChange={e => setText(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <input
            placeholder="Correct answer"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />

          <input
            placeholder="Question Image URL (optional)"
            value={qImageUrl}
            onChange={e => setQImageUrl(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <input type="file" onChange={e => setQFile(e.target.files?.[0] || null)} style={{ marginBottom: 8 }} />

          <input
            placeholder="Answer Image URL (optional)"
            value={aImageUrl}
            onChange={e => setAImageUrl(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <input type="file" onChange={e => setAFile(e.target.files?.[0] || null)} />

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={add} disabled={busy}>
              Add Question
            </button>
            <button onClick={refresh} disabled={busy}>
              Refresh
            </button>
          </div>
        </div>

        {/* Questions list */}
        <div>
          <div style={{ display: "grid", gap: 10 }}>
            {rows
              .filter(r => !categoryId || r.categoryId === categoryId)
              .sort((a, b) => a.value - b.value)
              .map(r =>
                editingId === r.id ? (
                  <div key={r.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10 }}>
                    <select
                      value={editValues.categoryId}
                      onChange={e => setEditValues({ ...editValues, categoryId: e.target.value })}
                      style={{ width: "100%", marginBottom: 6 }}
                    >
                      {cats.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editValues.value}
                      onChange={e => setEditValues({ ...editValues, value: e.target.value })}
                      style={{ width: "100%", marginBottom: 6 }}
                    >
                      <option value="200">200</option>
                      <option value="400">400</option>
                      <option value="600">600</option>
                    </select>
                    <input
                      value={editValues.text}
                      onChange={e => setEditValues({ ...editValues, text: e.target.value })}
                      style={{ width: "100%", marginBottom: 6 }}
                    />
                    <input
                      value={editValues.answer}
                      onChange={e => setEditValues({ ...editValues, answer: e.target.value })}
                      style={{ width: "100%", marginBottom: 6 }}
                    />
                    <input
                      value={editValues.questionImageUrl}
                      onChange={e => setEditValues({ ...editValues, questionImageUrl: e.target.value })}
                      placeholder="Question Image URL"
                      style={{ width: "100%", marginBottom: 6 }}
                    />
                    <input type="file" onChange={e => setEditValues({ ...editValues, qFile: e.target.files?.[0] })} />
                    <input
                      value={editValues.answerImageUrl}
                      onChange={e => setEditValues({ ...editValues, answerImageUrl: e.target.value })}
                      placeholder="Answer Image URL"
                      style={{ width: "100%", margin: "6px 0" }}
                    />
                    <input type="file" onChange={e => setEditValues({ ...editValues, aFile: e.target.files?.[0] })} />

                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button onClick={() => saveEdit(r.id)} disabled={busy}>
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div key={r.id} className="qcard" style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10 }}>
                    <div>
                      <strong>{r.value}</strong> — {r.text}
                    </div>
                    {(r.imagePublicId || r.imageUrl || r.questionImagePublicId || r.questionImageUrl) && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                          صورة السؤال
                        </div>
                        <CldImage
                          publicId={r.questionImagePublicId || r.imagePublicId}
                          url={r.questionImageUrl || r.imageUrl}
                          w={800}
                          h={300}
                          alt="question"
                        />
                      </div>
                    )}
                    {(r.answerImagePublicId || r.answerImageUrl) && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                          صورة الإجابة
                        </div>
                        <CldImage
                          publicId={r.answerImagePublicId}
                          url={r.answerImageUrl}
                          w={800}
                          h={300}
                          alt="answer"
                        />
                      </div>
                    )}
                    <div style={{ marginTop: 6 }}>Ans: {r.answer}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <button
                        onClick={() => {
                          setEditingId(r.id);
                          setEditValues({
                            categoryId: r.categoryId,
                            value: r.value,
                            text: r.text,
                            answer: r.answer,
                            questionImageUrl: r.questionImageUrl || r.imageUrl || "",
                            questionImagePublicId: r.questionImagePublicId || r.imagePublicId || "",
                            answerImageUrl: r.answerImageUrl || "",
                            answerImagePublicId: r.answerImagePublicId || ""
                          });
                        }}
                        disabled={busy}
                      >
                        Edit
                      </button>
                      <button onClick={() => del(r.id)} disabled={busy}>
                        Delete
                      </button>
                    </div>
                  </div>
                )
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
