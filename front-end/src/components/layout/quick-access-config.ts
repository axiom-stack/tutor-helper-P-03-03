import type { ComponentType } from 'react';
import {
  MdMenuBook,
  MdAssignment,
  MdQuiz,
  MdSchool,
  MdPeople,
  MdInsights,
  MdSettings,
  MdCollectionsBookmark,
} from 'react-icons/md';

export interface QuickAccessItem {
  path: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  description: string;
}

export const TEACHER_QUICK_ACCESS: QuickAccessItem[] = [
  {
    path: '/lessons',
    icon: MdMenuBook,
    title: 'إنشاء خطة درس',
    description: 'صمم خطة درس ذكية متكاملة الأركان بمساعدة الذكاء الاصطناعي بناءً على محتوى دروسك.',
  },
  {
    path: '/plans',
    icon: MdMenuBook,
    title: 'الخطط المولدة',
    description: 'استعرض وأدر جميع خطط الدروس التي قمت بإنشائها، مع إمكانية التعديل والتصدير والطباعة.',
  },
  {
    path: '/assignments',
    icon: MdAssignment,
    title: 'إدارة الواجبات',
    description: 'أنشئ واجبات منزلية مخصصة للطلاب وشاركها عبر واتساب أو قم بتصديرها كملفات جاهزة.',
  },
  {
    path: '/quizzes',
    icon: MdQuiz,
    title: 'الاختبارات الذكية',
    description: 'ولد اختبارات موزونة بجدول مواصفات آلي يغطي أهداف التعلم لدروس مختارة بدقة.',
  },
  {
    path: '/curriculum',
    icon: MdSchool,
    title: 'المنهج الدراسي',
    description: 'نظم هيكل دروسك، موادك، ووحداتك التعليمية لسهولة الوصول إليها في عمليات التوليد.',
  },
  {
    path: '/curriculum?tab=library',
    icon: MdCollectionsBookmark,
    title: 'مكتبة الدروس',
    description:
      'استعرض جميع دروسك مع البحث والفلترة بالصف أو المادة أو الفصل، ثم راجعها أو عدّلها أو احذفها.',
  },
  {
    path: '/stats',
    icon: MdInsights,
    title: 'التقارير والأداء',
    description: 'حلل نشاطك التعليمي وتتبع جودة المخرجات المولدة عبر لوحة بيانات إحصائية شاملة.',
  },
];

export const ADMIN_QUICK_ACCESS: QuickAccessItem[] = [
  {
    path: '/teachers',
    icon: MdPeople,
    title: 'إدارة المعلمين',
    description: 'أضف حسابات المعلمين الجدد، تابع نشاطهم، وأدر ملفاتهم الشخصية وإعداداتهم التعليمية.',
  },
  {
    path: '/plans',
    icon: MdMenuBook,
    title: 'أرشيف الخطط',
    description: 'نظرة شاملة على جميع خطط الدروس المولدة في النظام مع إمكانية المراجعة والتحليل.',
  },
  {
    path: '/quizzes',
    icon: MdQuiz,
    title: 'سجل الاختبارات',
    description: 'استعرض الاختبارات التي تم توليدها من قبل المعلمين وتابع توزيع مستويات الصعوبة.',
  },
  {
    path: '/curriculum',
    icon: MdSchool,
    title: 'استعراض المنهج',
    description: 'استعرض الهيكل التعليمي لجميع المواد والصفوف المسجلة في النظام لمختلف المعلمين.',
  },
  {
    path: '/stats',
    icon: MdInsights,
    title: 'إحصائيات النظام',
    description: 'راقب أداء النظام الكلي، معدلات التوليد، ومؤشرات الجودة لضمان أفضل تجربة تعليمية.',
  },
  {
    path: '/settings',
    icon: MdSettings,
    title: 'إعدادات النظام',
    description: 'تخصيص الخيارات العامة للنظام، لغات العرض، والتفضيلات الإدارية الأساسية.',
  },
];
