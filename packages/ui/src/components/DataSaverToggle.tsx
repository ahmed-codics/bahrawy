'use client';
import { Gauge, GaugeCircle } from 'lucide-react';
import { useDataSaver } from './DataSaverProvider';

export function DataSaverToggle() {
  const { enabled, toggle } = useDataSaver();

  return (
    <button
      onClick={toggle}
      type="button"
      className={`flex size-11 shrink-0 items-center justify-center rounded-xl border transition duration-200 ${enabled ? 'border-success/25 bg-success/10 text-success' : 'border-transparent text-text-muted hover:border-border-default hover:bg-surface-soft hover:text-text-primary'}`}
      aria-pressed={enabled}
      aria-label={enabled ? 'إيقاف توفير البيانات' : 'تفعيل توفير البيانات'}
      title={enabled ? 'توفير البيانات مفعل' : 'تفعيل توفير البيانات'}
    >
      {enabled ? (
        <GaugeCircle className="size-5" aria-hidden="true" />
      ) : (
        <Gauge className="size-5" aria-hidden="true" />
      )}
    </button>
  );
}
