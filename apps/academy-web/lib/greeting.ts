export type GreetingSlot = {
  title: string;
  subtitle: string;
  icon: string;
};

export function getGreetingByTime(name = 'يا بطل'): GreetingSlot {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return {
      title: `☀️ صباح الخير، ${name}`,
      subtitle: 'جاهز تضيف إنجاز جديد النهارده؟',
      icon: '☀️',
    };
  }

  if (hour >= 12 && hour < 17) {
    return {
      title: `🌤 مساء الخير، ${name}`,
      subtitle: 'خلينا نكمّل من آخر نقطة وصلت لها.',
      icon: '🌤',
    };
  }

  if (hour >= 17 && hour < 21) {
    return {
      title: `🌅 مساء الخير، ${name}`,
      subtitle: 'وقت المذاكرة المثالي بدأ، يلا نكمل رحلتنا.',
      icon: '🌅',
    };
  }

  return {
    title: `🌙 مساء الخير، ${name}`,
    subtitle: 'لسه قدامك فرصة تنجز درس جديد قبل ما تنهي يومك.',
    icon: '🌙',
  };
}
