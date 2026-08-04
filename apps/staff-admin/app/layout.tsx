import type { Metadata } from 'next';
import { Marhey, Tajawal } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const tajawal = Tajawal({
  weight: ['200', '300', '400', '500', '700', '800', '900'],
  subsets: ['arabic', 'latin'],
  variable: '--font-tajawal',
  display: 'swap',
});

const marhey = Marhey({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['arabic'],
  variable: '--font-marhey',
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
    <html
      lang="ar"
      dir="rtl"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${tajawal.variable} ${marhey.variable}`}
    >
      <body>
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
