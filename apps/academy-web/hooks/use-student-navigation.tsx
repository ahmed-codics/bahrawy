import { usePathname } from 'next/navigation';
import { BookOpen, Home, ShoppingBag, UserRound } from 'lucide-react';

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
      label: 'الباقات',
      href: '/student/products',
      isActive:
        pathname.startsWith('/student/products') || pathname.startsWith('/student/checkout'),
      icon: <ShoppingBag className="size-5" />,
    },
    {
      label: 'حسابي',
      href: '/student/profile',
      isActive: pathname === '/student/profile',
      icon: <UserRound className="size-5" />,
    },
  ];
}
