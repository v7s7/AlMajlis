// src/App.jsx
import { Routes, Route } from "react-router-dom";
import Login from "./pages/Auth/Login";
import RequireAuth from "./pages/Auth/RequireAuth";
import Dashboard from "./pages/Dashboard/Dashboard";
import NewGame from "./pages/NewGame/NewGame";
import GameRoom from "./pages/Game/GameRoom";
import QuestionPage from "./pages/QuestionPage/QuestionPage"; // ⬅️ NEW
import Results from "./pages/Game/Results";
import AdminHome from "./pages/Admin/AdminHome";
import Categories from "./pages/Admin/Categories";
import Questions from "./pages/Admin/Questions";
import NotFound from "./pages/NotFound";
import AnswerPage from "./pages/QuestionPage/AnswerPage"; // ⬅️ NEW

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/new" element={<NewGame />} />
        <Route path="/game/:id" element={<GameRoom />} />
        <Route path="/game/:id/tile/:tileId" element={<QuestionPage />} /> {/* ⬅️ NEW */}
        <Route path="/game/:id/tile/:tileId/answer" element={<AnswerPage />} /> {/* ⬅️ NEW */}

        <Route path="/game/:id/results" element={<Results />} />

        {/* Admin */}
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/categories" element={<Categories />} />
        <Route path="/admin/questions" element={<Questions />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
