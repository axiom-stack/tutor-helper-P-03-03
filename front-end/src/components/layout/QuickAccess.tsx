import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_QUICK_ACCESS, TEACHER_QUICK_ACCESS } from './quick-access-config';
import './quick-access.css';

interface QuickAccessProps {
  variant?: 'compact' | 'full';
}

export function QuickAccess({ variant = 'full' }: QuickAccessProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const items = user.userRole === 'admin' ? ADMIN_QUICK_ACCESS : TEACHER_QUICK_ACCESS;

  return (
    <section className={`qa ${variant === 'compact' ? 'qa--compact' : ''}`} aria-label="الوصول السريع">
      <div className="qa__header">
        <h2 className="qa__title">الوصول السريع</h2>
        <p className="qa__subtitle">اختصارات ذكية للوصول لأهم المهام والأدوات</p>
      </div>
      <div className="qa__grid">
        {items.map(({ path, icon: Icon, title, description }) => (
          <button
            key={path}
            type="button"
            className="qa__card"
            onClick={() => navigate(path)}
            title={title}
          >
            <div className="qa__card-icon">
              <Icon aria-hidden />
            </div>
            <div className="qa__card-content">
              <h3 className="qa__card-title">{title}</h3>
              <p className="qa__card-desc">{description}</p>
            </div>
            <div className="qa__card-arrow" aria-hidden>
              ←
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
