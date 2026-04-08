import type { ComponentType } from 'react';
import {
  MdHome,
  MdMenuBook,
  MdQuiz,
  MdSchool,
  MdGroup,
  MdInsights,
  MdSettings,
  MdCollectionsBookmark,
} from 'react-icons/md';

export type SidebarLink = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  /** When set, overrides NavLink default active state (e.g. curriculum vs ?tab=library). */
  isActiveMatch?: (loc: { pathname: string; search: string }) => boolean;
};

export const TEACHER_MAIN_LINKS: SidebarLink[] = [
  { to: '/', label: 'الرئيسية', icon: MdHome },
  {
    to: '/curriculum?tab=structure',
    label: 'إدارة المنهج',
    icon: MdSchool,
    isActiveMatch: ({ pathname, search }) =>
      pathname === '/curriculum' &&
      new URLSearchParams(search).get('tab') === 'structure',
  },
  { to: '/lessons', label: 'إنشاء خطة درس', icon: MdMenuBook },
  { to: '/quizzes/create', label: 'إنشاء اختبار', icon: MdQuiz },
  {
    to: '/curriculum?tab=library',
    label: 'مكتبة الدروس',
    icon: MdCollectionsBookmark,
    isActiveMatch: ({ pathname, search }) =>
      pathname === '/curriculum' &&
      new URLSearchParams(search).get('tab') === 'library',
  },
  { to: '/plans', label: 'مكتبة الخطط', icon: MdMenuBook },
  { to: '/quizzes', label: 'مكتبة الاختبارات', icon: MdQuiz },
  { to: '/stats', label: 'التقارير والأداء', icon: MdInsights },
];

export const ADMIN_MAIN_LINKS: SidebarLink[] = [
  { to: '/admin', label: 'لوحة الإدارة', icon: MdHome },
  { to: '/teachers', label: 'المعلمون', icon: MdGroup },
  {
    to: '/curriculum?tab=structure',
    label: 'المنهج الدراسي',
    icon: MdSchool,
    isActiveMatch: ({ pathname, search }) =>
      pathname === '/curriculum' &&
      new URLSearchParams(search).get('tab') === 'structure',
  },
  {
    to: '/curriculum?tab=library',
    label: 'مكتبة الدروس',
    icon: MdCollectionsBookmark,
    isActiveMatch: ({ pathname, search }) =>
      pathname === '/curriculum' &&
      new URLSearchParams(search).get('tab') === 'library',
  },
  { to: '/plans', label: 'مكتبة الخطط', icon: MdMenuBook },
  { to: '/quizzes', label: 'الاختبارات', icon: MdQuiz },
];

export const TEACHER_SECONDARY_LINKS: SidebarLink[] = [];

export const ADMIN_SECONDARY_LINKS: SidebarLink[] = [
  { to: '/stats', label: 'الإحصائيات', icon: MdInsights },
  { to: '/settings', label: 'الإعدادات', icon: MdSettings },
];
