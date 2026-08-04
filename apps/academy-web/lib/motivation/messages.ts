import type { LucideIcon } from 'lucide-react';
import {
  Anchor,
  BookOpen,
  Brain,
  Compass,
  Flame,
  GraduationCap,
  Rocket,
  Sparkles,
  Target,
  Waves,
} from 'lucide-react';

export type MotivationMessage = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const MOTIVATION_MESSAGES: MotivationMessage[] = [
  {
    title: '🌊 جاهز تغوص في الدرس اللي بعده؟',
    description: 'كل دقيقة مذاكرة بتقربك من هدفك.',
    icon: Waves,
  },
  {
    title: '⚓ وجهتك التالية مستنياك.',
    description: 'كمّل من آخر درس وقرب خطوة من النجاح.',
    icon: Anchor,
  },
  {
    title: '📖 افتح الكتاب وكمل رحلتك.',
    description: 'المراجعة المستمرة هي سر التفوق.',
    icon: BookOpen,
  },
  {
    title: '🎯 هدفك واضح.',
    description: 'كل درس بتخلصه يقربك من الدرجة النهائية.',
    icon: Target,
  },
  {
    title: '🚀 انطلق من مكانك.',
    description: 'ابدأ الدرس التالي وسيب الباقي علينا.',
    icon: Rocket,
  },
  {
    title: '🌟 رحلة الإنجاز مستمرة.',
    description: 'أنت بتتطور مع كل خطوة.',
    icon: Sparkles,
  },
  {
    title: '💙 مستقبلك بيتبني دلوقتي.',
    description: 'استثمر وقتك في التعلم.',
    icon: Brain,
  },
  {
    title: '📚 الإنجليزي محتاج استمرارية.',
    description: 'حتى عشر دقائق في اليوم بتفرق.',
    icon: GraduationCap,
  },
  {
    title: '🔥 مستواك بيتحسن كل يوم.',
    description: 'حافظ على تقدمك ومتوقفش.',
    icon: Flame,
  },
  {
    title: '🧭 خليك على المسار الصحيح.',
    description: 'لسه قدامك إنجازات كتير.',
    icon: Compass,
  },
];
