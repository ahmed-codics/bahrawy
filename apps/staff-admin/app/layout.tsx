import type { Metadata } from 'next';
import { headers } from 'next/headers';
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
    default: 'منصة البحراوي - El-bahrawy English',
    template: '%s | منصة البحراوي - El-bahrawy English',
  },
  description:
    'لوحة إدارة منصة البحراوي - El-bahrawy English لإدارة المحتوى والطلاب والمدفوعات.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The proxy.ts generates a per-request nonce and forwards it via x-nonce.
  // Reading it here opts the app into dynamic rendering so Next.js can apply
  // the nonce to framework/inline scripts under the CSP.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang="ar"
      dir="rtl"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${tajawal.variable} ${marhey.variable}`}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          nonce={nonce}
        >
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
