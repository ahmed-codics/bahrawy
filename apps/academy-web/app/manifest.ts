import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'منصة البحراوي - El-bahrawy English',
    short_name: 'منصة البحراوي',
    description: 'تعلم اللغة الإنجليزية وراجع تقدمك من أي جهاز.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f8fafc',
    theme_color: '#0a1526',
    lang: 'ar',
    dir: 'rtl',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
