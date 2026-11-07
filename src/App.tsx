import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import StudentsPage from "./pages/StudentsPage";
import StudentDetailPage from "./pages/StudentDetailPage";
import ClassesPage from "./pages/ClassesPage";
import SubjectsPage from "./pages/SubjectsPage";
import ScoreEntryPage from "./pages/ScoreEntryPage";
import ResultsPage from "./pages/ResultsPage";
import ReportCardPage from "./pages/ReportCardPage";
import TranscriptPage from "./pages/TranscriptPage";
import AttendancePage from "./pages/AttendancePage";
import TeachersPage from "./pages/TeachersPage";
import SettingsPage from "./pages/SettingsPage";
import AuditPage from "./pages/AuditPage";
import NotFoundPage from "./pages/NotFoundPage";

/** No login: the whole app runs in the browser with local data. */
export default function App() {
  return (
    <Routes>
      <Route
        element={
          <AppLayout>
            <Outlet />
          </AppLayout>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/students/:id" element={<StudentDetailPage />} />
        <Route path="/scores" element={<ScoreEntryPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/report-card/:id" element={<ReportCardPage />} />
        <Route path="/transcript/:id" element={<TranscriptPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/classes" element={<ClassesPage />} />
        <Route path="/subjects" element={<SubjectsPage />} />
        <Route path="/teachers" element={<TeachersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
