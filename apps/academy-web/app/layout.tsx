import type { Metadata, Viewport } from 'next';
import { Marhey, Tajawal } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import './mobile.css';
import { DataSaverProvider } from '@bahrawy/ui';
import { PwaManager } from '../components/PwaManager';

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
  metadataBase: new URL('https://el-bahrawy.com'),
  title: {
    default: 'أكاديمية مستر السيد البحراوي | منصة اللغة الإنجليزية',
    template: '%s | أكاديمية مستر السيد البحراوي',
  },
  description:
    'منصة مستر السيد البحراوي لتعلّم اللغة الإنجليزية لطلاب الثانوية والإعدادية في مصر، مع شروحات واختبارات ومتابعة للتقدم.',
  keywords: [
    'مستر السيد البحراوي',
    'أكاديمية البحراوي',
    'انجلش ثانوية عامة',
    'لغة إنجليزية',
    'امتحانات انجليزي أونلاين',
  ],
  authors: [{ name: 'مستر السيد البحراوي', url: 'https://el-bahrawy.com' }],
  creator: 'أكاديمية مستر السيد البحراوي',
  publisher: 'أكاديمية مستر السيد البحراوي',
  manifest: '/manifest.webmanifest',
  applicationName: 'أكاديمية السيد البحراوي',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  alternates: { canonical: 'https://el-bahrawy.com' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ar_EG',
    url: 'https://el-bahrawy.com',
    siteName: 'أكاديمية مستر السيد البحراوي',
    title: 'أكاديمية مستر السيد البحراوي | اللغة الإنجليزية',
    description: 'شرح وتدريب واختبارات لغة إنجليزية لطلاب الثانوية والإعدادية.',
  },
  twitter: {
    card: 'summary',
    title: 'أكاديمية مستر السيد البحراوي',
    description: 'شرح وتدريب واختبارات لغة إنجليزية لطلاب الثانوية والإعدادية.',
  },
  appleWebApp: {
    capable: true,
    title: 'أكاديمية البحراوي',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f8fc' },
    { media: '(prefers-color-scheme: dark)', color: '#06101e' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationalOrganization',
        '@id': 'https://el-bahrawy.com/#organization',
        name: 'أكاديمية مستر السيد البحراوي',
        url: 'https://el-bahrawy.com',
        logo: 'https://el-bahrawy.com/icon.svg',
        description: 'منصة تعليمية متخصصة في تدريس اللغة الإنجليزية لطلاب مصر.',
      },
      {
        '@type': 'WebSite',
        '@id': 'https://el-bahrawy.com/#website',
        url: 'https://el-bahrawy.com',
        name: 'أكاديمية مستر السيد البحراوي',
        publisher: { '@id': 'https://el-bahrawy.com/#organization' },
        inLanguage: 'ar-EG',
      },
    ],
  };

  return (
    <html
      lang="ar"
      dir="rtl"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${tajawal.variable} ${marhey.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>
        <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
          <DataSaverProvider>
            {children}
            <PwaManager />
          </DataSaverProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
