import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';

function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.userRole !== 'admin') {
      navigate('/authentication');
    }
  }, [navigate, user?.userRole]);

  return <div>AdminDashboard</div>;
}

export default AdminDashboard;
