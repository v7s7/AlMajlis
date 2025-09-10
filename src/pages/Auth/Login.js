import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import "../../styles/auth.css";

export default function Login() {
  const [mode, setMode] = useState("login"); // or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
            <input
              className="linput"
              placeholder="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              className="linput"
              type="password"
              placeholder="Password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {mode === "signup" && (
              <input
                className="linput"
                placeholder="Phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
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
