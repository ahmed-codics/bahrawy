'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, GraduationCap } from 'lucide-react';
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
import { fetchApi } from '../../lib/api';

type Grade = { id: string; nameAr: string; nameEn?: string; code: string; status: string };

export default function CatalogPage() {
  const router = useRouter();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/catalog/grades')
      .then((response) => setGrades(response.data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton cards={6} />;

  return (
    <PageIntro className="space-y-8">
      <PageHeader
        eyebrow="اختر مرحلتك"
        title="كتالوج أكاديمية البحراوي"
        description="ابدأ من المرحلة الدراسية المناسبة لك، ثم اختر الباقة الكاملة أو اشتر درسًا منفردًا."
      />
      {grades.length === 0 ? (
        <EmptyState title="لا توجد مراحل متاحة حاليًا" />
      ) : (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {grades.map((grade) => (
            <Card key={grade.id} interactive className="h-full">
              <CardContent className="space-y-5 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <GraduationCap className="size-6" />
                  </div>
                  <Badge tone={grade.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {grade.status === 'ACTIVE' ? 'متاحة' : grade.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                    {grade.code}
                  </p>
                  <h2 className="mt-2 font-heading text-2xl font-black">{grade.nameAr}</h2>
                  {grade.nameEn && <p className="text-sm text-text-muted">{grade.nameEn}</p>}
                </div>
                <Button
                  className="w-full"
                  trailingIcon={<ArrowLeft className="size-4" />}
                  onClick={() => router.push(`/grades/${grade.id}`)}
                >
                  عرض الباقات
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </PageIntro>
  );
}
