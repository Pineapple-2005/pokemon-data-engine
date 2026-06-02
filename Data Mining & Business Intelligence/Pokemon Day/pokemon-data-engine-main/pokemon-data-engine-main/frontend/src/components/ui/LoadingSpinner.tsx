'use client';

import React from 'react';

interface LoadingSpinnerProps {
  readonly size?: 'sm' | 'md' | 'lg';
  readonly label?: string;
}

export function LoadingSpinner({ size = 'md', label = 'Loading...' }: LoadingSpinnerProps) {
  const dim = { sm: 20, md: 40, lg: 56 }[size];
  const strokeW = size === 'sm' ? 3 : 4;

  return (
    <output className="flex flex-col items-center justify-center gap-3" aria-label={label}>
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 40 40"
        aria-hidden="true"
        style={{ animation: 'pokeball-spin 0.9s linear infinite' }}
      >
        <path d="M4 20 A16 16 0 0 1 36 20" fill="#DC2626" stroke="#111" strokeWidth={strokeW * 0.4} />
        <path d="M36 20 A16 16 0 0 1 4 20" fill="#F8FAFC" stroke="#111" strokeWidth={strokeW * 0.4} />
        <line x1="4" y1="20" x2="36" y2="20" stroke="#111" strokeWidth={strokeW * 0.5} />
        <circle cx="20" cy="20" r="4.5" fill="#111" />
        <circle cx="20" cy="20" r="2.5" fill="#F8FAFC" />
      </svg>
      {size !== 'sm' && (
        <span
          style={{
            fontSize: '0.65rem',
            fontFamily: 'var(--font-pixel)',
            color: 'var(--pk-text-muted)',
            letterSpacing: '0.03em',
            textAlign: 'center',
            maxWidth: '180px',
          }}
        >
          {label}
        </span>
      )}
    </output>
  );
}
