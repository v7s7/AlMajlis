// src/pages/Admin/Categories.jsx
import { useEffect, useState } from "react";
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
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { uploadImage } from "../../lib/upload";
import CldImage from "../../components/CldImage";
import "../../styles/categories.css";

export default function Categories() {
  const role = window.__ALMAJLIS__?.role || "user";
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const nav = useNavigate();

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editFile, setEditFile] = useState(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    const snap = await getDocs(query(collection(db, "categories"), orderBy("name")));
    setRows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function add() {
    if (role !== "admin") return alert("Not authorized.");
    if (!name.trim()) return alert("Please enter a category name.");

    setBusy(true);
    setMsg("Creating...");
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

      setName("");
      setImageUrl("");
      setFile(null);
      await refresh();
    } catch (e) {
      console.error(e);
      alert("Create failed: " + e.message);
    } finally {
      setBusy(false);
      setMsg("");
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

  async function saveEdit(id) {
    if (role !== "admin") return alert("Not authorized.");
    setBusy(true);
    try {
      let finalUrl = editImageUrl.trim();
      let publicId = "";

      if (editFile) {
        setMsg("Uploading image…");
        const up = await uploadImage(editFile);
        finalUrl = up.url;
        publicId = up.publicId;
      }

      await updateDoc(doc(db, "categories", id), {
        name: editName.trim(),
        imageUrl: finalUrl,
        imagePublicId: publicId,
        updatedAt: serverTimestamp()
      });

      setEditingId(null);
      setEditName("");
      setEditImageUrl("");
      setEditFile(null);
      await refresh();
    } catch (e) {
      console.error(e);
      alert("Update failed: " + e.message);
    } finally {
      setBusy(false);
      setMsg("");
    }
  }

  if (role !== "admin") return <div style={{ padding: 16 }}>Not authorized.</div>;

  return (
    <div className="cats" style={{ maxWidth: 1100, margin: "20px auto", padding: 16 }}>
      {/* Top row with Back */}
      <div className="cats__top">
        <h2>Categories</h2>
        <button className="btn" onClick={() => nav(-1)}>
          ↩︎ رجوع
        </button>
      </div>

      {/* Add new category */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 2fr 1fr 1fr",
          gap: 8,
          alignItems: "center",
          marginTop: 8
        }}
      >
        <input
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={busy}
        />
        <input
          placeholder="Image URL (optional)"
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          disabled={busy}
        />
        <input
          type="file"
          onChange={e => setFile(e.target.files?.[0] || null)}
          disabled={busy}
        />
        <button onClick={add} disabled={busy}>
          Add
        </button>
      </div>
      {busy && <div style={{ marginTop: 8 }}>{msg}</div>}

      {/* Categories list */}
      <div
        className="cats__grid"
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
          marginTop: 12
        }}
      >
        {rows.map(r => (
          <div
            key={r.id}
            className="cats__card"
            style={{ border: "1px solid #ddd", borderRadius: 12, padding: 10 }}
          >
            {editingId === r.id ? (
              <>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  style={{ marginBottom: 6, width: "100%" }}
                />
                <input
                  value={editImageUrl}
                  onChange={e => setEditImageUrl(e.target.value)}
                  placeholder="Image URL"
                  style={{ marginBottom: 6, width: "100%" }}
                />
                <input
                  type="file"
                  onChange={e => setEditFile(e.target.files?.[0] || null)}
                  style={{ marginBottom: 6 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => saveEdit(r.id)} disabled={busy}>
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditName("");
                      setEditImageUrl("");
                      setEditFile(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                {(r.imagePublicId || r.imageUrl) && (
                  <CldImage
                    publicId={r.imagePublicId}
                    url={r.imageUrl}
                    w={500}
                    h={120}
                    alt={r.name}
                  />
                )}
                <div style={{ marginTop: 8, fontWeight: 600 }}>{r.name}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => {
                      setEditingId(r.id);
                      setEditName(r.name);
                      setEditImageUrl(r.imageUrl || "");
                    }}
                    disabled={busy}
                  >
                    Edit
                  </button>
                  <button onClick={() => del(r.id)} disabled={busy}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
