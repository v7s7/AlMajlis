// src/pages/Admin/Questions.jsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import { uploadImage } from "../../lib/upload"; // handles images & videos via /auto/upload
import CldImage from "../../components/CldImage";
import "../../styles/questions.css";

export default function Questions() {
  const role = window.__ALMAJLIS__?.role || "user";
  const [cats, setCats] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [value, setValue] = useState(200);
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");

  // Add form media states
  const [qImageUrl, setQImageUrl] = useState("");
  const [qFile, setQFile] = useState(null);
  const [qMediaType, setQMediaType] = useState("image"); // "image" | "video"

  const [aImageUrl, setAImageUrl] = useState("");
  const [aFile, setAFile] = useState(null);
  const [aMediaType, setAMediaType] = useState("image"); // "image" | "video"

  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  // edit states
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const nav = useNavigate();

  // ADD: category totals
  const [catCounts, setCatCounts] = useState({});

  const refreshCatCounts = useCallback(async () => {
    // Fetch all questions once, then reduce to counts per category
    const snap = await getDocs(collection(db, "questions"));
    const counts = {};
    snap.docs.forEach(d => {
      const cid = d.data().categoryId;
      if (!cid) return;
      counts[cid] = (counts[cid] || 0) + 1;
    });
    setCatCounts(counts);
  }, []);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "categories"), orderBy("name")));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCats(list);
      if (list[0]) setCategoryId(prev => prev || list[0].id);
      // ADD: compute category totals when categories first load
      await refreshCatCounts();
    })();
  }, [refreshCatCounts]);

  // Infer media type from a File or a URL (fallback)
  function inferMediaTypeFromFile(file) {
    if (!file || !file.type) return "image";
    return file.type.startsWith("video/") ? "video" : "image";
  }
  function inferMediaTypeFromUrl(url = "") {
    const u = url.toLowerCase();
    if (/\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(u)) return "video";
    return "image";
  }

  // Memoized refresh so it’s safe in deps
  const refresh = useCallback(async () => {
    const col = collection(db, "questions");
    const qRef = categoryId ? query(col, where("categoryId", "==", categoryId)) : query(col);
    const snap = await getDocs(qRef);
    const list = snap.docs.map(d => {
      const data = { id: d.id, ...d.data() };
      // Back-compat: if mediaType missing, infer from URL
      const qType = data.questionMediaType || inferMediaTypeFromUrl(data.questionImageUrl || data.imageUrl);
      const aType = data.answerMediaType || inferMediaTypeFromUrl(data.answerImageUrl);
      return { ...data, questionMediaType: qType, answerMediaType: aType };
    });
    setRows(list);
  }, [categoryId]);

  // auto-load questions whenever category changes
  useEffect(() => {
    if (!categoryId) return;
    refresh();
  }, [categoryId, refresh]);

  // ======== COUNTS (memoized) ========
  // Rows for the chosen category
  const filteredRows = useMemo(
    () => rows.filter(r => !categoryId || r.categoryId === categoryId),
    [rows, categoryId]
  );

  // Per-value counts (200/400/600) + total
  const valueCounts = useMemo(() => {
    const counts = { 200: 0, 400: 0, 600: 0 };
    for (const r of filteredRows) {
      const v = Number(r.value);
      if (counts[v] == null) counts[v] = 0; // safety for unexpected values
      counts[v] += 1;
    }
    return counts;
  }, [filteredRows]);

  const totalCount = filteredRows.length;

  async function add() {
    if (role !== "admin") return alert("Not authorized.");

    const hasAnswerText = !!answer.trim();
    const hasAnswerMedia = !!aFile || !!aImageUrl.trim();
    if (!categoryId || !text.trim() || !(hasAnswerText || hasAnswerMedia)) {
      return alert("Fill category, question text, and either answer TEXT or answer MEDIA.");
    }

    setBusy(true);
    try {
      let qFinalUrl = qImageUrl.trim();
      let qPublicId = "";
      let qType = qMediaType || inferMediaTypeFromUrl(qFinalUrl);

      if (qFile) {
        const up = await uploadImage(qFile); // uploadAsset if you split utils
        qFinalUrl = up.url;
        qPublicId = up.publicId;
        qType = inferMediaTypeFromFile(qFile);
      }

      let aFinalUrl = aImageUrl.trim();
      let aPublicId = "";
      let aType = aMediaType || inferMediaTypeFromUrl(aFinalUrl);

      if (aFile) {
        const up = await uploadImage(aFile);
        aFinalUrl = up.url;
        aPublicId = up.publicId;
        aType = inferMediaTypeFromFile(aFile);
      }

      await addDoc(collection(db, "questions"), {
        categoryId,
        value: Number(value),
        text: text.trim(),
        answer: answer.trim(), // can be empty if media exists
        // legacy fields kept for compatibility
        imageUrl: qFinalUrl || "",
        imagePublicId: qPublicId || "",
        questionImageUrl: qFinalUrl || "",
        questionImagePublicId: qPublicId || "",
        answerImageUrl: aFinalUrl || "",
        answerImagePublicId: aPublicId || "",
        // new: explicit media types
        questionMediaType: qType,
        answerMediaType: aType,
        isActive: true,
        createdAt: serverTimestamp()
      });

      setText("");
      setAnswer("");
      setQImageUrl("");
      setQFile(null);
      setQMediaType("image");
      setAImageUrl("");
      setAFile(null);
      setAMediaType("image");

      await refresh();
      // ADD: update category totals after add
      await refreshCatCounts();
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
      // ADD: update category totals after delete
      await refreshCatCounts();
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
      // QUESTION media
      let qFinalUrl = (editValues.questionImageUrl || "").trim();
      let qPublicId = editValues.questionImagePublicId || "";
      let qType = editValues.questionMediaType || inferMediaTypeFromUrl(qFinalUrl);

      if (editValues.qFile) {
        const up = await uploadImage(editValues.qFile);
        qFinalUrl = up.url;
        qPublicId = up.publicId;
        qType = inferMediaTypeFromFile(editValues.qFile);
      }

      // ANSWER media
      let aFinalUrl = (editValues.answerImageUrl || "").trim();
      let aPublicId = editValues.answerImagePublicId || "";
      let aType = editValues.answerMediaType || inferMediaTypeFromUrl(aFinalUrl);

      if (editValues.aFile) {
        const up = await uploadImage(editValues.aFile);
        aFinalUrl = up.url;
        aPublicId = up.publicId;
        aType = inferMediaTypeFromFile(editValues.aFile);
      }

      await updateDoc(doc(db, "questions", id), {
        categoryId: editValues.categoryId,
        value: Number(editValues.value),
        text: editValues.text.trim(),
        answer: (editValues.answer || "").trim(), // allow empty if media provided
        imageUrl: qFinalUrl,
        imagePublicId: qPublicId,
        questionImageUrl: qFinalUrl,
        questionImagePublicId: qPublicId,
        answerImageUrl: aFinalUrl,
        answerImagePublicId: aPublicId,
        questionMediaType: qType,
        answerMediaType: aType,
        updatedAt: serverTimestamp()
      });

      setEditingId(null);
      setEditValues({});
      await refresh();
      // ADD: update category totals after possible category change
      await refreshCatCounts();
    } catch (e) {
      console.error(e);
      alert("Update failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  if (role !== "admin") return <div style={{ padding: 16 }}>Not authorized.</div>;

  // Prepare a map to track per-value index while rendering
  const seenIndex = { 200: 0, 400: 0, 600: 0 };

  return (
    <div className="qs" style={{ maxWidth: 1100, margin: "20px auto", padding: 16 }}>
      <h2>Questions</h2>
      <button className="btn" onClick={() => nav(-1)}>↩︎ رجوع</button>

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
                {c.name} ({catCounts[c.id] || 0})
              </option>
            ))}
          </select>

          <select
            value={value}
            onChange={e => setValue(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          >
            <option value="200">200 ({valueCounts[200] || 0})</option>
            <option value="400">400 ({valueCounts[400] || 0})</option>
            <option value="600">600 ({valueCounts[600] || 0})</option>
          </select>

          <input
            placeholder="Question text"
            value={text}
            onChange={e => setText(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <input
            placeholder="Correct answer (or leave empty if using media)"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />

          {/* Question media */}
          <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
            <select
              value={qMediaType}
              onChange={e => setQMediaType(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="image">صورة السؤال</option>
              <option value="video">فيديو السؤال</option>
            </select>
            <input
              placeholder={qMediaType === "video" ? "Question Video URL (optional)" : "Question Image URL (optional)"}
              value={qImageUrl}
              onChange={e => setQImageUrl(e.target.value)}
              style={{ width: "100%" }}
            />
            <input
              type="file"
              accept="image/*,video/*"
              onChange={e => {
                const file = e.target.files?.[0] || null;
                setQFile(file);
                if (file) setQMediaType(inferMediaTypeFromFile(file));
              }}
            />
          </div>

          {/* Answer media */}
          <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
            <select
              value={aMediaType}
              onChange={e => setAMediaType(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="image">صورة الإجابة</option>
              <option value="video">فيديو الإجابة</option>
            </select>
            <input
              placeholder={aMediaType === "video" ? "Answer Video URL (optional)" : "Answer Image URL (optional)"}
              value={aImageUrl}
              onChange={e => setAImageUrl(e.target.value)}
              style={{ width: "100%" }}
            />
            <input
              type="file"
              accept="image/*,video/*"
              onChange={e => {
                const file = e.target.files?.[0] || null;
                setAFile(file);
                if (file) setAMediaType(inferMediaTypeFromFile(file));
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={add} disabled={busy}>Add Question</button>
            <button onClick={refresh} disabled={busy}>Refresh</button>
          </div>
        </div>

        {/* Questions list */}
        <div>
          {/* Summary bar with totals */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
              marginBottom: 10,
              padding: "8px 10px",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              background: "#fafafa"
            }}
          >
            <span style={{ fontWeight: 700 }}>Total:</span>
            <span>{totalCount}</span>
            <span style={{ opacity: 0.5 }}>|</span>
            <span>200 = {valueCounts[200] || 0}</span>
            <span>400 = {valueCounts[400] || 0}</span>
            <span>600 = {valueCounts[600] || 0}</span>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {filteredRows
              .sort((a, b) => a.value - b.value)
              .map(r => {
                const v = Number(r.value);
                // increment per-value index for display like "#3 / 13"
                seenIndex[v] = (seenIndex[v] || 0) + 1;
                const position = seenIndex[v];
                const groupTotal = valueCounts[v] || 0;

                return (
                  editingId === r.id ? (
                    <div key={r.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10 }}>
                      <select
                        value={editValues.categoryId}
                        onChange={e => setEditValues({ ...editValues, categoryId: e.target.value })}
                        style={{ width: "100%", marginBottom: 6 }}
                      >
                        {cats.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <select
                        value={editValues.value}
                        onChange={e => setEditValues({ ...editValues, value: e.target.value })}
                        style={{ width: "100%", marginBottom: 6 }}
                      >
                        <option value="200">200 ({valueCounts[200] || 0})</option>
                        <option value="400">400 ({valueCounts[400] || 0})</option>
                        <option value="600">600 ({valueCounts[600] || 0})</option>
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

                      {/* Edit: Question media */}
                      <select
                        value={editValues.questionMediaType || "image"}
                        onChange={e => setEditValues({ ...editValues, questionMediaType: e.target.value })}
                        style={{ width: "100%", marginBottom: 6 }}
                      >
                        <option value="image">صورة السؤال</option>
                        <option value="video">فيديو السؤال</option>
                      </select>
                      <input
                        value={editValues.questionImageUrl || ""}
                        onChange={e => setEditValues({ ...editValues, questionImageUrl: e.target.value })}
                        placeholder="Question Media URL"
                        style={{ width: "100%", marginBottom: 6 }}
                      />
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={e => setEditValues({ ...editValues, qFile: e.target.files?.[0] })}
                      />

                      {/* Edit: Answer media */}
                      <select
                        value={editValues.answerMediaType || "image"}
                        onChange={e => setEditValues({ ...editValues, answerMediaType: e.target.value })}
                        style={{ width: "100%", margin: "6px 0" }}
                      >
                        <option value="image">صورة الإجابة</option>
                        <option value="video">فيديو الإجابة</option>
                      </select>
                      <input
                        value={editValues.answerImageUrl || ""}
                        onChange={e => setEditValues({ ...editValues, answerImageUrl: e.target.value })}
                        placeholder="Answer Media URL"
                        style={{ width: "100%", marginBottom: 6 }}
                      />
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={e => setEditValues({ ...editValues, aFile: e.target.files?.[0] })}
                      />

                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={() => saveEdit(r.id)} disabled={busy}>Save</button>
                        <button onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={r.id} className="qcard" style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong>{r.value}</strong>
                     
                        <span>— {r.text}</span>
                      </div>

                      {(r.questionImagePublicId || r.imagePublicId || r.questionImageUrl || r.imageUrl) && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                            وسائط السؤال
                          </div>
                          {(r.questionMediaType === "video") ? (
                            <video
                              src={r.questionImageUrl || r.imageUrl}
                              style={{ width: "100%", maxWidth: 800, borderRadius: 8 }}
                              controls
                            />
                          ) : (
                            <CldImage
                              publicId={r.questionImagePublicId || r.imagePublicId}
                              url={r.questionImageUrl || r.imageUrl}
                              w={800}
                              h={300}
                              alt="question"
                            />
                          )}
                        </div>
                      )}

                      {(r.answerImagePublicId || r.answerImageUrl) && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>
                            وسائط الإجابة
                          </div>
                          {(r.answerMediaType === "video") ? (
                            <video
                              src={r.answerImageUrl}
                              style={{ width: "100%", maxWidth: 800, borderRadius: 8 }}
                              controls
                            />
                          ) : (
                            <CldImage
                              publicId={r.answerImagePublicId}
                              url={r.answerImageUrl}
                              w={800}
                              h={300}
                              alt="answer"
                            />
                          )}
                        </div>
                      )}

                      {r.answer?.trim() && (
                        <div style={{ marginTop: 6 }}>Ans: {r.answer}</div>
                      )}
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
                              answerImagePublicId: r.answerImagePublicId || "",
                              questionMediaType: r.questionMediaType || inferMediaTypeFromUrl(r.questionImageUrl || r.imageUrl),
                              answerMediaType: r.answerMediaType || inferMediaTypeFromUrl(r.answerImageUrl)
                            });
                          }}
                          disabled={busy}
                        >
                          Edit
                        </button>
                        <button onClick={() => del(r.id)} disabled={busy}>Delete</button>
                      </div>
                    </div>
                  )
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
