import { usePathname } from 'next/navigation';
import { BookOpen, Home, MessageCircleQuestion, UserRound } from 'lucide-react';

export function useStudentNavigation() {
  const pathname = usePathname() || '';
  return [
    {
      label: 'الرئيسية',
      href: '/student',
      isActive: pathname === '/student',
      icon: <Home className="size-5" />,
    },
    {
      label: 'كورساتي',
      href: '/student/courses',
      isActive: pathname.startsWith('/student/courses'),
      icon: <BookOpen className="size-5" />,
    },
    {
      label: 'قول سؤالك',
      href: '/student/questions',
      isActive: pathname.startsWith('/student/questions'),
      icon: <MessageCircleQuestion className="size-5" />,
    },
    {
      label: 'حسابي',
      href: '/student/profile',
      isActive: pathname === '/student/profile',
      icon: <UserRound className="size-5" />,
    },
  ];
}
