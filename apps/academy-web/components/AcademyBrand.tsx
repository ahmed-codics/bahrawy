import { BookOpenCheck } from 'lucide-react';

export function AcademyBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="academy-brand">
      <span className="academy-brand-icon" aria-hidden="true">
        <BookOpenCheck />
      </span>
      {!compact && (
        <span>
          <span
            className="academy-brand-name"
            style={{ fontFamily: 'var(--font-marhey), sans-serif', fontSize: '1.25rem' }}
          >
            البحراوي
          </span>
        </span>
      )}
    </span>
  );
}
