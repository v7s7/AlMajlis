import { useEffect, useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { auth, db } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function RequireAuth() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("user");
  const [loaded, setLoaded] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setLoaded(true);
        return;
      }
      setUser(u);
      // fetch role
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) setRole(snap.data().role || "user");
      } catch {}
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  if (!loaded) return <div style={{padding:16}}>Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;

  // Provide user role to children via window (quick hack for MVP)
  window.__ALMAJLIS__ = { user, role };
  return <Outlet />;
}
