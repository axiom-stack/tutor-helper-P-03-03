import { BrowserRouter, Route, Routes } from 'react-router';
import Auth from './features/auth/Auth';
import AdminDashboard from './features/admin-dashboard/AdminDashboard';
import TeacherDashboard from './features/teacher-dashboard/TeacherDashboard';
import TeacherCirriculumManager from './features/teacher-curriculum-manager/TeacherCirriculumManager';
import LessonCreator from './features/lesson-creator/LessonCreator';
import Assignments from './features/assignments/Assignments';
import { AppLayout } from './components/layout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/authentication" element={<Auth />} />
        <Route element={<AppLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/lessons" element={<LessonCreator />} />
          <Route path="/assignments" element={<Assignments />} />
          <Route
            path="/assignments/:lesson_plan_public_id/:lesson_id"
            element={<Assignments />}
          />
          <Route path="/curriculum" element={<TeacherCirriculumManager />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
