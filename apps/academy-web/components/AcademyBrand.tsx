import { BookOpenCheck } from 'lucide-react';

export function AcademyBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="academy-brand">
      <span className="academy-brand-icon" aria-hidden="true">
        <BookOpenCheck />
      </span>
      {!compact && (
        <span>
          <span className="academy-brand-name">أكاديمية السيد البحراوي</span>
          <span className="academy-brand-tagline" dir="ltr" lang="en">
            LEARN · PRACTICE · MASTER
          </span>
        </span>
      )}
    </span>
  );
}
