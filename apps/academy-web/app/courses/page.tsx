import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BookOpen, CheckCircle2, Filter, GraduationCap, ImageIcon } from 'lucide-react';
import type { ProductDTO } from '@bahrawy/types';
import { PublicShell } from '../../components/PublicShell';
import { API_BASE } from '../../lib/api';

export const metadata: Metadata = {
  title: 'كورسات English حسب مرحلتك',
  description: 'اختار مرحلتك وشوف كورسات وباقات أكاديمية السيد البحراوي المتاحة.',
};

type Grade = {
  id: string;
  code?: string;
  nameAr: string;
  nameEn?: string;
  status?: string;
};

const canonicalGradeNames: Record<string, string> = {
  'g3-prep': 'الصف الثالث الإعدادي',
  'g1-sec': 'الصف الأول الثانوي',
  'g2-sec': 'الصف الثاني الثانوي',
  'g3-sec': 'الصف الثالث الثانوي',
};

function publicGradeName(grade?: Grade) {
  if (!grade) return 'كل المراحل';
  return (
    (grade.code && canonicalGradeNames[grade.code]) || grade.nameAr.replace(/^\[DEV ONLY\]\s*/i, '')
  );
}

function publicCoverUrl(coverImageUrl?: string | null) {
  if (!coverImageUrl) return null;
  const match = coverImageUrl.match(/^\/storage\/([^/]+)$/);
  if (!match) return `${API_BASE}${coverImageUrl}`;
  return `${API_BASE}/storage/public/${encodeURIComponent(match[1])}`;
}

async function getProducts(gradeId?: string): Promise<ProductDTO[]> {
  try {
    const url = new URL(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/catalog/products`,
    );
    if (gradeId) url.searchParams.set('gradeId', gradeId);
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) return [];
    return (await response.json()).data || [];
  } catch {
    return [];
  }
}

async function getGrades(): Promise<Grade[]> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/catalog/grades`,
      { next: { revalidate: 60 } },
    );
    if (!response.ok) return [];
    return ((await response.json()).data || []).filter(
      (grade: Grade) => grade.status !== 'ARCHIVED',
    );
  } catch {
    return [];
  }
}

const arNumber = new Intl.NumberFormat('ar-EG');

export default async function CoursesPage({
  searchParams,
}: {
  searchParams?: Promise<{ gradeId?: string }>;
}) {
  const query = await searchParams;
  const [products, grades] = await Promise.all([getProducts(query?.gradeId), getGrades()]);
  const selectedGrade = grades.find((grade) => grade.id === query?.gradeId);

  return (
    <PublicShell active="courses">
      <section className="academy-courses-hero">
        <div className="academy-container academy-courses-hero-inner">
          <div>
            <span className="academy-eyebrow">
              <GraduationCap aria-hidden="true" />
              {publicGradeName(selectedGrade)}
            </span>
            <h1>المحتوى المناسب لمرحلتك، من غير لخبطة.</h1>
            <p>شوف تفاصيل الباقة، المحتوى، والسعر بوضوح قبل ما تسجّل وتشترك.</p>
          </div>
          <Link href="/#levels" className="academy-button academy-button-secondary">
            غيّر مرحلتك
          </Link>
        </div>
      </section>

      <section className="academy-container academy-courses-content">
        <form method="GET" action="/courses" className="academy-course-filter">
          <label htmlFor="gradeId">المرحلة الدراسية</label>
          <div className="academy-course-filter-controls">
            <select id="gradeId" name="gradeId" defaultValue={query?.gradeId || ''}>
              <option value="">كل المراحل</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {publicGradeName(grade)}
                </option>
              ))}
            </select>
            <button type="submit">
              <Filter aria-hidden="true" />
              عرض المحتوى
            </button>
            {query?.gradeId && <Link href="/courses">مسح</Link>}
          </div>
        </form>

        <div className="academy-course-results-head">
          <div>
            <span>
              {products.length
                ? `${arNumber.format(products.length)} باقة متاحة`
                : 'المحتوى المتاح'}
            </span>
            <h2>{publicGradeName(selectedGrade)}</h2>
          </div>
          <p>اختار الباقة المناسبة وكمّل الاشتراك من حساب الطالب.</p>
        </div>

        {products.length === 0 ? (
          <div className="academy-course-empty">
            <span>
              <BookOpen aria-hidden="true" />
            </span>
            <h2>مفيش محتوى منشور للمرحلة دي دلوقتي</h2>
            <p>جرّب مرحلة تانية أو ارجع قريب؛ المحتوى الجديد هيظهر هنا أول ما يتنشر.</p>
            <Link className="academy-button academy-button-secondary" href="/#levels">
              اختار مرحلة تانية
            </Link>
          </div>
        ) : (
          <div className="academy-course-grid">
            {products.map((product) => {
              const price = product.prices?.[0];
              const cover = publicCoverUrl(product.coverImageUrl);
              const checkoutPath = `/student/checkout/${product.id}`;
              return (
                <article className="academy-course-card" key={product.id}>
                  <div className="academy-course-cover">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt={`صورة باقة ${product.titleAr}`} loading="lazy" />
                    ) : (
                      <span
                        className="academy-course-cover-placeholder"
                        aria-label="لا توجد صورة للباقة"
                      >
                        <ImageIcon aria-hidden="true" />
                      </span>
                    )}
                    <span className="academy-course-availability">متاحة للاشتراك</span>
                  </div>
                  <div className="academy-course-card-body">
                    <div>
                      <span className="academy-course-label">باقة English</span>
                      <h3>{product.titleAr}</h3>
                      {product.descriptionAr && <p>{product.descriptionAr}</p>}
                    </div>
                    <ul>
                      <li>
                        <CheckCircle2 aria-hidden="true" /> وصول لمحتوى الباقة
                      </li>
                      <li>
                        <CheckCircle2 aria-hidden="true" /> تقدّم محفوظ على حسابك
                      </li>
                      <li>
                        <CheckCircle2 aria-hidden="true" /> مشاهدة مناسبة للموبايل
                      </li>
                    </ul>
                    <div className="academy-course-price-row">
                      <span>
                        <small>السعر</small>
                        <strong>
                          {price?.amount ? arNumber.format(Number(price.amount)) : '—'}{' '}
                          <em>{price?.currency || 'EGP'}</em>
                        </strong>
                      </span>
                      <Link
                        href={`/login?next=${encodeURIComponent(checkoutPath)}`}
                        className="academy-button"
                      >
                        سجّل واشترك
                        <ArrowLeft aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
