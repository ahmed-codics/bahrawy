'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
import { fetchApi } from '../../../lib/api';

type Grade = { id: string; nameAr: string };
type Student = {
  id: string;
  displayName: string;
  grade?: Grade | null;
  account: {
    id: string;
    status: string;
    version: number;
    createdAt: string;
    updatedAt: string;
    _count: { devices: number; entitlements: number };
  };
};

type StudentListResponse = {
  students: Student[];
  meta: { page: number; pageSize: number; total: number };
};

export default function StudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set('search', search.trim());
      if (status) query.set('status', status);
      if (gradeId) query.set('gradeId', gradeId);
      const [studentResponse, academicResponse] = await Promise.all([
        fetchApi(`/admin/v1/students?${query}`),
        fetchApi('/admin/v1/academic'),
      ]);
      setStudents((studentResponse.data as StudentListResponse).students);
      setGrades((academicResponse.data as { grades: Grade[] }).grades);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل الطلاب');
    } finally {
      setLoading(false);
    }
  }, [gradeId, search, status]);

  useEffect(() => {
    const timeout = setTimeout(() => void load(), 250);
    return () => clearTimeout(timeout);
  }, [load]);

  const activeCount = useMemo(
    () => students.filter((student) => student.account.status === 'ACTIVE').length,
    [students],
  );

  const createStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = Object.fromEntries(new FormData(event.currentTarget));
      const response = await fetchApi('/admin/v1/students', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setTemporaryPassword((response.data as { temporaryPassword: string }).temporaryPassword);
      toast.success('تم إنشاء حساب الطالب');
      await load();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'تعذر إنشاء الطالب');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !grades.length) return <PageSkeleton cards={5} />;
  if (error && !grades.length) {
    return <ErrorState title="تعذر تحميل الطلاب" description={error} onRetry={load} />;
  }

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        eyebrow="الحسابات والوصول"
        title="الطلاب"
        description={`${activeCount} حساب نشط ضمن النتائج الحالية. افتح ملف الطالب لإدارة الوصول والمدفوعات والأجهزة.`}
        actions={
          <Button
            leadingIcon={<Plus className="size-4" />}
            onClick={() => {
              setTemporaryPassword('');
              setDrawerOpen(true);
            }}
          >
            طالب جديد
          </Button>
        }
      />
      <FilterBar
        value={search}
        onSearch={setSearch}
        searchPlaceholder="ابحث بالاسم أو رقم الهاتف الكامل"
        filters={
          <>
            <Select
              aria-label="تصفية بالحالة"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">كل الحالات</option>
              <option value="ACTIVE">نشط</option>
              <option value="SUSPENDED">موقوف</option>
            </Select>
            <Select
              aria-label="تصفية بالمرحلة"
              value={gradeId}
              onChange={(event) => setGradeId(event.target.value)}
            >
              <option value="">كل المراحل</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.nameAr}
                </option>
              ))}
            </Select>
          </>
        }
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <DataTable
        loading={loading}
        emptyMessage="لا يوجد طلاب مطابقون"
        data={students}
        keyExtractor={(student) => student.id}
        columns={[
          {
            id: 'student',
            header: 'الطالب',
            cell: (student: Student) => (
              <div className="min-w-48">
                <strong>{student.displayName}</strong>
                <p className="text-xs text-ink-3">{student.grade?.nameAr ?? 'بدون مرحلة'}</p>
              </div>
            ),
          },
          {
            id: 'status',
            header: 'الحالة',
            cell: (student: Student) =>
              student.account.status === 'ACTIVE' ? (
                <Badge tone="success">نشط</Badge>
              ) : (
                <Badge tone="amber">موقوف</Badge>
              ),
          },
          {
            id: 'entitlements',
            header: 'الاشتراكات',
            cell: (student: Student) => student.account._count.entitlements,
            align: 'center',
          },
          {
            id: 'devices',
            header: 'الأجهزة',
            cell: (student: Student) => student.account._count.devices,
            align: 'center',
          },
          {
            id: 'created',
            header: 'تاريخ الانضمام',
            cell: (student: Student) =>
              new Date(student.account.createdAt).toLocaleDateString('ar-EG'),
          },
        ]}
        rowActions={(student) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label="فتح ملف الطالب"
            onClick={() => router.push(`/dashboard/students/${student.id}`)}
          >
            <Eye className="size-4" />
          </Button>
        )}
      />
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={temporaryPassword ? 'تم إنشاء الحساب' : 'طالب جديد'}
        footer={
          temporaryPassword ? (
            <Button onClick={() => setDrawerOpen(false)}>تم</Button>
          ) : (
            <Button form="create-student" type="submit" loading={saving}>
              إنشاء الحساب
            </Button>
          )
        }
      >
        {temporaryPassword ? (
          <div className="space-y-3" dir="rtl">
            <p className="text-sm text-ink-3">
              تظهر كلمة المرور المؤقتة مرة واحدة. يجب على الطالب تغييرها عند أول دخول.
            </p>
            <div className="border border-border bg-surface-2 p-4 font-mono text-lg" dir="ltr">
              {temporaryPassword}
            </div>
          </div>
        ) : (
          <form id="create-student" className="space-y-4" onSubmit={createStudent}>
            <Input name="displayName" label="اسم الطالب" required />
            <Input name="phone" label="رقم الهاتف" directionMode="ltr" required />
            <Select name="gradeId" label="المرحلة">
              <option value="">بدون مرحلة</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.nameAr}
                </option>
              ))}
            </Select>
          </form>
        )}
      </Drawer>
    </div>
  );
}
