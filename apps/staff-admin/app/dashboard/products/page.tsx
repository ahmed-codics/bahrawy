'use client';

import { FormEvent, useCallback, useDeferredValue, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Edit3, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  ErrorState,
  FilterBar,
  Input,
  PageHeader,
  PageSkeleton,
  Select,
} from '@bahrawy/ui';
import { API_BASE, fetchApi } from '../../../lib/api';
import { LifecycleDialog } from '../_components/LifecycleDialog';

type Course = {
  id: string;
  code: string;
  titleAr: string;
  status: string;
  gradeId?: string | null;
  grade?: { id: string; nameAr: string } | null;
};

type Grade = { id: string; nameAr: string; code: string };

type Price = {
  id: string;
  amount: number | string;
  currency: string;
  billingPeriod: string;
  status: string;
  createdAt: string;
};

type Product = {
  id: string;
  code: string;
  titleAr: string;
  titleEn?: string | null;
  descriptionAr?: string | null;
  coverImageUrl?: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishAt?: string | null;
  unpublishAt?: string | null;
  version: number;
  grade?: Grade | null;
  gradeId?: string | null;
  courses: { course: Course }[];
  unitEntries: unknown[];
  prices: Price[];
  _count?: { entitlements: number };
};

type ProductForm = {
  titleAr: string;
  titleEn: string;
  code: string;
  descriptionAr: string;
  status: Product['status'];
  publishAt: string;
  unpublishAt: string;
  gradeId: string;
  courseIds: string[];
  priceAmount: string;
  isFree: boolean;
  billingPeriod: string;
};

const EMPTY_FORM: ProductForm = {
  titleAr: '',
  titleEn: '',
  code: '',
  descriptionAr: '',
  status: 'DRAFT',
  publishAt: '',
  unpublishAt: '',
  gradeId: '',
  courseIds: [],
  priceAmount: '',
  isFree: false,
  billingPeriod: 'ONCE',
};

function statusBadge(product: Product) {
  if (product.status === 'ARCHIVED') return <Badge tone="neutral">مؤرشفة</Badge>;
  if (product.status === 'DRAFT') return <Badge tone="amber">مسودة</Badge>;
  if (product.publishAt && new Date(product.publishAt) > new Date()) {
    return <Badge tone="blue">مجدولة</Badge>;
  }
  return <Badge tone="success">منشورة</Badge>;
}

