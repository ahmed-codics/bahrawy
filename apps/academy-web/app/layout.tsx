import type { Metadata } from 'next';
import { Alexandria, Inter, Noto_Sans_Arabic } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';

const alexandria = Alexandria({
  weight: 'variable',
  subsets: ['arabic', 'latin'],
  variable: '--font-alexandria',
  display: 'swap',
});

const notoArabic = Noto_Sans_Arabic({
  weight: 'variable',
  subsets: ['arabic', 'latin'],
  variable: '--font-noto-arabic',
  display: 'swap',
});

const inter = Inter({
  weight: 'variable',
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'أكاديمية البحراوي', template: '%s | أكاديمية البحراوي' },
  description:
    'منصة مستر البحراوي لتعلّم وإتقان اللغة الإنجليزية لطلاب الثانوية العامة.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${alexandria.variable} ${notoArabic.variable} ${inter.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
