'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, LockKeyhole, Mail } from 'lucide-react';
import { BrandMark, Button, Card, Input } from '@bahrawy/ui';
import { fetchApi, fetchCsrfToken } from '../../lib/api';

export default function StaffLoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await fetchCsrfToken();
      const response = await fetchApi('/auth/staff-login', {
        method: 'POST',
        body: JSON.stringify({
          email: identifier,
          password,
        }),
      });
      await fetchCsrfToken();
      if (response?.mustChangePassword) return router.push('/change-password');
      if (response?.kind === 'STAFF') return router.push('/dashboard');
      setError('This account is not authorized for the staff portal.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const fillDev = () => {
    setIdentifier('admin@bahrawy.test');
    setPassword('owner_secret');
  };

  return (
    <main className="flex min-h-dvh items-start justify-center bg-canvas px-6 py-16">
      <div className="ba-page w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BrandMark admin />
        </div>
        <Card className="p-8 shadow-[var(--shadow-sm)]">
          <h1 className="font-heading text-2xl font-bold text-ink">Staff sign in</h1>
          <p className="mb-6 mt-1 text-sm text-ink-3">
            Use your staff email and password to continue.
          </p>
          <form onSubmit={login} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="flex gap-3 rounded-[var(--radius-md)] border border-danger/20 bg-[var(--color-danger-bg)] p-3 text-sm text-danger dark:bg-danger/10"
              >
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            )}
            <Input
              label="Email"
              type="email"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              required
              disabled={loading}
              directionMode="ltr"
              leadingIcon={<Mail className="size-4" />}
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
              directionMode="ltr"
              leadingIcon={<LockKeyhole className="size-4" />}
            />
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Sign in
            </Button>
          </form>
          {process.env.NODE_ENV !== 'production' && (
            <div className="mt-5 border-t border-border pt-5">
              <Button variant="outline" className="w-full" onClick={fillDev}>
                Fill development account
              </Button>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
