'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Headphones, MessageSquareText, Send } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  PageHeader,
  PageIntro,
  PageSkeleton,
  Textarea,
} from '@bahrawy/ui';
import { fetchApi } from '../../../lib/api';

type SupportTicket = {
  id: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
};

export default function StudentSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadTickets = () =>
    fetchApi('/support').then((response) => setTickets(response.data || []));
  useEffect(() => {
    loadTickets()
      .catch(() => setError('تعذر تحميل التذاكر. حاول مرة أخرى.'))
      .finally(() => setLoading(false));
  }, []);

  const handleCreateTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setCreating(true);
    try {
      await fetchApi('/support', {
        method: 'POST',
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim(),
        }),
      });
      setSubject('');
      setDescription('');
      setSuccess('تم إرسال تذكرتك بنجاح، ويمكنك متابعة حالتها هنا.');
      await loadTickets();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'فشل إرسال التذكرة. حاول مرة أخرى.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <PageSkeleton cards={3} />;

  return (
    <PageIntro className="min-w-0 space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="نحن معك"
        title="الدعم الفني"
        description="اشرح المشكلة بوضوح، وسيتابع فريق الأكاديمية طلبك من نفس الصفحة."
      />
      <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card tone="cyan">
          <CardContent className="pt-5 sm:pt-6">
            <div className="mb-6 flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-white">
                <Headphones className="size-6" />
              </span>
              <div className="min-w-0">
                <h2 className="font-heading text-xl font-black">تذكرة جديدة</h2>
                <p className="mt-1 text-sm text-text-muted">
                  أضف عنواناً مختصراً وتفاصيل تساعدنا نفهم المشكلة.
                </p>
              </div>
            </div>
            {error && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm font-bold text-danger"
              >
                {error}
              </div>
            )}
            {success && (
              <div
                role="status"
                className="mb-5 flex gap-2 rounded-xl border border-success/20 bg-success/10 p-4 text-sm font-bold text-success"
              >
                <CheckCircle2 className="size-5" />
                {success}
              </div>
            )}
            <form onSubmit={handleCreateTicket} className="space-y-5">
              <Input
                label="موضوع المشكلة"
                placeholder="مثال: الفيديو لا يعمل في الدرس الثالث"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                disabled={creating}
                required
              />
              <Textarea
                label="التفاصيل"
                placeholder="اكتب ما حدث والخطوات التي جربتها..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={creating}
                required
              />
              <Button
                type="submit"
                className="w-full"
                loading={creating}
                loadingText="جاري الإرسال..."
                leadingIcon={<Send className="size-4" />}
              >
                إرسال التذكرة
              </Button>
            </form>
          </CardContent>
        </Card>
        <section>
          <div className="mb-4">
            <h2 className="ba-heading text-2xl">طلباتك السابقة</h2>
            <p className="mt-1 text-sm text-text-muted">تابع حالة كل مشكلة من هنا.</p>
          </div>
          {tickets.length === 0 ? (
            <EmptyState
              icon={<MessageSquareText className="size-7" />}
              title="لا توجد تذاكر حتى الآن"
              description="لو كل شيء يعمل جيداً، فهذا أفضل خبر."
            />
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <Card key={ticket.id}>
                  <CardContent className="min-w-0 px-4 pt-5 sm:px-6 sm:pt-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="font-heading text-lg font-black">{ticket.subject}</h3>
                        <p className="mt-2 line-clamp-2 text-sm text-text-muted">
                          {ticket.description}
                        </p>
                      </div>
                      <Badge tone={ticket.status === 'OPEN' ? 'amber' : 'success'}>
                        {ticket.status === 'OPEN' ? (
                          <>
                            <Clock3 className="size-3.5" /> قيد المتابعة
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="size-3.5" /> تم الحل
                          </>
                        )}
                      </Badge>
                    </div>
                    <p className="ba-number mt-4 text-xs text-text-muted">
                      {new Date(ticket.createdAt).toLocaleDateString('ar-EG')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageIntro>
  );
}
