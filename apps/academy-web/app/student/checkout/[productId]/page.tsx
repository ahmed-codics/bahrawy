'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  FileCheck2,
  Landmark,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { Badge, Button, ErrorState, PageSkeleton } from '@bahrawy/ui';
import type { ProductDTO } from '@bahrawy/types';
import { fetchApi } from '../../../../lib/api';

export default function CheckoutPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [orgSettings, setOrgSettings] = useState<{
    paymentInstapay?: string | null;
    paymentWallet?: string | null;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      fetchApi(`/catalog/products/${productId}`).then((res) => res.data),
      fetchApi('/catalog/settings').then((res) => res.data),
    ])
      .then(([productData, orgData]) => {
        setProduct(productData);
        setOrgSettings(orgData);
      })
      .catch(() => setError('تعذر تحميل بيانات عملية الشراء.'))
      .finally(() => setLoading(false));
  }, [productId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (referenceNumber.trim().length < 4)
      return setError('اكتب الرقم المرجعي الظاهر في عملية التحويل.');
    if (!proofFile) return setError('ارفع صورة أو ملف إيصال الدفع أولاً.');
    if (proofFile.size > 5 * 1024 * 1024) return setError('حجم الملف يجب ألا يتجاوز 5 ميجابايت.');
    const price = product?.prices?.[0];
    if (!price) return setError('لا يوجد سعر نشط لهذا المحتوى.');
    setSubmitting(true);
    try {
      const order = await fetchApi('/payments/order', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          priceId: price.id,
          referenceNumber: referenceNumber.trim(),
          idempotencyKey: `order_${productId}_${Date.now()}`,
        }),
      });
      const form = new FormData();
      form.append('file', proofFile);
      form.append('orderId', order.data.id);
      await fetchApi('/payments/proof', { method: 'POST', body: form });
      setSuccess(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر إرسال طلب الدفع.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageSkeleton cards={3} />;
  if (!product)
    return (
      <ErrorState
        title="تعذر فتح صفحة الدفع"
        description={error}
        onRetry={() => window.location.reload()}
      />
    );

  if (success)
    return (
      <div className="mx-auto max-w-3xl px-1 py-4 sm:py-8">
        <section className="student-hero px-4 py-8 text-center sm:px-10 sm:py-12">
          <span className="mx-auto flex size-20 items-center justify-center rounded-[1.5rem] bg-emerald-400/15 text-emerald-300">
            <CheckCircle2 className="size-10" />
          </span>
          <Badge tone="success" className="mt-6">
            تم إرسال طلبك
          </Badge>
          <h1 className="ba-heading mt-4 text-4xl">الإيصال وصل للمراجعة</h1>
          <p className="mx-auto mt-4 max-w-xl leading-8 text-cyan-50/75">
            الإدارة هتراجع الصورة والرقم المرجعي. بعد الاعتماد، هيفتح لك هذا الدرس فقط تلقائياً في
            حسابك.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button className="w-full sm:w-auto" variant="accent" onClick={() => router.push('/student/courses')}>
              العودة للكورسات
            </Button>
            <Button
              variant="outline"
              className="w-full border-white/20 bg-white/5 text-white sm:w-auto"
              onClick={() => router.push('/student')}
            >
              الرئيسية
            </Button>
          </div>
        </section>
      </div>
    );

  const price = product.prices?.[0];
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-black text-brand-700 dark:text-brand-300">الدفع والتحقق</p>
          <h1 className="ba-heading mt-1 text-3xl">إتمام شراء الدرس</h1>
        </div>
        <Button
          variant="outline"
          leadingIcon={<ArrowRight className="size-4" />}
          onClick={() => router.back()}
        >
          رجوع
        </Button>
      </header>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-6">
        <aside className="space-y-4">
          <section className="student-hero p-6">
            <Badge tone="cyan">ملخص الطلب</Badge>
            <h2 className="ba-heading mt-5 text-2xl">{product.titleAr}</h2>
            <div className="my-5 h-px bg-white/10" />
            <p className="text-sm font-bold text-cyan-50/60">المبلغ المطلوب</p>
            <p className="ba-number mt-1 text-4xl font-black">
              {price ? Number(price.amount).toLocaleString('ar-EG') : '—'}{' '}
              <span className="font-sans text-sm">{price?.currency || 'EGP'}</span>
            </p>
            <div className="mt-6 flex gap-2 text-xs leading-6 text-cyan-50/70">
              <LockKeyhole className="mt-1 size-4 shrink-0 text-[#69ddeb]" />
              <p>الوصول يفتح بعد مراجعة الإدارة واعتماد الدفع.</p>
            </div>
          </section>
          {orgSettings?.paymentInstapay && (
            <PaymentInstruction
              method="InstaPay"
              title="حوّل عبر InstaPay إلى"
              value={orgSettings.paymentInstapay}
            />
          )}
          {orgSettings?.paymentWallet && (
            <PaymentInstruction
              method="Wallet"
              title="حوّل محفظة إلكترونية إلى"
              value={orgSettings.paymentWallet}
            />
          )}
          {!orgSettings?.paymentInstapay && !orgSettings?.paymentWallet && (
            <PaymentInstruction
              method="Support"
              title="بيانات التحويل"
              value="تواصل مع الدعم للحصول على بيانات التحويل"
            />
          )}
          <div className="flex gap-3 rounded-2xl border border-success/20 bg-success/5 p-4 text-sm text-success">
            <ShieldCheck className="size-5 shrink-0" />
            <p className="font-bold">الموافقة تمنح الوصول للدرس المشترى فقط.</p>
          </div>
        </aside>

        <section className="student-panel p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200">
              <ReceiptText className="size-6" />
            </span>
            <div>
              <h2 className="ba-heading text-2xl">بيانات التحويل</h2>
              <p className="mt-1 text-sm leading-7 text-text-muted">
                اكتب الرقم المرجعي وارفع إيصالاً واضحاً. الطلب سيظهر فوراً للإدارة.
              </p>
            </div>
          </div>
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            <Step number="1" text="حوّل المبلغ" />
            <Step number="2" text="اكتب الرقم المرجعي" />
            <Step number="3" text="ارفع الإيصال" />
          </ol>
          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold text-danger"
            >
              {error}
            </div>
          )}
          <form onSubmit={submit} className="mt-6 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-black">
                الرقم المرجعي للتحويل <span className="text-danger">*</span>
              </span>
              <input
                dir="ltr"
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
                placeholder="مثال: 124578963"
                autoComplete="off"
                className="ba-focus min-h-12 w-full rounded-xl border border-border-default bg-surface px-4 text-left font-mono text-base outline-none focus:border-brand-500"
              />
              <span className="mt-2 block text-xs text-text-muted">
                هتلاقيه في تفاصيل عملية التحويل داخل التطبيق.
              </span>
            </label>
            <label
              className={`relative flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${proofFile ? 'border-success bg-success/5' : 'border-border-default bg-surface-soft hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/20'}`}
            >
              <input
                type="file"
                className="absolute inset-0 size-full cursor-pointer opacity-0"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(event) => setProofFile(event.target.files?.[0] || null)}
                disabled={submitting}
              />
              <span
                className={`flex size-16 items-center justify-center rounded-2xl ${proofFile ? 'bg-success/10 text-success' : 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200'}`}
              >
                {proofFile ? <FileCheck2 className="size-8" /> : <Upload className="size-8" />}
              </span>
              <p className="mt-4 max-w-full break-all font-black">
                {proofFile?.name || 'اضغط لاختيار صورة إيصال الدفع'}
              </p>
              <p className="mt-2 text-sm text-text-muted">JPG، PNG أو PDF — بحد أقصى 5MB</p>
            </label>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={submitting}
              loadingText="جاري إرسال الطلب..."
              disabled={!proofFile || referenceNumber.trim().length < 4}
            >
              إرسال للمراجعة
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <li className="flex items-center gap-2 rounded-xl bg-surface-soft p-3 text-sm font-bold">
      <span className="ba-number flex size-7 items-center justify-center rounded-lg bg-brand-700 text-xs text-white">
        {number}
      </span>
      {text}
    </li>
  );
}

function PaymentInstruction({
  method,
  title,
  value,
}: {
  method: string;
  title: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="student-panel p-5">
      <div className="flex items-start gap-3">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${method === 'InstaPay' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300'}`}
        >
          <Landmark className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-text-muted">{title}</p>
          <p dir="ltr" className="ba-number mt-2 break-all text-base font-black">
            {value}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        className="mt-4 w-full"
        leadingIcon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
      >
        {copied ? 'تم النسخ' : 'نسخ بيانات التحويل'}
      </Button>
    </section>
  );
}
