import { BookOpenCheck } from 'lucide-react';

export function PremiumBrand() {
  return (
    <span className="academy-premium-brand">
      <span className="academy-premium-brand-icon" aria-hidden="true">
        <BookOpenCheck />
        <span className="academy-premium-brand-icon-shine" />
      </span>
      <span className="academy-premium-brand-copy">
        <span className="academy-premium-brand-name-row">
          <span className="academy-premium-brand-name">البحراوي</span>
          <span className="academy-premium-brand-status" aria-hidden="true" />
        </span>
      </span>
    </span>
  );
}
