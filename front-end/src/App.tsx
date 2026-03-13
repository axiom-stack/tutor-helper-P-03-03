import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { getDisplayLanguageFromCookie } from './utils/displayLanguage';
import Auth from './features/auth/Auth';
import LessonCreator from './features/lesson-creator/LessonCreator';
import Assignments from './features/assignments/Assignments';
import Quizzes from './features/quizzes/Quizzes';
import { AppLayout } from './components/layout';
import { StageProvider } from './context/StageContext';
import { RequireAdmin, RequireAuth, RequireTeacher } from './components/routing/RouteGuards';
import ControlDashboard from './features/control-dashboard/ControlDashboard';
import ControlCurriculum from './features/control-curriculum/ControlCurriculum';
import PlansManager from './features/plans-manager/PlansManager';
import Settings from './features/settings/Settings';
import TeachersManagement from './features/teachers-management/TeachersManagement';
import Stats from './features/stats/Stats';

function App() {
  useEffect(() => {
    const lang = getDisplayLanguageFromCookie();
    const dir = lang === 'en' ? 'ltr' : 'rtl';
    document.documentElement.dir = dir;
    document.documentElement.lang = lang === 'en' ? 'en' : 'ar';
    document.documentElement.style.setProperty('--app-dir', dir);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/authentication" element={<Auth />} />
        <Route
          element={
            <RequireAuth>
              <StageProvider>
                <AppLayout />
              </StageProvider>
            </RequireAuth>
          }
        >
          <Route path="/" element={<ControlDashboard />} />
          <Route path="/teacher" element={<Navigate to="/" replace />} />
          <Route path="/admin" element={<Navigate to="/" replace />} />
          <Route
            path="/lessons"
            element={
              <RequireTeacher>
                <LessonCreator />
              </RequireTeacher>
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
          <Route path="/quizzes" element={<Quizzes />} />
          <Route path="/curriculum" element={<ControlCurriculum />} />
          <Route path="/plans" element={<PlansManager />} />
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
