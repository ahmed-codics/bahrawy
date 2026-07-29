'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, CalendarDays, GraduationCap, Plus, RotateCcw } from 'lucide-react';
import type { AdminApiResponse } from '@bahrawy/types';
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  PageSkeleton,
  Select,
} from '@bahrawy/ui';
import { fetchApi } from '../../../lib/api';
import { LifecycleDialog } from '../_components/LifecycleDialog';

type RecordStatus = 'ACTIVE' | 'ARCHIVED';
type Grade = {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  status: RecordStatus;
  version: number;
  _count?: { courses: number; studentProfiles: number };
};
type Subject = {
  id: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  status: RecordStatus;
  version: number;
  _count?: { courses: number };
};
type AcademicYear = {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  status: RecordStatus;
};
type Term = {
  id: string;
  code: string;
  titleAr: string;
  startsAt: string;
  endsAt: string;
  status: RecordStatus;
};
type Cohort = {
  id: string;
  gradeId: string;
  academicYearId: string;
  startsAt: string;
  expiresAt: string;
  status: RecordStatus;
  grade: Grade;
  academicYear: AcademicYear;
  terms: Term[];
};
type AcademicOverview = {
  grades: Grade[];
  subjects: Subject[];
  academicYears: AcademicYear[];
  cohorts: Cohort[];
};
type Tab = 'grades' | 'subjects' | 'years' | 'cohorts';
type CreateMode = Tab | 'terms';

const emptyOverview: AcademicOverview = {
  grades: [],
  subjects: [],
  academicYears: [],
  cohorts: [],
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(value));
}

