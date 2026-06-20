import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { refreshSession } from './api/auth.api';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './routes/auth/LoginPage';
import { RegisterPage } from './routes/auth/RegisterPage';
import { ForgotPasswordPage } from './routes/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './routes/auth/ResetPasswordPage';
import { DashboardPage } from './routes/DashboardPage';
import { ProfilePage } from './routes/ProfilePage';
import { TestLibraryPage } from './routes/tests/TestLibraryPage';
import { ExamRunnerPage } from './routes/exam/ExamRunnerPage';
import { MyResultsPage } from './routes/review/MyResultsPage';
import { AttemptReviewPage } from './routes/review/AttemptReviewPage';
import { AuthoringListPage } from './routes/authoring/AuthoringListPage';
import { TestEditorPage } from './routes/authoring/TestEditorPage';
import { KnowledgeGraphPage } from './routes/graph/KnowledgeGraphPage';
import { UserManagementPage } from './routes/admin/UserManagementPage';
import { ConfigurationPage } from './routes/admin/ConfigurationPage';
import { ExamFilesPage } from './routes/exam-files/ExamFilesPage';
import { ExamFileReviewPage } from './routes/exam-files/ExamFileReviewPage';
import { WelcomePage } from './routes/public/WelcomePage';
import { SamplePreviewPage } from './routes/public/SamplePreviewPage';

// Module-level guard so the boot refresh fires exactly once, even though React
// StrictMode double-invokes effects in dev (refresh tokens are single-use, so a
// duplicate call would revoke the just-issued session).
let bootstrapStarted = false;

function AuthBootstrap({ children }: { children: ReactNode }) {
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);

  useEffect(() => {
    if (bootstrapStarted) return;
    bootstrapStarted = true;
    const { setAuth, clear, finishBootstrap } = useAuthStore.getState();
    refreshSession()
      .then((res) => setAuth(res.user, res.accessToken))
      .catch(() => clear()) // no/expired cookie -> stay logged out
      .finally(() => finishBootstrap());
  }, []);

  if (isBootstrapping) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-400">
        <i className="fa-solid fa-spinner fa-spin text-2xl" />
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthBootstrap>
      <Routes>
        {/* Public guest surface (no auth) */}
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/welcome/sample" element={<SamplePreviewPage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Authenticated (any role) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/tests" element={<TestLibraryPage />} />
          <Route path="/exam/:attemptId" element={<ExamRunnerPage />} />
          <Route path="/results" element={<MyResultsPage />} />
          <Route path="/results/:attemptId" element={<AttemptReviewPage />} />
        </Route>

        {/* Teacher only — admins focus on management, not authoring */}
        <Route element={<ProtectedRoute roles={['teacher']} />}>
          <Route path="/authoring" element={<AuthoringListPage />} />
          <Route path="/authoring/:testId" element={<TestEditorPage />} />
          <Route path="/graph" element={<KnowledgeGraphPage />} />
          <Route path="/exam-files" element={<ExamFilesPage />} />
          <Route path="/exam-files/:id/review" element={<ExamFileReviewPage />} />
        </Route>

        {/* Admin only */}
        <Route element={<ProtectedRoute roles={['admin']} />}>
          <Route path="/admin/users" element={<UserManagementPage />} />
          <Route path="/admin/config" element={<ConfigurationPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AuthBootstrap>
    </BrowserRouter>
  );
}
