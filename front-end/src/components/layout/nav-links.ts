import type { ComponentType } from 'react';
import {
  MdHome,
  MdMenuBook,
  MdAssignment,
  MdQuiz,
  MdSchool,
  MdSettings,
  MdGroup,
  MdInsights,
} from 'react-icons/md';

export type SidebarLink = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
};

export const TEACHER_MAIN_LINKS: SidebarLink[] = [
  { to: '/', label: 'الرئيسية', icon: MdHome },
  { to: '/lessons', label: 'إنشاء الخطط', icon: MdMenuBook },
  { to: '/plans', label: 'الخطط المولدة', icon: MdMenuBook },
  { to: '/assignments', label: 'الواجبات', icon: MdAssignment },
  { to: '/quizzes', label: 'الاختبارات', icon: MdQuiz },
  { to: '/curriculum', label: 'المنهج الدراسي', icon: MdSchool },
  { to: '/settings', label: 'الإعدادات', icon: MdSettings },
];

export const ADMIN_MAIN_LINKS: SidebarLink[] = [
  { to: '/', label: 'الرئيسية', icon: MdHome },
  { to: '/plans', label: 'الخطط المولدة', icon: MdMenuBook },
  { to: '/quizzes', label: 'الاختبارات', icon: MdQuiz },
  { to: '/curriculum', label: 'المنهج الدراسي', icon: MdSchool },
  { to: '/settings', label: 'الإعدادات', icon: MdSettings },
];

export const TEACHER_SECONDARY_LINKS: SidebarLink[] = [
  { to: '/stats', label: 'الإحصائيات', icon: MdInsights },
];

export const ADMIN_SECONDARY_LINKS: SidebarLink[] = [
  { to: '/teachers', label: 'المعلمون', icon: MdGroup },
  { to: '/stats', label: 'الإحصائيات', icon: MdInsights },
];
