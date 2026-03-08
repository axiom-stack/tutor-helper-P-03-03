import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';

type Props = {};

function TeacherDashboard({}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (user?.userRole !== 'teacher') {
    navigate('/authentication');
  }
  return <div>TeacherDashboard</div>;
}

export default TeacherDashboard;
