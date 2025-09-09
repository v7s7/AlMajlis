import { Link } from "react-router-dom";

export default function AdminHome() {
  const role = window.__ALMAJLIS__?.role || "user";
  if (role !== "admin") return <div style={{padding:16}}>Not authorized.</div>;

  return (
    <div style={{maxWidth:600, margin:"20px auto", padding:16}}>
      <h2>Admin</h2>
      <div style={{display:"grid", gap:12, marginTop:12}}>
        <Link to="/admin/categories"><button>Manage Categories</button></Link>
        <Link to="/admin/questions"><button>Manage Questions</button></Link>
      </div>
    </div>
  );
}
