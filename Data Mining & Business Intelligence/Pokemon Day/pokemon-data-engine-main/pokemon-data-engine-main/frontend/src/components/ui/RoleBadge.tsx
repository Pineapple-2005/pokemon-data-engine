'use client';

import React from 'react';

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  sweeper:     { bg: 'rgba(220,38,38,0.25)',  color: '#FCA5A5' },
  tank:        { bg: 'rgba(59,130,246,0.25)', color: '#93C5FD' },
  support:     { bg: 'rgba(34,197,94,0.2)',   color: '#86EFAC' },
  wall:        { bg: 'rgba(148,163,184,0.2)', color: '#CBD5E1' },
  balanced:    { bg: 'rgba(168,85,247,0.2)',  color: '#D8B4FE' },
  pivot:       { bg: 'rgba(168,85,247,0.2)',  color: '#D8B4FE' },
  lead:        { bg: 'rgba(249,115,22,0.2)',  color: '#FDBA74' },
  cleaner:     { bg: 'rgba(236,72,153,0.2)',  color: '#F9A8D4' },
  mixed:       { bg: 'rgba(234,179,8,0.2)',   color: '#FDE047' },
  wallbreaker: { bg: 'rgba(220,38,38,0.3)',   color: '#FCA5A5' },
  'speed control': { bg: 'rgba(6,182,212,0.2)', color: '#67E8F9' },
};

interface RoleBadgeProps {
  readonly role: string;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const key = role.toLowerCase();
  const style = ROLE_COLORS[key] ?? { bg: 'rgba(255,255,255,0.1)', color: 'var(--pk-text-muted)' };

  return (
    <span
      style={{
        display: 'inline-block',
        borderRadius: '0.25rem',
        padding: '0.15rem 0.5rem',
        fontSize: '0.6rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.color}44`,
        fontFamily: 'var(--font-body)',
        whiteSpace: 'nowrap',
      }}
    >
      {role}
    </span>
  );
}
