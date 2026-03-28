import type { ComponentType } from 'react';
import {
  MdHome,
  MdMenuBook,
  MdQuiz,
  MdSchool,
  MdGroup,
  MdInsights,
  MdSettings,
} from 'react-icons/md';

export type SidebarLink = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
};

export const TEACHER_MAIN_LINKS: SidebarLink[] = [
  { to: '/', label: 'الرئيسية', icon: MdHome },
  { to: '/curriculum', label: 'إدارة المنهج', icon: MdSchool },
  { to: '/lessons', label: 'إنشاء خطة درس', icon: MdMenuBook },
  { to: '/quizzes/create', label: 'إنشاء اختبار', icon: MdQuiz },
  { to: '/plans', label: 'مكتبة الخطط', icon: MdMenuBook },
  { to: '/quizzes', label: 'مكتبة الاختبارات', icon: MdQuiz },
  { to: '/stats', label: 'التقارير والأداء', icon: MdInsights },
];

export const ADMIN_MAIN_LINKS: SidebarLink[] = [
  { to: '/admin', label: 'لوحة الإدارة', icon: MdHome },
  { to: '/teachers', label: 'المعلمون', icon: MdGroup },
  { to: '/curriculum', label: 'المنهج الدراسي', icon: MdSchool },
  { to: '/plans', label: 'الخطط المولدة', icon: MdMenuBook },
  { to: '/quizzes', label: 'الاختبارات', icon: MdQuiz },
];

export const TEACHER_SECONDARY_LINKS: SidebarLink[] = [];

export const ADMIN_SECONDARY_LINKS: SidebarLink[] = [
  { to: '/stats', label: 'الإحصائيات', icon: MdInsights },
  { to: '/settings', label: 'الإعدادات', icon: MdSettings },
];
