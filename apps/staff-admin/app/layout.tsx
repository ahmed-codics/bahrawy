import type { Metadata } from 'next';
import { Alexandria, Inter, Noto_Sans_Arabic } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';
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
  title: {
    default: 'Bahrawy Academy Admin',
    template: '%s | Bahrawy Academy Admin',
  },
  description:
    'Staff portal for managing Bahrawy Academy content, students, and payments.',
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
          <Toaster
            position="bottom-center"
            toastOptions={{ duration: 4000, className: 'font-sans' }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
