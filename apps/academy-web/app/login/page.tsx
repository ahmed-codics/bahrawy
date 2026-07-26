'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Phone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Input, ThemeSelector } from '@bahrawy/ui';
import { AcademyBrand } from '../../components/AcademyBrand';
import { fetchApi, fetchCsrfToken } from '../../lib/api';

function safeNextPath() {
  if (typeof window === 'undefined') return null;
  const next = new URLSearchParams(window.location.search).get('next');
  return next?.startsWith('/student/') && !next.startsWith('//') ? next : null;
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^01[0125][0-9]{8}$/.test(identifier)) {
      setError('اكتب رقم موبايل مصري صحيح، زي 01012345678.');
      return;
    }
    if (!password) {
      setError('اكتب كلمة المرور عشان نقدر ندخّلك لحسابك.');
      return;
    }

    setLoading(true);
    try {
      await fetchCsrfToken();
      const response = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone: identifier, password }),
      });
      await fetchCsrfToken();
      if (response?.mustChangePassword) return router.push('/change-password');
      if (response?.kind === 'STUDENT') return router.push(safeNextPath() || '/student');
      if (response?.kind === 'GUARDIAN') return router.push('/guardian');
      router.push('/');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message || 'مقدرناش نسجّل دخولك. راجع بياناتك وحاول تاني.'
          : 'مقدرناش نسجّل دخولك. راجع بياناتك وحاول تاني.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="academy-public-flow academy-login-page">
      <header className="academy-login-header">
        <Link href="/" aria-label="العودة إلى الصفحة الرئيسية">
          <AcademyBrand />
        </Link>
        <div>
          <span className="academy-theme-control">
            <ThemeSelector />
          </span>
          <Link href="/">
            <ArrowRight aria-hidden="true" />
            الرئيسية
          </Link>
        </div>
      </header>

      <div className="academy-login-layout">
        <section className="academy-login-story" aria-label="عن تجربة الأكاديمية">
          <span className="academy-eyebrow">
            <Sparkles aria-hidden="true" />
            رجّع تركيزك للدرس
          </span>
          <div className="academy-login-story-copy">
            <h2>كل دروسك وتقدّمك في مكان واحد.</h2>
            <p>سجّل دخولك وكمّل من آخر نقطة وقفت عندها، من أي جهاز.</p>
            <ul>
              <li>
                <CheckCircle2 aria-hidden="true" /> محتوى مرحلتك بس
              </li>
              <li>
                <CheckCircle2 aria-hidden="true" /> تقدّمك محفوظ
              </li>
              <li>
                <CheckCircle2 aria-hidden="true" /> وصول محمي لحسابك
              </li>
            </ul>
          </div>
          <div className="academy-login-art" aria-hidden="true">
            <span className="academy-login-art-ring" />
            <Image
              src="/images/elbahrawy-hero.webp"
              alt=""
              width={1024}
              height={1024}
              sizes="(max-width: 900px) 0px, 46vw"
              preload
            />
          </div>
        </section>

        <section className="academy-login-form-section">
          <div className="academy-login-form-wrap">
            <span className="academy-login-shield" aria-hidden="true">
              <ShieldCheck />
            </span>
            <span className="academy-login-kicker">أهلاً بيك تاني</span>
            <h1>سجّل دخولك</h1>
            <p>استخدم رقم الموبايل وكلمة المرور المسجلين على حسابك.</p>

            <form onSubmit={handleLogin} className="academy-login-form" noValidate>
              {error && (
                <div role="alert" className="academy-login-error">
                  <AlertCircle aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <Input
                label="رقم الموبايل"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="01012345678"
                value={identifier}
                onChange={(event) =>
                  setIdentifier(event.target.value.replace(/\D/g, '').slice(0, 11))
                }
                disabled={loading}
                required
                leadingIcon={<Phone className="size-4" />}
                directionMode="ltr"
                sizeMode="lg"
                containerClassName="academy-login-field"
                className="academy-login-input"
              />

              <div className="academy-login-password">
                <Input
                  label="كلمة المرور"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  required
                  leadingIcon={<LockKeyhole className="size-4" />}
                  directionMode="ltr"
                  sizeMode="lg"
                  containerClassName="academy-login-field"
                  className="academy-login-input pe-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>

              <button
                className="academy-login-submit"
                type="submit"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? <span className="academy-login-spinner" aria-hidden="true" /> : null}
                {loading ? 'جاري تسجيل الدخول…' : 'دخول لحسابي'}
              </button>
            </form>

            <p className="academy-login-register">
              لسه معندكش حساب؟ <Link href="/register">اعمل حساب جديد</Link>
            </p>
            <p className="academy-login-help">لو واجهتك مشكلة، تواصل مع إدارة الأكاديمية.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
