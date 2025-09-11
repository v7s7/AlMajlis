import { Link, useNavigate } from "react-router-dom";
import "../../styles/adminhome.css";

export default function AdminHome() {
  const role = window.__ALMAJLIS__?.role || "user";
  const nav = useNavigate();

  if (role !== "admin") {
    return <div className="unauth">غير مصرح به.</div>;
  }

  return (
    <div className="adminpage" dir="rtl">
      {/* Top nav (same design) */}
      <div className="abar">
        <div className="abar__left">
          <button className="iconbtn" onClick={() => nav(-1)}>↩︎ رجوع</button>
          <button className="iconbtn" onClick={() => nav("/")}>⎋ الرئيسية</button>
        </div>
        <div className="abar__center">لوحة المشرف</div>
        <div className="abar__right" />
      </div>

      {/* Compact content — just two blocks + back */}
      <div className="admincompact container">
        <Link to="/admin/categories" className="admincard">
          <div className="admincard__title">الفئات</div>
          <div className="admincard__desc">إضافة / تعديل / حذف الفئات</div>
          <span className="btn btn--main admincard__cta">إدارة الفئات</span>
        </Link>

        <Link to="/admin/questions" className="admincard">
          <div className="admincard__title">الأسئلة</div>
          <div className="admincard__desc">إضافة / تعديل / تعطيل الأسئلة</div>
          <span className="btn btn--main admincard__cta">إدارة الأسئلة</span>
        </Link>

        <div className="admincompact__footer">
          <button className="btn btn--main" onClick={() => nav(-1)}>↩︎ رجوع</button>
        </div>
      </div>
    </div>
  );
}
