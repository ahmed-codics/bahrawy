'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, CheckCircle2, Home, TrendingUp, UserRound } from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  LearnerShell,
  PageHeader,
  PageIntro,
  PageSkeleton,
  ProgressBar,
  StatCard,
} from '@bahrawy/ui';
import { fetchApi, fetchCsrfToken, clearCsrfToken } from '../../lib/api';

type Course = {
  id: string;
  titleAr: string;
  completedLessons?: number;
  totalLessons?: number;
  progressPercentage?: number;
  progress?: number;
};
type LinkedStudent = {
  studentId?: string;
  id?: string;
  displayName?: string;
  profile?: { displayName?: string };
  courses?: Course[];
};
type GuardianData = { profile?: { displayName?: string }; linkedStudents?: LinkedStudent[] };

export default function GuardianDashboard() {
  const [data, setData] = useState<GuardianData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  useEffect(() => {
    fetchApi('/dashboard/guardian')
      .then((response) => {
        setData(response.data);
        fetchCsrfToken();
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);
  const logout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } finally {
      clearCsrfToken();
      router.push('/login');
    }
  };
  const students = data?.linkedStudents || [];
  const allCourses = students.flatMap((student) => student.courses || []);
  const average = allCourses.length
    ? Math.round(
        allCourses.reduce(
          (sum, course) => sum + (course.progressPercentage ?? course.progress ?? 0),
          0,
        ) / allCourses.length,
      )
    : 0;

  return (
    <LearnerShell
      user={{ name: data?.profile?.displayName || 'ولي الأمر', role: 'ولي أمر' }}
      navigation={[
        {
          label: 'متابعة الأبناء',
          href: '/guardian',
          isActive: true,
          icon: <Home className="size-5" />,
        },
      ]}
      onNavigate={router.push}
      onLogout={logout}
    >
      {loading ? (
        <PageSkeleton cards={4} />
      ) : (
        <PageIntro className="space-y-8">
          <PageHeader
            eyebrow="متابعة الأسرة"
            title={`أهلاً ${data?.profile?.displayName || ''}`}
            description="صورة واضحة عن تقدم الأبناء والكورسات المفعلة في حساباتهم."
          />
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="الأبناء المرتبطون"
              value={students.length}
              icon={<UserRound className="size-6" />}
              tone="blue"
            />
            <StatCard
              label="الكورسات المفعلة"
              value={allCourses.length}
              icon={<BookOpen className="size-6" />}
              tone="cyan"
            />
            <StatCard
              label="متوسط التقدم"
              value={`${average}%`}
              icon={<TrendingUp className="size-6" />}
              tone="amber"
            />
          </section>
          <section>
            <h2 className="ba-heading text-2xl">تقدم الأبناء</h2>
            <p className="mt-1 text-sm text-text-muted">
              اختر كل طالب وراجع ما تم إنجازه داخل كورساته.
            </p>
            {students.length === 0 ? (
              <EmptyState
                className="mt-5"
                icon={<UserRound className="size-7" />}
                title="لا يوجد أبناء مرتبطون بالحساب"
                description="تواصل مع إدارة الأكاديمية لإتمام ربط حساب ولي الأمر بالطالب."
              />
            ) : (
              <div className="mt-5 space-y-5">
                {students.map((student) => {
                  const courses = student.courses || [];
                  const name = student.displayName || student.profile?.displayName || 'الطالب';
                  return (
                    <Card key={student.studentId || student.id}>
                      <CardContent className="pt-5 sm:pt-6">
                        <div className="flex items-center gap-4">
                          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-500 text-white dark:bg-brand-400 dark:text-brand-950">
                            <UserRound className="size-6" />
                          </span>
                          <div>
                            <h3 className="font-heading text-xl font-black">{name}</h3>
                            <Badge className="mt-1" tone="blue">
                              {courses.length} كورسات
                            </Badge>
                          </div>
                        </div>
                        {courses.length === 0 ? (
                          <p className="mt-5 rounded-xl bg-surface-soft p-4 text-sm text-text-muted">
                            لا توجد كورسات مفعلة لهذا الطالب.
                          </p>
                        ) : (
                          <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {courses.map((course) => (
                              <div
                                key={course.id}
                                className="rounded-2xl border border-border-default bg-surface-soft/55 p-5"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <h4 className="font-bold">{course.titleAr}</h4>
                                  <CheckCircle2 className="size-5 text-success" />
                                </div>
                                <ProgressBar
                                  className="mt-4"
                                  value={course.progressPercentage ?? course.progress ?? 0}
                                  label={`${course.completedLessons || 0} من ${course.totalLessons || 0} درس`}
                                  tone="cyan"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </PageIntro>
      )}
    </LearnerShell>
  );
}
