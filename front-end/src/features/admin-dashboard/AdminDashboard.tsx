import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';

type Props = {};

function AdminDashboard({}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (user?.userRole !== 'admin') {
    navigate('/authentication');
  }
  return <div>AdminDashboard</div>;
}

export default AdminDashboard;
