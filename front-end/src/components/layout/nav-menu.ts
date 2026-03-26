export type HeaderNavKey =
  | 'home'
  | 'curriculum'
  | 'lesson_create'
  | 'exam_create'
  | 'plan_library'
  | 'exam_library'
  | 'reports';

export interface HeaderNavItem {
  key: HeaderNavKey;
  label: string;
  path: string;
}

const HEADER_NAV_ITEMS: HeaderNavItem[] = [
  { key: 'home', label: 'الرئيسية', path: '/' },
  { key: 'curriculum', label: 'إدارة المنهج', path: '/curriculum' },
  { key: 'lesson_create', label: 'إنشاء خطة درس', path: '/lessons' },
  { key: 'exam_create', label: 'إنشاء اختبار', path: '/quizzes/create' },
  { key: 'plan_library', label: 'مكتبة الخطط', path: '/plans' },
  { key: 'exam_library', label: 'مكتبة الاختبارات', path: '/quizzes' },
  { key: 'reports', label: 'التقارير والأداء', path: '/stats' },
];

function getCurrentHeaderKey(pathname: string): HeaderNavKey | null {
  const normalizedPath = pathname || '/';

  if (normalizedPath === '/' || normalizedPath === '/teacher') {
    return 'home';
  }
  if (normalizedPath === '/curriculum') return 'curriculum';
  if (normalizedPath === '/lessons') return 'lesson_create';
  if (normalizedPath === '/quizzes/create') return 'exam_create';
  if (normalizedPath === '/plans') return 'plan_library';
  if (normalizedPath === '/quizzes') return 'exam_library';
  if (normalizedPath === '/stats') return 'reports';
  return null;
}

export function getHeaderNavItems(pathname: string): HeaderNavItem[] {
  const currentKey = getCurrentHeaderKey(pathname);

  return HEADER_NAV_ITEMS.filter((item) => item.key === 'home' || item.key !== currentKey);
}

export function getHeaderNavPathLabel(pathname: string): string | null {
  return getCurrentHeaderKey(pathname);
}
