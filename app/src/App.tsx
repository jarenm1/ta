import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AgentChatProvider } from './agent/AgentChatProvider';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { CanvasDataProvider } from './canvas/CanvasDataContext';
import { SettingsProvider } from './settings/SettingsContext';
import AppNavbar from './components/AppNavbar';
import DashboardPage from './pages/DashboardPage';
import CourseCodingWorkspacePage from './pages/CourseCodingWorkspacePage';
import CoursePage from './pages/CoursePage';
import CourseStudyGuidePage from './pages/CourseStudyGuidePage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function PublicOnlyRoute() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/courses/:courseSlug" element={<CoursePage />} />
        <Route path="/courses/:courseSlug/workspace" element={<CourseCodingWorkspacePage />} />
        <Route path="/courses/:courseSlug/study-guides" element={<CourseStudyGuidePage />} />
        <Route path="/courses/:courseSlug/study-guides/:guideId" element={<CourseStudyGuidePage />} />
      </Route>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppShell() {
  return (
    <SettingsProvider>
      <AgentChatProvider>
        <CanvasDataProvider>
          <div className="flex h-screen flex-col overflow-hidden bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
            <AppNavbar />
            <div className="min-h-0 flex-1 overflow-hidden">
              <AppRoutes />
            </div>
          </div>
        </CanvasDataProvider>
      </AgentChatProvider>
    </SettingsProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppShell />
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
