import { CourseWorkspaceNav } from './CourseWorkspaceNav';

export default async function CourseWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div dir="rtl">
      <CourseWorkspaceNav courseId={id} />
      {children}
    </div>
  );
}
