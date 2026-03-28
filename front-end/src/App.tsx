import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { useAuth } from './context/AuthContext';
import {
  getDisplayLanguageFromCookie,
  ensureGoogleTranslation,
} from './utils/displayLanguage';
import Auth from './features/auth/Auth';
import LessonCreator from './features/lesson-creator/LessonCreator';
import Assignments from './features/assignments/Assignments';
import Quizzes from './features/quizzes/Quizzes';
import { AppLayout } from './components/layout';
import {
  RequireAdmin,
  RequireAuth,
  RequireTeacher,
} from './components/routing/RouteGuards';
import ControlDashboard from './features/control-dashboard/ControlDashboard';
import AdminDashboard from './features/admin-dashboard/AdminDashboard';
import ControlCurriculum from './features/control-curriculum/ControlCurriculum';
import PlansManager from './features/plans-manager/PlansManager';
import PlanViewerPage from './features/plans-manager/PlanViewerPage';
import Settings from './features/settings/Settings';
import TeachersManagement from './features/teachers-management/TeachersManagement';
import Stats from './features/stats/Stats';

function HomeRoute() {
  const { user } = useAuth();

  if (user?.userRole === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return <ControlDashboard />;
}

function App() {
  useEffect(() => {
    const lang = getDisplayLanguageFromCookie();
    const dir = lang === 'en' ? 'ltr' : 'rtl';
    document.documentElement.dir = dir;
    document.documentElement.lang = lang === 'en' ? 'en' : 'ar';
    document.documentElement.style.setProperty('--app-dir', dir);

    if (lang === 'en') {
      ensureGoogleTranslation('en');
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/authentication" element={<Auth />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<HomeRoute />} />
          <Route path="/teacher" element={<Navigate to="/" replace />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminDashboard />
              </RequireAdmin>
            }
          />
          <Route
            path="/lessons"
            element={
              <RequireAuth>
                <LessonCreator />
              </RequireAuth>
            }
          />
          <Route
            path="/assignments"
            element={
              <RequireTeacher>
                <Assignments />
              </RequireTeacher>
            }
          />
          <Route
            path="/assignments/:lesson_plan_public_id/:lesson_id"
            element={
              <RequireTeacher>
                <Assignments />
              </RequireTeacher>
            }
          />
          <Route path="/quizzes/create" element={<Quizzes />} />
          <Route path="/quizzes/:examId" element={<Quizzes />} />
          <Route path="/quizzes" element={<Quizzes />} />
          <Route path="/curriculum" element={<ControlCurriculum />} />
          <Route path="/plans" element={<PlansManager />} />
          <Route path="/plans/:planId" element={<PlanViewerPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/stats" element={<Stats />} />
          <Route
            path="/teachers"
            element={
              <RequireAdmin>
                <TeachersManagement />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
