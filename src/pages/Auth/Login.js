import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function Login() {
  const [mode, setMode] = useState("login"); // or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const loc = useLocation();
  const redirectTo = loc.state?.from?.pathname || "/";

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
          email,
          phone,
          role: "user",
          createdAt: serverTimestamp(),
        });
      }
      nav(redirectTo, { replace: true });
    } catch (ex) {
      setErr(ex.message || "Error");
    }
  }

  return (
    <div style={{maxWidth:420, margin:"40px auto", padding:16}}>
      <h2>Al Majlis — {mode === "login" ? "Login" : "Sign up"}</h2>
      <form onSubmit={onSubmit} style={{display:"grid", gap:8}}>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        {mode === "signup" && (
          <input placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)} />
        )}
        {err && <div style={{color:"crimson"}}>{err}</div>}
        <div style={{display:"flex", gap:8}}>
          <button type="submit">Submit</button>
          <button type="button" onClick={()=>setMode(mode==="login"?"signup":"login")}>
            Switch to {mode==="login"?"Sign up":"Login"}
          </button>
        </div>
      </form>
    </div>
  );
}
