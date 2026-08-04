'use client';

import type { ReactNode } from 'react';

export function MagneticButton({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`magnetic-btn ${className}`}>{children}</span>;
}
