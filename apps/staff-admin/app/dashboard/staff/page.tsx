'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Edit3, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  ErrorState,
  Input,
  PageHeader,
  PageSkeleton,
  Select,
} from '@bahrawy/ui';
import { fetchApi } from '../../../lib/api';

type Role = {
  id: string;
  code: string;
  rolePermissions: { permission: { code: string } }[];
};
type Staff = {
  id: string;
  displayName: string;
  email: string;
  account: {
    status: string;
    version: number;
    accountRoles: { roleId: string; role: Role }[];
    authSessions: { id: string }[];
  };
};

export default function StaffPage() {
  const [members, setMembers] = useState<Staff[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [temporaryPassword, setTemporaryPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [staffResponse, roleResponse] = await Promise.all([
        fetchApi('/admin/v1/management/staff'),
        fetchApi('/admin/v1/management/roles'),
      ]);
      setMembers(staffResponse.data as Staff[]);
      setRoles(roleResponse.data as Role[]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل فريق العمل');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void load(), [load]);

  const openCreate = () => {
    setEditing(null);
    setSelectedRoles([]);
    setTemporaryPassword('');
    setDrawerOpen(true);
  };
  const openEdit = (member: Staff) => {
    setEditing(member);
    setSelectedRoles(member.account.accountRoles.map((assignment) => assignment.roleId));
    setTemporaryPassword('');
    setDrawerOpen(true);
  };
  const toggleRole = (roleId: string) =>
    setSelectedRoles((current) =>
      current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId],
    );

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRoles.length) return toast.error('اختر دوراً واحداً على الأقل');
    setSaving(true);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      if (editing) {
        await fetchApi(`/admin/v1/management/staff/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: values.status,
            reason: values.reason,
            roleIds: selectedRoles,
            version: editing.account.version,
          }),
        });
        setDrawerOpen(false);
        toast.success('تم تحديث صلاحيات الموظف');
      } else {
        const response = await fetchApi('/admin/v1/management/staff', {
          method: 'POST',
          body: JSON.stringify({
            displayName: values.displayName,
            email: values.email,
            roleIds: selectedRoles,
          }),
        });
        setTemporaryPassword((response.data as { temporaryPassword: string }).temporaryPassword);
        toast.success('تم إنشاء حساب الموظف');
      }
      await load();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'تعذر حفظ الموظف');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !roles.length) return <PageSkeleton cards={5} />;
  if (error && !roles.length)
    return <ErrorState title="تعذر تحميل فريق العمل" description={error} onRetry={load} />;

  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        eyebrow="الأمان والصلاحيات"
        title="فريق العمل"
        description="إدارة حالة حسابات الموظفين والأدوار والصلاحيات الفعلية."
        actions={
          <Button leadingIcon={<Plus className="size-4" />} onClick={openCreate}>
            موظف جديد
          </Button>
        }
      />
      <DataTable
        loading={loading}
        emptyMessage="لا يوجد موظفون"
        data={members}
        keyExtractor={(member) => member.id}
        columns={[
          {
            id: 'member',
            header: 'الموظف',
            cell: (member: Staff) => (
              <div>
                <strong>{member.displayName}</strong>
                <p className="text-xs text-ink-3" dir="ltr">
                  {member.email}
                </p>
              </div>
            ),
          },
          {
            id: 'status',
            header: 'الحالة',
            cell: (member: Staff) =>
              member.account.status === 'ACTIVE' ? (
                <Badge tone="success">نشط</Badge>
              ) : (
                <Badge tone="amber">موقوف</Badge>
              ),
          },
          {
            id: 'roles',
            header: 'الأدوار',
            cell: (member: Staff) =>
              member.account.accountRoles.map((entry) => entry.role.code).join('، '),
          },
          {
            id: 'sessions',
            header: 'الجلسات النشطة',
            cell: (member: Staff) => member.account.authSessions.length,
            align: 'center',
          },
        ]}
        rowActions={(member) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label="تعديل الموظف"
            onClick={() => openEdit(member)}
          >
            <Edit3 className="size-4" />
          </Button>
        )}
      />
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={temporaryPassword ? 'تم إنشاء الحساب' : editing ? 'تعديل الموظف' : 'موظف جديد'}
        footer={
          temporaryPassword ? (
            <Button onClick={() => setDrawerOpen(false)}>تم</Button>
          ) : (
            <Button form="staff-form" type="submit" loading={saving}>
              حفظ
            </Button>
          )
        }
      >
        {temporaryPassword ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-3">
              كلمة المرور المؤقتة تظهر مرة واحدة ويجب تغييرها عند أول دخول.
            </p>
            <div className="border border-border bg-surface-2 p-4 font-mono text-lg" dir="ltr">
              {temporaryPassword}
            </div>
          </div>
        ) : (
          <form id="staff-form" className="space-y-5" onSubmit={save}>
            {!editing ? (
              <>
                <Input name="displayName" label="اسم الموظف" required />
                <Input
                  name="email"
                  type="email"
                  label="البريد الإلكتروني"
                  directionMode="ltr"
                  required
                />
              </>
            ) : (
              <>
                <Input value={editing.displayName} label="اسم الموظف" disabled />
                <Select name="status" label="حالة الحساب" defaultValue={editing.account.status}>
                  <option value="ACTIVE">نشط</option>
                  <option value="SUSPENDED">موقوف</option>
                </Select>
                <Input name="reason" label="سبب التغيير" required minLength={3} />
              </>
            )}
            <fieldset className="space-y-3 border-y border-border py-4">
              <legend className="px-2 text-sm font-bold">الأدوار</legend>
              {roles.map((role) => (
                <label key={role.id} className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                    className="mt-1 size-4 accent-brand-600"
                  />
                  <span>
                    <strong dir="ltr">{role.code}</strong>
                    <span className="mt-1 block text-xs text-ink-3">
                      {role.rolePermissions.map((entry) => entry.permission.code).join('، ') ||
                        'بدون صلاحيات'}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          </form>
        )}
      </Drawer>
    </div>
  );
}