function currentPrice(product: Product) {
  return product.prices.find((price) => price.status === 'ACTIVE') ?? product.prices[0];
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [lifecycleProduct, setLifecycleProduct] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: '24',
      });
      if (deferredSearch.trim()) query.set('search', deferredSearch.trim());
      if (status) query.set('status', status);
      const [productResponse, courseResponse, academicResponse] = await Promise.all([
        fetchApi(`/admin/v1/products?${query}`),
        fetchApi('/admin/v1/courses?pageSize=100'),
        fetchApi('/admin/v1/academic'),
      ]);
      setProducts(productResponse.data.items as Product[]);
      setPageCount(Number(productResponse.data.meta.pageCount) || 1);
      setCourses(courseResponse.data.items as Course[]);
      setGrades(academicResponse.data.grades as Grade[]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل الباقات');
    } finally {
      setLoading(false);
    }
  }, [deferredSearch, page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = products;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setCoverFile(null);
    setDrawerOpen(true);
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('create') !== '1') return;
    setEditing(null);
    setForm(EMPTY_FORM);
    setCoverFile(null);
    setDrawerOpen(true);
    window.history.replaceState(null, '', '/dashboard/products');
  }, []);

  const updateForm = <TKey extends keyof ProductForm>(key: TKey, value: ProductForm[TKey]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleCourse = (courseId: string) => {
    updateForm(
      'courseIds',
      form.courseIds.includes(courseId)
        ? form.courseIds.filter((id) => id !== courseId)
        : [...form.courseIds, courseId],
    );
  };

  const changeGrade = (gradeId: string) => {
    setForm((current) => ({
      ...current,
      gradeId,
      courseIds: current.courseIds.filter(
        (courseId) => courses.find((course) => course.id === courseId)?.gradeId === gradeId,
      ),
    }));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.gradeId) {
      toast.error('اختر المرحلة الدراسية للباقة');
      return;
    }
    setSaving(true);
    try {
      let coverImageUrl = editing?.coverImageUrl;
      if (coverFile) {
        const upload = new FormData();
        upload.append('file', coverFile);
        const uploaded = await fetchApi('/storage/upload', {
          method: 'POST',
          body: upload,
          timeoutMs: 60_000,
        });
        coverImageUrl = `/storage/${uploaded.data.storedObjectId}`;
      }
      const payload = {
        titleAr: form.titleAr.trim(),
        titleEn: form.titleEn.trim() || undefined,
        code: form.code.trim(),
        descriptionAr: form.descriptionAr.trim() || undefined,
        coverImageUrl,
        gradeId: form.gradeId,
        status: form.status,
        publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
        unpublishAt: form.unpublishAt ? new Date(form.unpublishAt).toISOString() : null,
        courseIds: form.courseIds,
        ...(form.isFree || form.priceAmount !== ''
          ? {
              priceAmount: form.isFree ? 0 : Number(form.priceAmount),
              currency: 'EGP',
              billingPeriod: form.billingPeriod,
            }
          : {}),
        ...(editing ? { version: editing.version } : {}),
      };
      await fetchApi(editing ? `/admin/v1/products/${editing.id}` : '/admin/v1/products', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      toast.success(editing ? 'تم تحديث الباقة' : 'تم إنشاء الباقة');
      setDrawerOpen(false);
      await load();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'تعذر حفظ الباقة');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !products.length) return <PageSkeleton cards={5} />;
  if (error && !products.length) {
    return <ErrorState title="تعذر تحميل الباقات" description={error} onRetry={load} />;
  }

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        eyebrow="الكتالوج والأسعار"
        title="الباقات"
        description="إدارة محتوى كل باقة ودورة نشرها وسجل أسعارها."
        actions={
          <Button leadingIcon={<Plus className="size-4" />} onClick={openCreate}>
            باقة جديدة
          </Button>
        }
      />
      <FilterBar
        value={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="ابحث بالاسم أو الكود"
        filters={
          <Select
            aria-label="تصفية بالحالة"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">كل الحالات</option>
            <option value="DRAFT">مسودة</option>
            <option value="PUBLISHED">منشورة</option>
            <option value="ARCHIVED">مؤرشفة</option>
          </Select>
        }
      />
      <DataTable
        loading={loading}
        emptyMessage="لا توجد باقات مطابقة"
        data={visible}
        keyExtractor={(product) => product.id}
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        columns={[
          {
            id: 'product',
            header: 'الباقة',
            cell: (product: Product) => (
              <div className="min-w-48">
                <strong>{product.titleAr}</strong>
                <p className="text-xs text-ink-3" dir="ltr">
                  {product.code}
                </p>
              </div>
            ),
          },
          { id: 'status', header: 'النشر', cell: statusBadge },
          {
            id: 'grade',
            header: 'المرحلة',
            cell: (product: Product) => product.grade?.nameAr || 'غير محددة',
          },
          {
            id: 'courses',
            header: 'الكورسات',
            cell: (product: Product) => (
              <span title={product.courses.map((entry) => entry.course.titleAr).join('، ')}>
                {product.courses.length}
              </span>
            ),
            align: 'center',
          },
          {
            id: 'price',
            header: 'السعر الحالي',
            cell: (product: Product) => {
              const price = currentPrice(product);
              return price
                ? Number(price.amount) === 0
                  ? 'مجاني'
                  : `${price.amount} ${price.currency}`
                : 'بدون سعر';
            },
          },
          {
            id: 'history',
            header: 'سجل الأسعار',
            cell: (product: Product) => product.prices.length,
            align: 'center',
          },
          {
            id: 'entitlements',
            header: 'الاشتراكات',
            cell: (product: Product) => product._count?.entitlements ?? 0,
            align: 'center',
          },
        ]}
        rowActions={(product) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="تعديل الباقة"
              onClick={() => router.push(`/dashboard/products/${product.id}`)}
            >
              <Edit3 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                product.status === 'ARCHIVED'
                  ? 'استعادة الباقة'
                  : 'إدارة أرشفة الباقة'
              }
              onClick={() => setLifecycleProduct(product)}
            >
              <Archive className="size-4" />
            </Button>
          </div>
        )}
      />

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'تعديل الباقة' : 'إنشاء باقة'}
        footer={
          <Button form="product-form" type="submit" loading={saving}>
            حفظ
          </Button>
        }
      >
        <form id="product-form" className="space-y-5" onSubmit={save}>
          <Input
            label="اسم الباقة بالعربية"
            value={form.titleAr}
            onChange={(event) => updateForm('titleAr', event.target.value)}
            required
          />
          <Input
            label="الاسم بالإنجليزية"
            value={form.titleEn}
            onChange={(event) => updateForm('titleEn', event.target.value)}
            directionMode="ltr"
          />
          <Input
            label="الكود"
            value={form.code}
            onChange={(event) => updateForm('code', event.target.value)}
            directionMode="ltr"
            disabled={Boolean(editing)}
            required
          />
          <Input
            label="الوصف"
            value={form.descriptionAr}
            onChange={(event) => updateForm('descriptionAr', event.target.value)}
          />
          <Select
            label="المرحلة الدراسية"
            value={form.gradeId}
            onChange={(event) => changeGrade(event.target.value)}
            required
          >
            <option value="">اختر المرحلة</option>
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.nameAr}
              </option>
            ))}
          </Select>
          <Select
            label="الحالة"
            value={form.status}
            onChange={(event) => updateForm('status', event.target.value as Product['status'])}
          >
            <option value="DRAFT">مسودة</option>
            <option value="PUBLISHED">منشورة</option>
            <option value="ARCHIVED">مؤرشفة</option>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="datetime-local"
              label="موعد النشر"
              value={form.publishAt}
              onChange={(event) => updateForm('publishAt', event.target.value)}
            />
            <Input
              type="datetime-local"
              label="موعد إيقاف النشر"
              value={form.unpublishAt}
              onChange={(event) => updateForm('unpublishAt', event.target.value)}
            />
          </div>
          <label className="block space-y-2 text-sm font-bold text-ink">
            صورة الباقة
            {editing?.coverImageUrl && !coverFile && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${API_BASE}${editing.coverImageUrl}`}
                alt={editing.titleAr}
                className="aspect-video w-full border border-border object-cover"
              />
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
              className="block w-full border border-border bg-surface-1 p-3 text-sm"
            />
          </label>
          <fieldset className="space-y-2 border-y border-border py-4">
            <legend className="px-2 text-sm font-bold">الكورسات المشمولة</legend>
            {courses
              .filter((course) => !form.gradeId || course.gradeId === form.gradeId)
              .map((course) => (
                <label key={course.id} className="flex cursor-pointer items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={form.courseIds.includes(course.id)}
                    onChange={() => toggleCourse(course.id)}
                    className="size-4 accent-brand-600"
                  />
                  <span className="flex-1">{course.titleAr}</span>
                  <span className="text-xs text-ink-3" dir="ltr">
                    {course.code}
                  </span>
                </label>
              ))}
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              min="0"
              step="0.01"
              label={editing ? 'سعر جديد (اختياري)' : 'السعر'}
              value={form.priceAmount}
              onChange={(event) => updateForm('priceAmount', event.target.value)}
              disabled={form.isFree}
            />
            <Select
              label="نوع الدفع"
              value={form.billingPeriod}
              onChange={(event) => updateForm('billingPeriod', event.target.value)}
            >
              <option value="ONCE">مرة واحدة</option>
              <option value="MONTHLY">شهري</option>
              <option value="TERM">فصل دراسي</option>
            </Select>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={form.isFree}
              onChange={(event) => updateForm('isFree', event.target.checked)}
              className="size-4 accent-brand-600"
            />
            <span>هذا المنتج مجاني</span>
          </label>
          {editing && (
            <section className="space-y-2 border-t border-border pt-4">
              <h3 className="text-sm font-bold">سجل الأسعار</h3>
              {editing.prices.map((price) => (
                <div key={price.id} className="flex justify-between gap-3 text-sm">
                  <span>
                    {price.amount} {price.currency} · {price.billingPeriod}
                  </span>
                  <span className="text-ink-3">
                    {price.status} · {new Date(price.createdAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              ))}
            </section>
          )}
        </form>
      </Drawer>

      <LifecycleDialog
        open={Boolean(lifecycleProduct)}
        endpoint={
          lifecycleProduct ? `/admin/v1/products/${lifecycleProduct.id}` : '/admin/v1/products/none'
        }
        version={lifecycleProduct?.version ?? 1}
        onClose={() => setLifecycleProduct(null)}
        onComplete={async (action) => {
          toast.success(
            action === 'RESTORE'
              ? 'تمت استعادة الباقة'
              : action === 'PERMANENT_DELETE'
                ? 'تم حذف المسودة نهائياً'
                : 'تمت أرشفة الباقة',
          );
          await load();
        }}
      />
    </div>
  );
}