export default function AcademicPage() {
  const [data, setData] = useState<AcademicOverview>(emptyOverview);
  const [tab, setTab] = useState<Tab>('grades');
  const [createMode, setCreateMode] = useState<CreateMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lifecycleRecord, setLifecycleRecord] = useState<{
    entity: 'grades' | 'subjects';
    record: Grade | Subject;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchApi<AdminApiResponse<AcademicOverview>>('/admin/v1/academic');
      setData(response.data);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'تعذر تحميل الهيكل الأكاديمي',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'grades', label: 'المراحل الدراسية', count: data.grades.length },
    { id: 'subjects', label: 'المواد', count: data.subjects.length },
    { id: 'years', label: 'الأعوام الدراسية', count: data.academicYears.length },
    { id: 'cohorts', label: 'المجموعات والفصول', count: data.cohorts.length },
  ];

  const createLabel = useMemo(
    () =>
      ({
        grades: 'إضافة مرحلة',
        subjects: 'إضافة مادة',
        years: 'إضافة عام دراسي',
        cohorts: 'إضافة مجموعة',
      })[tab],
    [tab],
  );

  if (loading) return <PageSkeleton cards={5} />;
  if (error) {
    return <ErrorState title="تعذر تحميل الهيكل الأكاديمي" description={error} onRetry={load} />;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        eyebrow="الإعداد الأكاديمي"
        title="الهيكل الأكاديمي"
        description="إدارة الأعوام والمراحل والمواد والمجموعات والفصول من مكان واحد."
        actions={
          <Button leadingIcon={<Plus className="size-4" />} onClick={() => setCreateMode(tab)}>
            {createLabel}
          </Button>
        }
      />

      <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`ba-focus min-h-11 whitespace-nowrap border-b-2 px-4 text-sm font-medium ${
              tab === item.id
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {item.label} <span className="ba-number">({item.count})</span>
          </button>
        ))}
      </div>

      {tab === 'grades' && (
        <DataTable
          columns={[
            {
              id: 'name',
              header: 'المرحلة',
              cell: (row: Grade) => (
                <div>
                  <strong>{row.nameAr}</strong>
                  <p className="text-xs text-ink-3">{row.nameEn}</p>
                </div>
              ),
            },
            {
              id: 'code',
              header: 'الكود',
              cell: (row: Grade) => <span dir="ltr">{row.code}</span>,
            },
            {
              id: 'courses',
              header: 'الكورسات',
              cell: (row: Grade) => row._count?.courses ?? 0,
              align: 'center',
            },
            {
              id: 'students',
              header: 'الطلاب',
              cell: (row: Grade) => row._count?.studentProfiles ?? 0,
              align: 'center',
            },
            {
              id: 'status',
              header: 'الحالة',
              cell: (row: Grade) => (
                <Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {row.status === 'ACTIVE' ? 'نشطة' : 'مؤرشفة'}
                </Badge>
              ),
            },
          ]}
          data={data.grades}
          keyExtractor={(row) => row.id}
          rowActions={(row) => (
            <Button
              variant="ghost"
              size="icon"
              disabled={saving}
              aria-label={row.status === 'ARCHIVED' ? 'استعادة المرحلة' : 'أرشفة المرحلة'}
              onClick={() => setLifecycleRecord({ entity: 'grades', record: row })}
            >
              {row.status === 'ARCHIVED' ? (
                <RotateCcw className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
            </Button>
          )}
        />
      )}

      {tab === 'subjects' && (
        <DataTable
          columns={[
            {
              id: 'name',
              header: 'المادة',
              cell: (row: Subject) => (
                <div>
                  <strong>{row.nameAr}</strong>
                  <p className="text-xs text-ink-3">{row.nameEn}</p>
                </div>
              ),
            },
            {
              id: 'code',
              header: 'الكود',
              cell: (row: Subject) => <span dir="ltr">{row.code}</span>,
            },
            {
              id: 'courses',
              header: 'الكورسات',
              cell: (row: Subject) => row._count?.courses ?? 0,
              align: 'center',
            },
            {
              id: 'status',
              header: 'الحالة',
              cell: (row: Subject) => (
                <Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {row.status === 'ACTIVE' ? 'نشطة' : 'مؤرشفة'}
                </Badge>
              ),
            },
          ]}
          data={data.subjects}
          keyExtractor={(row) => row.id}
          rowActions={(row) => (
            <Button
              variant="ghost"
              size="icon"
              disabled={saving}
              aria-label={row.status === 'ARCHIVED' ? 'استعادة المادة' : 'أرشفة المادة'}
              onClick={() => setLifecycleRecord({ entity: 'subjects', record: row })}
            >
              {row.status === 'ARCHIVED' ? (
                <RotateCcw className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
            </Button>
          )}
        />
      )}

      {tab === 'years' && (
        <DataTable
          columns={[
            {
              id: 'label',
              header: 'العام الدراسي',
              cell: (row: AcademicYear) => <strong>{row.label}</strong>,
            },
            {
              id: 'start',
              header: 'البداية',
              cell: (row: AcademicYear) => formatDate(row.startsOn),
            },
            { id: 'end', header: 'النهاية', cell: (row: AcademicYear) => formatDate(row.endsOn) },
            {
              id: 'status',
              header: 'الحالة',
              cell: (row: AcademicYear) => (
                <Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>{row.status}</Badge>
              ),
            },
          ]}
          data={data.academicYears}
          keyExtractor={(row) => row.id}
        />
      )}

      {tab === 'cohorts' &&
        (data.cohorts.length ? (
          <div className="space-y-4">
            {data.cohorts.map((cohort) => (
              <section key={cohort.id} className="border-b border-border pb-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-lg font-semibold">{cohort.grade.nameAr}</h2>
                    <p className="text-sm text-ink-3">
                      {cohort.academicYear.label} · {formatDate(cohort.startsAt)} -{' '}
                      {formatDate(cohort.expiresAt)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setCreateMode('terms')}>
                    إضافة فصل
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {cohort.terms.map((term) => (
                    <Badge key={term.id} tone="blue">
                      {term.titleAr} · {formatDate(term.startsAt)}
                    </Badge>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<GraduationCap className="size-6" />}
            title="لا توجد مجموعات دراسية"
            description="أنشئ عاماً دراسياً ومرحلة أولاً، ثم اربطهما بمجموعة."
          />
        ))}

      <CreateAcademicDrawer
        mode={createMode}
        data={data}
        saving={saving}
        onClose={() => setCreateMode(null)}
        onSubmit={async (endpoint, payload) => {
          setSaving(true);
          try {
            await fetchApi(endpoint, {
              method: 'POST',
              body: JSON.stringify(payload),
            });
            setCreateMode(null);
            await load();
          } finally {
            setSaving(false);
          }
        }}
      />
      {lifecycleRecord && (
        <LifecycleDialog
          open
          endpoint={`/admin/v1/academic/${lifecycleRecord.entity}/${lifecycleRecord.record.id}`}
          version={lifecycleRecord.record.version}
          onClose={() => setLifecycleRecord(null)}
          onComplete={async () => {
            setLifecycleRecord(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function CreateAcademicDrawer({
  mode,
  data,
  saving,
  onClose,
  onSubmit,
}: {
  mode: CreateMode | null;
  data: AcademicOverview;
  saving: boolean;
  onClose: () => void;
  onSubmit: (endpoint: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mode) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const endpoint =
      mode === 'grades' || mode === 'subjects'
        ? `/admin/v1/academic/${mode}`
        : mode === 'years'
          ? '/admin/v1/academic/academic-years/create'
          : mode === 'cohorts'
            ? '/admin/v1/academic/cohorts/create'
            : '/admin/v1/academic/terms/create';
    await onSubmit(endpoint, values);
  };

  return (
    <Drawer
      isOpen={Boolean(mode)}
      onClose={onClose}
      title="إضافة سجل أكاديمي"
      footer={
        <Button type="submit" form="academic-create-form" loading={saving}>
          حفظ
        </Button>
      }
    >
      <form id="academic-create-form" className="space-y-4" onSubmit={submit}>
        {(mode === 'grades' || mode === 'subjects') && (
          <>
            <Input name="nameAr" label="الاسم بالعربية" required />
            <Input name="nameEn" label="الاسم بالإنجليزية" dir="ltr" />
            <Input name="code" label="الكود" directionMode="ltr" required />
          </>
        )}
        {mode === 'years' && (
          <>
            <Input name="label" label="اسم العام الدراسي" placeholder="2026/2027" required />
            <Input name="startsOn" type="date" label="تاريخ البداية" required />
            <Input name="endsOn" type="date" label="تاريخ النهاية" required />
          </>
        )}
        {mode === 'cohorts' && (
          <>
            <Select name="academicYearId" label="العام الدراسي" required>
              <option value="">اختر العام</option>
              {data.academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label}
                </option>
              ))}
            </Select>
            <Select name="gradeId" label="المرحلة" required>
              <option value="">اختر المرحلة</option>
              {data.grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.nameAr}
                </option>
              ))}
            </Select>
            <Input name="startsAt" type="date" label="البداية" required />
            <Input name="expiresAt" type="date" label="النهاية" required />
          </>
        )}
        {mode === 'terms' && (
          <>
            <Select name="cohortId" label="المجموعة" required>
              <option value="">اختر المجموعة</option>
              {data.cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.grade.nameAr} - {cohort.academicYear.label}
                </option>
              ))}
            </Select>
            <Input name="titleAr" label="اسم الفصل" required />
            <Input name="code" label="الكود" directionMode="ltr" required />
            <Input name="startsAt" type="date" label="البداية" required />
            <Input name="endsAt" type="date" label="النهاية" required />
          </>
        )}
        <div className="flex items-center gap-2 text-xs text-ink-3">
          <CalendarDays className="size-4" />
          تُحفظ جميع المواعيد وفق توقيت القاهرة.
        </div>
      </form>
    </Drawer>
  );
}
