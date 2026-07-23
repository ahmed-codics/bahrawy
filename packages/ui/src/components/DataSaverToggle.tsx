'use client';
import { useEffect, useState } from 'react';
import { Gauge, GaugeCircle } from 'lucide-react';

export function DataSaverToggle() {
  const [dataSaver, setDataSaver] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('data-saver') === 'true';
    setDataSaver(saved);
  }, []);

  const toggle = () => {
    const next = !dataSaver;
    setDataSaver(next);
    localStorage.setItem('data-saver', next ? 'true' : 'false');
  };

  if (!mounted) {
    return <div className="ba-skeleton size-11 rounded-xl" aria-hidden="true" />;
  }

  return (
    <button
      onClick={toggle}
      className={`flex size-11 items-center justify-center rounded-xl border transition duration-200 ${dataSaver ? 'border-success/25 bg-success/10 text-success' : 'border-transparent text-text-muted hover:border-border-default hover:bg-surface-soft hover:text-text-primary'}`}
      aria-label={dataSaver ? 'توفير البيانات مفعل' : 'تفعيل توفير البيانات'}
      title={dataSaver ? 'توفير البيانات مفعل' : 'تفعيل توفير البيانات'}
    >
      {dataSaver ? (
        <GaugeCircle className="size-5" aria-hidden="true" />
      ) : (
        <Gauge className="size-5" aria-hidden="true" />
      )}
    </button>
  );
}
