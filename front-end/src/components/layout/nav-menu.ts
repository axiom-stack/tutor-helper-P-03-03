export type HeaderNavKey =
  | 'home'
  | 'curriculum'
  | 'lesson_library'
  | 'lesson_create'
  | 'exam_create'
  | 'assignments'
  | 'plan_library'
  | 'exam_library'
  | 'reports'
  | 'settings';

export interface HeaderNavItem {
  key: HeaderNavKey;
  label: string;
  path: string;
}

const TEACHER_HEADER_NAV_ITEMS: HeaderNavItem[] = [
  { key: 'home', label: 'الرئيسية', path: '/' },
  { key: 'curriculum', label: 'إدارة المنهج', path: '/curriculum' },
  {
    key: 'lesson_library',
    label: 'مكتبة الدروس',
    path: '/curriculum?tab=library',
  },
  { key: 'lesson_create', label: 'إنشاء خطة درس', path: '/lessons' },
  { key: 'exam_create', label: 'إنشاء اختبار', path: '/quizzes/create' },
  { key: 'plan_library', label: 'مكتبة الخطط', path: '/plans' },
  { key: 'exam_library', label: 'مكتبة الاختبارات', path: '/quizzes' },
  { key: 'reports', label: 'التقارير والأداء', path: '/stats' },
  { key: 'settings', label: 'الإعدادات', path: '/settings' },
];

function getCurrentHeaderKey(pathname: string): HeaderNavKey | null {
  const normalizedPath = pathname || '/';

  if (normalizedPath === '/' || normalizedPath === '/teacher') {
    return 'home';
  }
  if (normalizedPath === '/curriculum') return 'curriculum';
  if (normalizedPath === '/lessons') return 'lesson_create';
  if (normalizedPath === '/quizzes/create') return 'exam_create';
  if (normalizedPath === '/assignments' || normalizedPath.startsWith('/assignments/')) {
    return 'assignments';
  }
  if (normalizedPath === '/plans' || normalizedPath.startsWith('/plans/')) {
    return 'plan_library';
  }
  if (normalizedPath === '/quizzes') return 'exam_library';
  if (normalizedPath === '/stats') return 'reports';
  if (normalizedPath === '/settings') return 'settings';
  return null;
}

export function getHeaderNavItems(pathname: string): HeaderNavItem[] {
  void pathname;
  return TEACHER_HEADER_NAV_ITEMS;
}

export function getHeaderNavPathLabel(pathname: string): string | null {
  return getCurrentHeaderKey(pathname);
}
