'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, ErrorState, Input, PageHeader, PageSkeleton, Select } from '@bahrawy/ui';
import { fetchApi } from '../../../lib/api';

type Organization = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  status: string;
  paymentInstapay: string | null;
  paymentWallet: string | null;
  version: number;
};

export default function SettingsPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchApi('/admin/v1/management/organization');
      setOrganization(response.data as Organization);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تحميل الإعدادات');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => void load(), [load]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organization) return;
    setSaving(true);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const response = await fetchApi('/admin/v1/management/organization', {
        method: 'PATCH',
        body: JSON.stringify({ ...values, version: organization.version }),
      });
      setOrganization(response.data as Organization);
      toast.success('تم حفظ إعدادات الأكاديمية');
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'تعذر حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton cards={3} />;
  if (!organization)
    return <ErrorState title="تعذر تحميل الإعدادات" description={error} onRetry={load} />;

  return (
    <div className="max-w-3xl space-y-5" dir="rtl">
      <PageHeader
        eyebrow="إعدادات النظام"
        title="الأكاديمية"
        description="الإعدادات الأساسية المستخدمة في التواريخ والأسعار والتقارير."
      />
      <form className="space-y-5 border-y border-border py-6" onSubmit={save}>
        <Input name="name" label="اسم الأكاديمية" defaultValue={organization.name} required />
        <Input label="المعرف الثابت" value={organization.slug} directionMode="ltr" disabled />
        <Select name="timezone" label="المنطقة الزمنية" defaultValue={organization.timezone}>
          <option value="Africa/Cairo">Africa/Cairo</option>
          <option value="Asia/Riyadh">Asia/Riyadh</option>
          <option value="UTC">UTC</option>
        </Select>
        <Select name="currency" label="العملة" defaultValue={organization.currency}>
          <option value="EGP">EGP · جنيه مصري</option>
          <option value="SAR">SAR · ريال سعودي</option>
          <option value="USD">USD · دولار أمريكي</option>
        </Select>
        <Input name="paymentInstapay" label="حساب InstaPay" defaultValue={organization.paymentInstapay || ''} directionMode="ltr" />
        <Input name="paymentWallet" label="رقم المحفظة الإلكترونية (فودافون كاش، اتصالات، أورانج)" defaultValue={organization.paymentWallet || ''} directionMode="ltr" />
        <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
          <span className="text-sm text-ink-3">الحالة الحالية: {organization.status}</span>
          <Button type="submit" loading={saving}>
            حفظ الإعدادات
          </Button>
        </div>
      </form>
    </div>
  );
}
