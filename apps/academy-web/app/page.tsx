import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  CirclePlay,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  NotebookPen,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { ThemeSelector } from '@bahrawy/ui';
import { AcademyBrand } from '../components/AcademyBrand';

export const metadata: Metadata = {
  title: 'أكاديمية السيد البحراوي | English للإعدادي والثانوي',
  description:
    'شرح ومراجعة وتدريب على منهج اللغة الإنجليزية المصري للصف الثالث الإعدادي والصفوف الأول والثاني والثالث الثانوي.',
};

export type LandingGradeSummary = {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  sort: number;
  status: string;
};

type LandingGrade = LandingGradeSummary & {
  fallback: boolean;
};

const fallbackGrades: LandingGrade[] = [
  {
    id: '',
    code: 'g3-prep',
    nameAr: 'الصف الثالث الإعدادي',
    nameEn: 'Third Preparatory',
    sort: 1,
    status: 'ACTIVE',
    fallback: true,
  },
  {
    id: '',
    code: 'g1-sec',
    nameAr: 'الصف الأول الثانوي',
    nameEn: 'First Secondary',
    sort: 2,
    status: 'ACTIVE',
    fallback: true,
  },
  {
    id: '',
    code: 'g2-sec',
    nameAr: 'الصف الثاني الثانوي',
    nameEn: 'Second Secondary',
    sort: 3,
    status: 'ACTIVE',
    fallback: true,
  },
  {
    id: '',
    code: 'g3-sec',
    nameAr: 'الصف الثالث الثانوي',
    nameEn: 'Third Secondary',
    sort: 4,
    status: 'ACTIVE',
    fallback: true,
  },
];

