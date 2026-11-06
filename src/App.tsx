import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./lib/auth";
import { AppLayout } from "./components/AppLayout";
import { PageLoader } from "./components/ui";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import GoogleCallbackPage from "./pages/GoogleCallbackPage";
import SetupPage from "./pages/SetupPage";
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

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader label="កំពុងផ្ទៀងផ្ទាត់គណនី…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout>
              <Outlet />
            </AppLayout>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/setup"
          element={
            <RequireAdmin>
              <SetupPage />
            </RequireAdmin>
          }
        />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/students/:id" element={<StudentDetailPage />} />
        <Route path="/scores" element={<ScoreEntryPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/report-card/:id" element={<ReportCardPage />} />
        <Route path="/transcript/:id" element={<TranscriptPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/classes" element={<ClassesPage />} />
        <Route path="/subjects" element={<SubjectsPage />} />
        <Route
          path="/teachers"
          element={
            <RequireAdmin>
              <TeachersPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAdmin>
              <SettingsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/audit"
          element={
            <RequireAdmin>
              <AuditPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
