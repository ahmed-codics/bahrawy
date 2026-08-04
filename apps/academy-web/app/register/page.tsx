'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  ShieldCheck,
  UserRoundPlus,
} from 'lucide-react';
import { ThemeSelector } from '@bahrawy/ui';
import { AcademyBrand } from '../../components/AcademyBrand';
import { fetchApi, fetchCsrfToken } from '../../lib/api';

type Grade = { id: string; code: string; nameAr: string; status: string };
type FormData = {
  firstName: string;
  secondName: string;
  thirdName: string;
  lastName: string;
  phone: string;
  parentPhone: string;
  email: string;
  schoolName: string;
  gender: string;
  city: string;
  gradeId: string;
  password: string;
  confirmPassword: string;
};

const initialForm: FormData = {
  firstName: '',
  secondName: '',
  thirdName: '',
  lastName: '',
  phone: '',
  parentPhone: '',
  email: '',
  schoolName: '',
  gender: '',
  city: '',
  gradeId: '',
  password: '',
  confirmPassword: '',
};

const steps = ['بيانات الطالب', 'التواصل والأسرة', 'الدراسة والحساب'];
const phonePattern = /^01[0125][0-9]{8}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanGradeName(name: string) {
  return name.replace(/^\[DEV ONLY\]\s*/i, '');
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initialForm);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradesLoading, setGradesLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const stepLock = useRef(false);

  useEffect(() => {
    fetchApi('/catalog/grades')
      .then((response) => {
        const available = ((response?.data || []) as Grade[]).filter(
          (grade) => grade.status === 'ACTIVE',
        );
        setGrades(available);
      })
      .catch(() => setError('تعذر تحميل المراحل الدراسية. جرّب تحديث الصفحة.'))
      .finally(() => setGradesLoading(false));
  }, []);

  const checkPhoneAPI = async (phone: string): Promise<boolean> => {
    if (!phonePattern.test(phone)) return true;
    try {
      const res = await fetchApi('/auth/check-phone', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      return res?.available !== false;
    } catch {
      return true;
    }
  };

  const computePhoneErrors = (phone: string, parentPhone: string) => {
    const errors: Record<string, string> = {};
    const p = phone.trim();
    const f = parentPhone.trim();
    if (p && p === f) {
      errors.phone = 'رقم الهاتف مكرر';
      errors.parentPhone = 'رقم هاتف ولي الأمر مكرر';
    }
    return errors;
  };

  const phoneErrors = useMemo(
    () => computePhoneErrors(form.phone, form.parentPhone),
    [form.phone, form.parentPhone],
  );

  const hasPhoneConflict = Object.keys(phoneErrors).length > 0;

  const update = (field: keyof FormData, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError('');
  };

  const validateStep = () => {
    if (step === 0) {
      if (
        ![form.firstName, form.secondName, form.thirdName, form.lastName].every(
          (v) => v.trim().length >= 2,
        )
      ) {
        return 'اكتب الاسم الرباعي، وكل اسم يكون حرفين على الأقل.';
      }
      if (!form.gender) return 'اختر النوع.';
    }
    if (step === 1) {
      if (!phonePattern.test(form.phone)) return 'اكتب رقم هاتف مصري صحيح للطالب.';
      if (!phonePattern.test(form.parentPhone))
        return 'اكتب رقم هاتف ولي الأمر بشكل صحيح.';
      if (!emailPattern.test(form.email.trim()))
        return 'اكتب بريدًا إلكترونيًا صحيحًا، مثل example@email.com.';
      if (hasPhoneConflict) return 'أرقام الهواتف لا يمكن أن تكون متطابقة';
      if (form.city.trim().length < 2) return 'اكتب المدينة أو المحافظة.';
    }
    if (step === 2) {
      if (form.schoolName.trim().length < 2) return 'اكتب اسم المدرسة.';
      if (!form.gradeId) return 'اختر المرحلة الدراسية.';
      if (form.password.length < 8) return 'كلمة المرور لازم تكون 8 أحرف على الأقل.';
      if (form.password !== form.confirmPassword) return 'تأكيد كلمة المرور غير مطابق.';
    }
    return '';
  };

  const next = async () => {
    if (stepLock.current) return;
    const message = validateStep();
    if (message) return setError(message);
    if (step === 1) {
      stepLock.current = true;
      setError('جاري التحقق من رقم الهاتف...');
      const available = await checkPhoneAPI(form.phone);
      stepLock.current = false;
      if (!available) return setError('رقم الهاتف مسجل بالفعل');
    }
    setError('');
    setStep((current) => Math.min(current + 1, 2));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (stepLock.current || loading) return;
    const message = validateStep();
    if (message) return setError(message);
    stepLock.current = true;
    setLoading(true);
    setError('جاري التحقق من رقم الهاتف...');
    try {
      await fetchCsrfToken();
      const available = await checkPhoneAPI(form.phone);
      if (!available) {
        setError('رقم الهاتف مسجل بالفعل');
        return;
      }
      setError('');
      const { confirmPassword: _, ...rawPayload } = form;
      void _;
      const payload = {
        ...rawPayload,
        email: rawPayload.email.trim().toLowerCase(),
      };
      await fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      router.push('/student');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setError(
        message.includes('Cannot POST /auth/register')
          ? 'خدمة إنشاء الحساب غير مفعّلة حالياً. أعد تشغيل خادم الـ API ثم حاول مرة أخرى.'
          : message || 'تعذر إنشاء الحساب. حاول مرة أخرى.',
      );
    } finally {
      stepLock.current = false;
      setLoading(false);
    }
  };

  return (
    <main className="academy-public-flow academy-register-page">
      <header className="academy-register-header">
        <Link href="/" aria-label="العودة إلى الصفحة الرئيسية">
          <AcademyBrand />
        </Link>
        <div>
          <span className="academy-theme-control">
            <ThemeSelector />
          </span>
          <span>عندك حساب؟</span>
          <Link href="/login">سجّل الدخول</Link>
        </div>
      </header>

      <div className="academy-register-shell">
        <aside className="academy-register-aside">
          <span className="academy-register-icon">
            <UserRoundPlus />
          </span>
          <span className="academy-eyebrow">حسابك في دقائق</span>
          <h1>ابدأ رحلتك في English من مرحلتك.</h1>
          <p>أنشئ حساب الطالب مرة واحدة، وبعدها اختار الباقة المناسبة وابدأ المذاكرة فوراً.</p>
          <ol aria-label="خطوات إنشاء الحساب">
            {steps.map((label, index) => (
              <li
                key={label}
                className={index === step ? 'is-current' : index < step ? 'is-done' : ''}
              >
                <span>{index < step ? <Check aria-hidden="true" /> : index + 1}</span>
                <div>
                  <strong>{label}</strong>
                  <small>
                    {index === step ? 'الخطوة الحالية' : index < step ? 'تمت' : 'بعدها'}
                  </small>
                </div>
              </li>
            ))}
          </ol>
          <div className="academy-register-trust">
            <ShieldCheck aria-hidden="true" />
            <span>
              <strong>بياناتك محمية</strong>
              <small>أرقام الأسرة تظهر فقط للإدارة المصرح لها.</small>
            </span>
          </div>
        </aside>

        <section className="academy-register-content">
          <div className="academy-register-progress" aria-hidden="true">
            <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
          <div className="academy-register-heading">
            <span>
              الخطوة {step + 1} من {steps.length}
            </span>
            <h2>{steps[step]}</h2>
            <p>
              {step === 0
                ? 'اكتب اسم الطالب زي ما هو مسجل في المدرسة.'
                : step === 1
                  ? 'الأرقام دي بتساعد الإدارة تتواصل وقت الحاجة.'
                  : 'اختار مرحلتك واعمل كلمة مرور قوية لحسابك.'}
            </p>
          </div>

          {error && (
            <div className="academy-register-error" role="alert">
              <AlertCircle aria-hidden="true" />
              {error}
            </div>
          )}

          <form onSubmit={submit} className="academy-register-form" noValidate>
            {step === 0 && (
              <fieldset className="academy-register-grid">
                <legend className="sr-only">الاسم الرباعي والنوع</legend>
                <RegisterField
                  label="الاسم الأول"
                  value={form.firstName}
                  onChange={(v) => update('firstName', v)}
                  autoComplete="given-name"
                />
                <RegisterField
                  label="الاسم الثاني"
                  value={form.secondName}
                  onChange={(v) => update('secondName', v)}
                />
                <RegisterField
                  label="الاسم الثالث"
                  value={form.thirdName}
                  onChange={(v) => update('thirdName', v)}
                />
                <RegisterField
                  label="الاسم الأخير"
                  value={form.lastName}
                  onChange={(v) => update('lastName', v)}
                  autoComplete="family-name"
                />
                <label className="academy-register-field academy-register-field-wide">
                  <span>النوع</span>
                  <select
                    value={form.gender}
                    onChange={(e) => update('gender', e.target.value)}
                    required
                  >
                    <option value="">اختر النوع</option>
                    <option value="MALE">ذكر</option>
                    <option value="FEMALE">أنثى</option>
                  </select>
                </label>
              </fieldset>
            )}

            {step === 1 && (
              <fieldset className="academy-register-grid">
                <legend className="sr-only">بيانات التواصل والأسرة</legend>
                <RegisterField
                  label="رقم الهاتف"
                  value={form.phone}
                  onChange={(v) => update('phone', v.replace(/\D/g, '').slice(0, 11))}
                  error={phoneErrors.phone}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="01012345678"
                  direction="ltr"
                />
                <RegisterField
                  label="رقم هاتف ولي الأمر"
                  value={form.parentPhone}
                  onChange={(v) => update('parentPhone', v.replace(/\D/g, '').slice(0, 11))}
                  error={phoneErrors.parentPhone}
                  type="tel"
                  inputMode="tel"
                  placeholder="01012345678"
                  direction="ltr"
                />
                <RegisterField
                  label="البريد الإلكتروني"
                  value={form.email}
                  onChange={(v) =>
                    update('email', v.replace(/\s/g, '').slice(0, 254))
                  }
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="example@email.com"
                  direction="ltr"
                />
                <RegisterField
                  label="المدينة / المحافظة"
                  value={form.city}
                  onChange={(v) => update('city', v)}
                  autoComplete="address-level1"
                  placeholder="مثال: القاهرة"
                />
              </fieldset>
            )}

            {step === 2 && (
              <fieldset className="academy-register-grid">
                <legend className="sr-only">بيانات الدراسة والحساب</legend>
                <RegisterField
                  label="اسم المدرسة"
                  value={form.schoolName}
                  onChange={(v) => update('schoolName', v)}
                />
                <label className="academy-register-field academy-register-field-wide">
                  <span>المرحلة الدراسية</span>
                  <select
                    value={form.gradeId}
                    onChange={(e) => update('gradeId', e.target.value)}
                    disabled={gradesLoading}
                    required
                  >
                    <option value="">
                      {gradesLoading ? 'جاري تحميل المراحل…' : 'اختر مرحلتك'}
                    </option>
                    {grades.map((grade) => (
                      <option key={grade.id} value={grade.id}>
                        {cleanGradeName(grade.nameAr)}
                      </option>
                    ))}
                  </select>
                </label>
                <PasswordField
                  id="register-password"
                  label="كلمة المرور"
                  value={form.password}
                  onChange={(value) => update('password', value)}
                  visible={showPassword}
                  onToggle={() => setShowPassword((value) => !value)}
                  hint="8 أحرف على الأقل"
                />
                <PasswordField
                  id="register-confirm-password"
                  label="تأكيد كلمة المرور"
                  value={form.confirmPassword}
                  onChange={(value) => update('confirmPassword', value)}
                  visible={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword((value) => !value)}
                />
              </fieldset>
            )}

            <div className="academy-register-actions">
              {step > 0 ? (
                <button
                  type="button"
                  className="academy-register-back"
                  onClick={() => {
                    setError('');
                    setStep((v) => v - 1);
                  }}
                >
                  <ArrowRight aria-hidden="true" />
                  السابق
                </button>
              ) : (
                <span />
              )}
              {step < 2 ? (
                <button
                  type="button"
                  className="academy-register-next"
                  onClick={next}
                  disabled={step === 1 && hasPhoneConflict}
                >
                  التالي
                  <ArrowLeft aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="academy-register-next"
                  disabled={loading || gradesLoading}
                >
                  {loading ? 'جاري إنشاء الحساب…' : 'إنشاء الحساب والبدء'}
                  <GraduationCap aria-hidden="true" />
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function RegisterField({
  label,
  value,
  onChange,
  error,
  type = 'text',
  inputMode,
  autoComplete,
  placeholder,
  direction,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  placeholder?: string;
  direction?: 'ltr' | 'rtl';
}) {
  return (
    <label className="academy-register-field">
      <span>{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        dir={direction}
        required
      />
      {error && <small className="academy-field-error">{error}</small>}
    </label>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggle,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  hint?: string;
}) {
  return (
    <div className="academy-register-field">
      <label htmlFor={id}>{label}</label>
      <span className="academy-register-password">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          required
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? `إخفاء ${label}` : `إظهار ${label}`}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </span>
      {hint ? <small>{hint}</small> : <small aria-hidden="true">&nbsp;</small>}
    </div>
  );
}