async function getGrades(): Promise<{ grades: LandingGrade[]; usingFallback: boolean }> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/catalog/grades`,
      { next: { revalidate: 60 } },
    );
    if (!response.ok) throw new Error('Grades are unavailable');

    const payload = await response.json();
    const available = ((payload.data || []) as LandingGradeSummary[]).filter(
      (grade) => grade.status === 'ACTIVE',
    );
    const byCode = new Map(available.map((grade) => [grade.code, grade]));
    const grades = fallbackGrades.map((fallback) => {
      const match = byCode.get(fallback.code);
      return match
        ? {
            ...fallback,
            id: match.id,
            status: match.status,
            fallback: false,
          }
        : fallback;
    });

    return { grades, usingFallback: grades.some((grade) => grade.fallback) };
  } catch {
    return { grades: fallbackGrades, usingFallback: true };
  }
}

const learningSteps = [
  {
    icon: CirclePlay,
    number: '01',
    title: 'اتفرّج',
    body: 'شرح واضح ومركّز تقدر توقفه وترجعله في الوقت اللي يناسبك.',
  },
  {
    icon: BrainCircuit,
    number: '02',
    title: 'افهم',
    body: 'Grammar وVocabulary متقسمين لأفكار صغيرة مرتبطة بالمنهج.',
  },
  {
    icon: NotebookPen,
    number: '03',
    title: 'طبّق',
    body: 'حل بعد كل جزء عشان تتأكد إن المعلومة ثبتت مش مجرد سمعتها.',
  },
  {
    icon: TrendingUp,
    number: '04',
    title: 'راجع تقدّمك',
    body: 'نتيجتك ومحاولاتك محفوظين عشان تعرف إيه اللي محتاج مراجعة.',
  },
];

const platformBenefits = [
  {
    icon: Play,
    title: 'فيديوهات منظمة',
    body: 'كل درس له هدف واضح وترتيب يخليك تمشي خطوة بخطوة.',
    tone: 'cyan',
  },
  {
    icon: FileText,
    title: 'مذكرات وملفات PDF',
    body: 'ملخصات وأوراق تدريب تفتحها وقت المراجعة أو قبل الامتحان.',
    tone: 'amber',
  },
  {
    icon: ClipboardCheck,
    title: 'اختبارات بعد الدروس',
    body: 'تطبيق مباشر ونتيجة واضحة بدل ما تسيب الفهم للصدفة.',
    tone: 'navy',
  },
  {
    icon: LayoutDashboard,
    title: 'تقدّم محفوظ',
    body: 'ارجع من نفس المكان وشوف الدروس والاختبارات الخاصة بمرحلتك.',
    tone: 'mint',
  },
];

const faqs = [
  {
    question: 'أختار المرحلة بتاعتي إزاي؟',
    answer:
      'اختار صفك من كروت المراحل الموجودة في الصفحة. هتروح مباشرة للكورسات والباقات المتاحة للصف ده.',
  },
  {
    question: 'أقدر أشوف الدروس من الموبايل؟',
    answer:
      'أيوه، الأكاديمية معمولة عشان تشتغل بشكل مريح على الموبايل والتابلت والكمبيوتر من المتصفح.',
  },
  {
    question: 'ينفع أرجع للشرح تاني؟',
    answer:
      'طول ما اشتراكك في المحتوى فعّال، تقدر ترجع للدروس المتاحة لك وتراجعها حسب نظام الباقة.',
  },
  {
    question: 'إزاي أعرف تفاصيل الاشتراك؟',
    answer:
      'بعد اختيار المرحلة هتشوف المحتوى المتاح وتفاصيل كل باقة وسعرها قبل تسجيل الدخول وإتمام الاشتراك.',
  },
];

function SectionHeading({
  eyebrow,
  title,
  body,
  align = 'center',
}: {
  eyebrow: string;
  title: string;
  body?: string;
  align?: 'center' | 'start';
}) {
  return (
    <div
      className={
        align === 'center' ? 'academy-section-heading' : 'academy-section-heading is-start'
      }
    >
      <span className="academy-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
    </div>
  );
}

export default async function Home() {
  const { grades, usingFallback } = await getGrades();

  return (
    <div className="academy-landing">
      <a href="#main-content" className="academy-skip-link">
        تخطّي للمحتوى الرئيسي
      </a>

      <header className="academy-header">
        <nav className="academy-container academy-nav" aria-label="التنقل الرئيسي">
          <Link href="/" aria-label="الصفحة الرئيسية لأكاديمية السيد البحراوي">
            <AcademyBrand />
          </Link>

          <div className="academy-desktop-links">
            <a href="#levels">المراحل</a>
            <a href="#teacher">هتتعلم إزاي؟</a>
            <a href="#learning-path">عن مستر البحراوي</a>
          </div>

          <div className="academy-nav-actions">
            <ThemeSelector />
            <Link className="academy-login-link" href="/login">
              تسجيل الدخول
            </Link>
            <a className="academy-button academy-button-sm" href="#levels">
              اختار مرحلتك
              <ArrowLeft aria-hidden="true" />
            </a>
          </div>

          <details className="academy-mobile-menu">
            <summary aria-label="فتح قائمة التنقل">
              <Menu aria-hidden="true" />
            </summary>
            <div className="academy-mobile-menu-panel">
              <a href="#levels">المراحل</a>
              <a href="#teacher">هتتعلم إزاي؟</a>
              <a href="#learning-path">عن مستر البحراوي</a>
              <Link href="/login">تسجيل الدخول</Link>
              <a className="academy-button" href="#levels">
                اختار مرحلتك
                <ArrowLeft aria-hidden="true" />
              </a>
            </div>
          </details>
        </nav>
      </header>

      <main id="main-content">
        <section className="academy-hero">
          <div className="academy-container academy-hero-grid">
            <div className="academy-hero-copy">
              <span className="academy-eyebrow">
                <Sparkles aria-hidden="true" />
                English على المنهج المصري
              </span>
              <h1>
                <span className="academy-hero-line">منصة</span>
                <span className="academy-hero-line academy-hero-line-emphasis">البحراوي</span>
                <span className="academy-hero-line academy-hero-line-sub" dir="ltr">English</span>
              </h1>
              <p className="academy-hero-lead">
                شرح واضح، تدريب بعد كل فكرة، ومراجعة تعرفك مستواك مع مستر السيد البحراوي.
              </p>
              <div className="academy-hero-actions">
                <a className="academy-button academy-button-lg" href="#levels">
                  اختار مرحلتك
                  <ArrowLeft aria-hidden="true" />
                </a>
                <Link
                  className="academy-button academy-button-lg academy-button-secondary"
                  href="/login"
                >
                  أنا طالب بالفعل
                </Link>
              </div>
              <ul className="academy-hero-points" aria-label="مميزات الأكاديمية">
                <li>
                  <CheckCircle2 aria-hidden="true" />
                  على المنهج المصري
                </li>
                <li>
                  <CheckCircle2 aria-hidden="true" />
                  شرح وتدريب ومراجعة
                </li>
                <li>
                  <CheckCircle2 aria-hidden="true" />
                  مناسب للموبايل
                </li>
              </ul>
            </div>
            <div className="academy-hero-image-col">
              <img
                src="/images/elbahrawy-hero.png"
                alt="مستر السيد البحراوي"
                className="academy-hero-image"
              />
              <div className="academy-hero-tags">
                <span>Grammar</span>
                <span>Vocabulary</span>
                <span>Practice</span>
              </div>
            </div>
          </div>
        </section>

        <section id="levels" className="academy-section academy-levels">
          <div className="academy-container">
            <SectionHeading
              eyebrow="ابدأ من مكانك"
              title="اختار مرحلتك وخليك في المسار الصح"
              body="كل مرحلة ليها محتواها وترتيبها. اختار صفك وهتظهر لك الكورسات والباقات المناسبة."
            />

            {usingFallback && (
              <p className="academy-grade-notice" role="status">
                بنحدّث قائمة الكورسات دلوقتي. تقدر تختار مرحلتك وتستعرض كل المتاح.
              </p>
            )}

            <div className="academy-grade-grid">
              {grades.map((grade, index) => (
                <div key={grade.code} className="academy-grade-wrapper">
                  <div className="academy-grade-name-box">
                    {grade.nameAr}
                  </div>
                  <Link
                    href={grade.id ? `/courses?gradeId=${encodeURIComponent(grade.id)}` : '/courses'}
                    className={`academy-grade-card${grade.code === 'g3-prep' ? ' academy-grade-card--bg' : ''}${grade.code === 'g1-sec' ? ' academy-grade-card--bg1' : ''}${grade.code === 'g2-sec' ? ' academy-grade-card--bg2' : ''}${grade.code === 'g3-sec' ? ' academy-grade-card--bg3' : ''}`}
                  >
                    <span className="academy-grade-number" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="academy-grade-spacer" />
                    <span className="academy-grade-action">
                      شوف محتوى المرحلة
                      <ArrowLeft aria-hidden="true" />
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="learning-path" className="academy-section academy-learning-section">
          <div className="academy-container academy-teacher-card">
            <div className="academy-teacher-visual" aria-hidden="true">
              <img
                src="/images/teacher-bg.png"
                alt=""
                className="size-full object-cover"
              />
            </div>
            <div className="academy-teacher-copy">
              <span className="academy-eyebrow">من الحصة للمنصة</span>
              <h2>نفس شرح مستر البحراوي، بس متاح لك وقت ما تحتاجه.</h2>
              <p>
                الأكاديمية معمولة عشان تنقل طريقة الشرح والتدريب من الحصة لتجربة أونلاين منظمة. تشوف
                الدرس، تراجع النقطة اللي وقفت معاك، وتحل لحد ما المعلومة تثبت.
              </p>
              <div className="academy-teacher-values">
                <span>
                  <MessagesSquare aria-hidden="true" />
                  شرح قريب من الطالب
                </span>
                <span>
                  <Target aria-hidden="true" />
                  تركيز على المنهج
                </span>
                <span>
                  <RotateCcw aria-hidden="true" />
                  مراجعة وقت ما تحتاج
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="academy-section academy-benefits-section">
          <div className="academy-container academy-benefits-layout">
            <SectionHeading
              eyebrow="كل أدواتك في مكان واحد"
              title="من أول الشرح لحد آخر مراجعة"
              body="الأكاديمية بتجمع الحصة، المذكرة، التدريب، والمتابعة في تجربة واحدة بسيطة."
              align="start"
            />
            <div className="academy-benefits-grid">
              {platformBenefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <article className="academy-benefit-card" key={benefit.title}>
                    <span className={`academy-benefit-icon is-${benefit.tone}`}>
                      <Icon aria-hidden="true" />
                    </span>
                    <div>
                      <h3>{benefit.title}</h3>
                      <p>{benefit.body}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="teacher" className="academy-section academy-teacher-section">
          <div className="academy-container">
            <SectionHeading
              eyebrow="نظام مذاكرة واضح"
              title="هتتعلم إزاي؟"
              body="مش هنسيبك قدام فيديو وخلاص. كل خطوة بتجهّزك للي بعدها."
            />
            <div className="academy-learning-grid">
              {learningSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <article className="academy-learning-card" key={step.number}>
                    <span className="academy-learning-number" aria-hidden="true">
                      {step.number}
                    </span>
                    <span className="academy-learning-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                    {index < learningSteps.length - 1 && (
                      <ArrowLeft className="academy-learning-arrow" aria-hidden="true" />
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="academy-section academy-faq-section">
          <div className="academy-container academy-faq-layout">
            <SectionHeading
              eyebrow="قبل ما تبدأ"
              title="أسئلة ممكن تكون في بالك"
              body="إجابات سريعة تساعدك تختار وتبدأ من غير لخبطة."
              align="start"
            />
            <div className="academy-faq-list">
              {faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>
                    {faq.question}
                    <ChevronDown aria-hidden="true" />
                  </summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="academy-final-section">
          <div className="academy-container academy-final-card">
            <div className="academy-final-decoration" aria-hidden="true">
              <GraduationCap />
            </div>
            <span className="academy-final-kicker">جاهز تبدأ؟</span>
            <h2>اختار مرحلتك وخلي الإنجليزي نقطة قوة.</h2>
            <p>ابدأ بالمحتوى المناسب لصفك، وشوف تفاصيل الباقات المتاحة بوضوح قبل الاشتراك.</p>
            <a className="academy-button academy-button-lg" style={{borderColor: 'var(--academy-cyan)', background: 'var(--academy-cyan)', color: '#071620'}} href="#levels">
              اختار مرحلتك
              <ArrowLeft aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>

      <footer className="academy-footer">
        <div className="academy-container academy-footer-grid">
          <div>
            <AcademyBrand />
            <p>
              شرح English لطلاب الصف الثالث الإعدادي والصفوف الأول والثاني والثالث الثانوي في النظام
              المصري.
            </p>
          </div>
          <div>
            <h2>روابط سريعة</h2>
            <a href="#levels">اختار مرحلتك</a>
            <a href="#learning-path">نظام المذاكرة</a>
            <Link href="/courses">الكورسات</Link>
          </div>
          <div>
            <h2>حسابك</h2>
            <Link href="/login">تسجيل الدخول</Link>
            <Link href="/register">إنشاء حساب</Link>
          </div>
          <div>
            <h2>الأكاديمية</h2>
            <a href="#teacher">عن مستر البحراوي</a>
            <a href="#parents">لولي الأمر</a>
          </div>
        </div>
        <div className="academy-footer-bottom">
          <span>© {new Date().getFullYear()} أكاديمية السيد البحراوي. جميع الحقوق محفوظة.</span>
          <span dir="ltr" lang="en">
            English made clear.
          </span>
        </div>
      </footer>
    </div>
  );
}
