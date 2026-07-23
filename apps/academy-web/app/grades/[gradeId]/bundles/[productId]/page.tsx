'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Lock,
  PlayCircle,
  ClipboardList,
  PackageOpen,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  PageIntro,
  PageSkeleton,
} from '@bahrawy/ui';
import { API_BASE, fetchApi } from '../../../../../lib/api';

type Lesson = { id: string; titleAr: string; contentType: string; durationSeconds?: number };
type Assessment = { id: string; titleAr: string; questions?: unknown[]; attempts?: unknown[] };
type Unit = {
  id: string;
  titleAr: string;
  lessons?: Lesson[];
  assessments?: Assessment[];
  access?: { hasAccess: boolean; reason: string };
};
type Product = {
  id: string;
  titleAr: string;
  descriptionAr?: string;
  coverImageUrl?: string | null;
  prices?: { amount: string | number; currency: string }[];
};

export default function BundleDetailPage({
  params,
}: {
  params: Promise<{ gradeId: string; productId: string }>;
}) {
  const { gradeId, productId } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [openUnitId, setOpenUnitId] = useState<string | null>(null);
  const [hasEntitlement, setHasEntitlement] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi(`/catalog/bundles/${productId}`)
      .then((response) => {
        setProduct(response.data.product);
        setUnits(response.data.units || []);
        setHasEntitlement(Boolean(response.data.hasEntitlement));
        setOpenUnitId(response.data.units?.[0]?.id ?? null);
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [productId, router]);

  if (loading) return <PageSkeleton cards={4} />;
  if (!product) return <EmptyState title="تعذر فتح الباقة" />;

  const price = product.prices?.[0];

  return (
    <PageIntro className="space-y-7">
      <PageHeader
        eyebrow="تفاصيل الباقة"
        title={product.titleAr}
        description={
          product.descriptionAr ||
          `${units.length} درس · ${price?.amount ?? '—'} ${price?.currency || 'EGP'}`
        }
        actions={
          <Button
            onClick={() =>
              router.push(hasEntitlement ? '/student/courses' : `/student/checkout/${product.id}`)
            }
          >
            {hasEntitlement ? 'اذهب إلى كورساتي' : 'اشترِ الباقة'}
          </Button>
        }
      />

      <section className="overflow-hidden border border-border-default bg-surface">
        <div className="aspect-[16/6] min-h-52 bg-brand-50 dark:bg-brand-950/30">
          {product.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${API_BASE}${product.coverImageUrl}`}
              alt={product.titleAr}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <PackageOpen className="size-14 text-brand-500" />
            </div>
          )}
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2 className="font-heading text-xl font-black">محتوى الباقة</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-text-muted">
              {product.descriptionAr ||
                'كل الدروس والكورسات المشمولة داخل هذه الباقة في مكان واحد.'}
            </p>
          </div>
          <Badge tone={hasEntitlement ? 'success' : 'blue'}>
            {hasEntitlement ? 'أنت مشترك في هذه الباقة' : `${units.length} درس`}
          </Badge>
        </div>
      </section>

      {units.length === 0 ? (
        <EmptyState title="لا توجد دروس داخل هذه الباقة بعد" />
      ) : (
        <div className="space-y-3">
          {units.map((unit, index) => {
            const unlocked = !!unit.access?.hasAccess;
            const open = openUnitId === unit.id;
            return (
              <Card key={unit.id}>
                <CardContent className="space-y-4 pt-5">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 text-start"
                    onClick={() => setOpenUnitId(open ? null : unit.id)}
                  >
                    <span>
                      <span className="text-xs font-bold text-text-muted">درس {index + 1}</span>
                      <span className="block font-heading text-xl font-black">{unit.titleAr}</span>
                    </span>
                    <Badge tone={unlocked ? 'success' : 'danger'}>
                      {unlocked ? 'مفتوح' : 'مغلق'}
                    </Badge>
                  </button>
                  {open && (
                    <div className="space-y-3 border-t border-border-default pt-4">
                      {!unlocked && (
                        <div className="flex flex-col gap-3 rounded-xl border border-danger/20 bg-danger/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="flex items-center gap-2 text-sm font-bold text-danger">
                            <Lock className="size-4" />
                            اشترِ الدرس أو الباقة لفتح المحتوى.
                          </p>
                          <Button
                            size="sm"
                            onClick={() => router.push(`/grades/${gradeId}/units/${unit.id}/buy`)}
                          >
                            شراء الدرس
                          </Button>
                        </div>
                      )}
                      {(unit.lessons || []).map((lesson) => (
                        <ContentRow
                          key={lesson.id}
                          icon={
                            lesson.contentType === 'VIDEO' ? (
                              <PlayCircle className="size-5" />
                            ) : (
                              <FileText className="size-5" />
                            )
                          }
                          title={lesson.titleAr}
                          meta={lesson.contentType}
                          unlocked={unlocked}
                          onClick={() =>
                            unlocked && router.push(`/grades/${gradeId}/units/${unit.id}/learn`)
                          }
                        />
                      ))}
                      {(unit.assessments || []).map((assessment) => (
                        <ContentRow
                          key={assessment.id}
                          icon={<ClipboardList className="size-5" />}
                          title={assessment.titleAr}
                          meta={`${assessment.questions?.length || 0} أسئلة`}
                          unlocked={unlocked}
                          onClick={() =>
                            unlocked && router.push(`/grades/${gradeId}/units/${unit.id}/learn`)
                          }
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageIntro>
  );
}

function ContentRow({
  icon,
  title,
  meta,
  unlocked,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  unlocked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!unlocked}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-soft p-3 text-start disabled:opacity-65"
    >
      <span className="flex items-center gap-3">
        <span className="text-brand-700">{icon}</span>
        <span>
          <span className="block font-bold">{title}</span>
          <span className="text-xs text-text-muted">{meta}</span>
        </span>
      </span>
      {unlocked ? (
        <CheckCircle2 className="size-5 text-success" />
      ) : (
        <Lock className="size-5 text-danger" />
      )}
    </button>
  );
}
