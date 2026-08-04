'use client';

import type { SVGProps } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpLeft } from 'lucide-react';

type Platform = {
  name: string;
  description: string;
  href: string;
  icon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
  iconLabel: string;
  brandColor: string;
  glow: string;
};

const FB_BLUE = '#1877F2';
const YT_RED = '#FF0000';
const TT_CYAN = '#25F4EE';
const TT_PINK = '#FE2C55';

const PLATFORMS: Platform[] = [
  {
    name: 'Facebook',
    description: 'تابع آخر الأخبار والمنشورات اليومية.',
    href: 'https://www.facebook.com/share/1BT3CAL2iT/',
    icon: FacebookIcon,
    iconLabel: 'فيسبوك',
    brandColor: FB_BLUE,
    glow: `radial-gradient(circle at 50% 50%, ${FB_BLUE}, transparent 70%)`,
  },
  {
    name: 'YouTube',
    description: 'شاهد جميع الحصص والشروحات والمراجعات.',
    href: 'https://youtube.com/@el_bahrawy1?si=4BQ_nvvW7iN_UXN2',
    icon: YouTubeIcon,
    iconLabel: 'يوتيوب',
    brandColor: YT_RED,
    glow: `radial-gradient(circle at 50% 50%, ${YT_RED}, transparent 70%)`,
  },
  {
    name: 'TikTok',
    description: 'مقاطع قصيرة ونصائح سريعة في اللغة الإنجليزية.',
    href: 'https://www.tiktok.com/@el_bahrawy_3?_r=1&_t=ZS-98Zhg400QwW',
    icon: TikTokIcon,
    iconLabel: 'تيك توك',
    brandColor: TT_CYAN,
    glow: `radial-gradient(circle at 50% 50%, ${TT_CYAN} 0%, ${TT_PINK} 55%, rgba(0, 0, 0, 0.9) 120%)`,
  },
];

function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill={FB_BLUE} aria-hidden="true" {...props}>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H5.9v-2.9h4.54V9.85c0-4.49 2.67-6.97 6.77-6.97 1.96 0 4.01.35 4.01.35v4.4h-2.26c-2.22 0-2.92 1.38-2.92 2.8v2.35h4.97l-.79 2.9h-4.18V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

function YouTubeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z"
        fill={YT_RED}
      />
    </svg>
  );
}

function TikTokIcon(props: SVGProps<SVGSVGElement>) {
  const gradientId = 'tiktok-brand-gradient';
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z" fill="#000000" />
      <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z" fill={`url(#${gradientId})`} />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={TT_CYAN} />
          <stop offset="100%" stopColor={TT_PINK} />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function FollowUs() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="academy-footer-social-col">
      <strong>منصات التواصل</strong>
      {PLATFORMS.map((platform) => {
        const Icon = platform.icon;
        return (
          <motion.a
            key={platform.name}
            className="academy-social-card"
            href={platform.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${platform.name} — ${platform.iconLabel}`}
            initial={false}
            whileHover={
              reducedMotion
                ? undefined
                : {
                    y: -6,
                    scale: 1.03,
                    borderColor: platform.brandColor,
                    boxShadow: `0 22px 46px rgb(9 35 63 / 0.14)`,
                    transition: { type: 'spring', stiffness: 260, damping: 20 },
                  }
            }
            whileTap={
              reducedMotion
                ? undefined
                : { scale: 0.96, transition: { type: 'spring', stiffness: 500, damping: 18 } }
            }
          >
            <span className="academy-social-card-glow" style={{ background: platform.glow }} aria-hidden="true" />
            <span className="academy-social-card-icon">
              <Icon className="academy-social-card-icon-svg" />
            </span>
            <span className="academy-social-card-body">
              <strong>{platform.name}</strong>
              <span>{platform.description}</span>
            </span>
            <span className="academy-social-card-arrow" aria-hidden="true">
              <ArrowUpLeft />
            </span>
            <span className="academy-social-card-sweep" aria-hidden="true" />
          </motion.a>
        );
      })}
    </div>
  );
}
