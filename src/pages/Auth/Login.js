import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import "../../styles/auth.css";

export default function Login() {
  const [mode, setMode] = useState("login"); // or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");       // NEW
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const nav = useNavigate();
  const loc = useLocation();
  const redirectTo = loc.state?.from?.pathname || "/";

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setErr("");
    setSubmitting(true);

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const trimmedName = name.trim();
        if (!trimmedName) {
          setErr("الاسم مطلوب");
          setSubmitting(false);
          return;
        }

        const cred = await createUserWithEmailAndPassword(auth, email, password);

        // Save profile fields in Auth
        await updateProfile(cred.user, { displayName: trimmedName });

        // Save user doc in Firestore
        await setDoc(doc(db, "users", cred.user.uid), {
          name: trimmedName,
          email,
          phone: phone || "",
          role: "user",
          createdAt: serverTimestamp(),
        });
      }

      nav(redirectTo, { replace: true });
    } catch (ex) {
      setErr(ex?.message || "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="lpage" dir="rtl">
      {/* Top bar to match the app */}
      <div className="lbar">
        <div className="lbar__left"></div>
        <div className="lbar__center">Al Majlis</div>
        <div className="lbar__right"></div>
      </div>

      {/* Centered auth card */}
      <div className="lstage container">
        <div className="lcard">
          <h2 className="lcard__title">
            {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
          </h2>

        <form onSubmit={onSubmit} className="lcard__form">
  {mode === "signup" && (
    <input
      className="linput linput--ltr"
      placeholder="Name"
      type="text"
      autoComplete="name"
      dir="ltr"
      value={name}
      onChange={(e) => setName(e.target.value)}
      required
    />
  )}

  <input
    className="linput linput--ltr"
    placeholder="Email"
    type="email"
    inputMode="email"
    autoComplete="email"
    dir="ltr"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    required
  />

  <input
    className="linput linput--ltr"
    type="password"
    placeholder="Password"
    autoComplete={mode === "login" ? "current-password" : "new-password"}
    dir="ltr"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    required
  />

  {mode === "signup" && (
    <input
      className="linput linput--ltr"
      placeholder="Phone (اختياري)"
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      dir="ltr"
      value={phone}
      onChange={(e) => setPhone(e.target.value)}
    />
  )}

            {err && <div className="lerr">{err}</div>}

            <div className="lactions">
              <button
                type="submit"
                className="lbtn lbtn--primary"
                disabled={submitting}
              >
                {submitting ? "Working..." : "Submit"}
              </button>

              <button
                type="button"
                className="lbtn lbtn--alt"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                disabled={submitting}
              >
                {mode === "login" ? "Switch to Sign up" : "Switch to Login"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
