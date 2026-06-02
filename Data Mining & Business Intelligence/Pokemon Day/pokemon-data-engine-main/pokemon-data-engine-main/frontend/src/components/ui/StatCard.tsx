'use client';

import React from 'react';

interface StatCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly icon?: React.ReactNode;
  readonly trend?: string;
  readonly trendUp?: boolean;
  readonly loading?: boolean;
  readonly accent?: boolean;
}

/* Colour palette per card variant */
const ACCENT_PALETTE = {
  true: {
    border: 'rgba(239,68,68,0.6)',
    glow:   '0 0 28px rgba(239,68,68,0.3), 0 4px 16px rgba(0,0,0,0.5)',
    bar:    '#EF4444',
    barBg:  'rgba(239,68,68,0.15)',
    label:  'rgba(255,160,160,0.8)',
    bg:     'linear-gradient(145deg, rgba(40,10,10,0.95) 0%, rgba(25,8,8,0.98) 100%)',
    stripe: 'rgba(239,68,68,0.04)',
  },
  false: {
    border: 'rgba(255,255,255,0.1)',
    glow:   '0 4px 16px rgba(0,0,0,0.4)',
    bar:    '#6890F0',
    barBg:  'rgba(104,144,240,0.12)',
    label:  'var(--pk-text-muted)',
    bg:     'linear-gradient(145deg, rgba(18,22,40,0.97) 0%, rgba(10,14,26,0.99) 100%)',
    stripe: 'rgba(255,255,255,0.02)',
  },
};

export function StatCard({ label, value, icon, trend, trendUp, loading = false, accent = false }: StatCardProps) {
  const p = ACCENT_PALETTE[String(accent) as 'true' | 'false'];

  /* Derive a fill % from numeric values for the bottom bar */
  const numVal = typeof value === 'number' ? value
    : typeof value === 'string' ? parseFloat(value.replace('%', ''))
    : NaN;
  const fillPct = isNaN(numVal) ? 0
    : value.toString().includes('%') ? Math.min(numVal, 100)
    : Math.min((numVal / 500) * 100, 100); // scale 0-500 for counts

  return (
    <div
      style={{
        position: 'relative',
        padding: 'clamp(0.875rem, 2vw, 1.25rem)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        background: p.bg,
        border: `1px solid ${p.border}`,
        borderRadius: '0.625rem',
        boxShadow: p.glow,
        overflow: 'hidden',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Diagonal stripe texture */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `repeating-linear-gradient(45deg, transparent, transparent 12px, ${p.stripe} 12px, ${p.stripe} 13px)`,
      }} />

      {/* Corner brackets — pixel art style */}
      {(['top-left','top-right','bottom-left','bottom-right'] as const).map((pos) => {
        const isTop    = pos.startsWith('top');
        const isLeft   = pos.endsWith('left');
        return (
          <div key={pos} aria-hidden="true" style={{
            position: 'absolute',
            top:    isTop    ? '5px' : undefined,
            bottom: !isTop   ? '5px' : undefined,
            left:   isLeft   ? '5px' : undefined,
            right:  !isLeft  ? '5px' : undefined,
            width: '8px', height: '8px',
            borderTop:    isTop    ? `2px solid ${p.border}` : undefined,
            borderBottom: !isTop   ? `2px solid ${p.border}` : undefined,
            borderLeft:   isLeft   ? `2px solid ${p.border}` : undefined,
            borderRight:  !isLeft  ? `2px solid ${p.border}` : undefined,
          }} />
        );
      })}

      {/* Header row: label + icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <span style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: '0.42rem',
          color: p.label,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
        {icon && <span style={{ opacity: 0.75, flexShrink: 0 }}>{icon}</span>}
      </div>

      {/* Main value */}
      {loading ? (
        <div style={{
          height: '2rem', width: '5rem', borderRadius: '0.25rem',
          background: 'rgba(255,255,255,0.07)',
          animation: 'pokemon-pulse 1.2s ease-in-out infinite',
        }} />
      ) : (
        <span style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 'clamp(1.1rem, 2.5vw, 1.6rem)',
          fontWeight: 800,
          color: accent ? '#ffffff' : 'var(--pk-text)',
          letterSpacing: '-0.01em',
          position: 'relative', zIndex: 1,
          textShadow: accent ? '0 0 16px rgba(239,68,68,0.4)' : 'none',
        }}>
          {value}
        </span>
      )}

      {/* Trend */}
      {trend && (
        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: trendUp ? '#4ADE80' : '#F87171', position: 'relative', zIndex: 1 }}>
          {trend}
        </span>
      )}

      {/* Bottom HP-bar strip */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '3px',
        background: p.barBg,
      }}>
        {!loading && (
          <div style={{
            height: '100%',
            width: `${fillPct}%`,
            background: p.bar,
            boxShadow: `0 0 6px ${p.bar}88`,
            transition: 'width 1s ease-out',
          }} />
        )}
      </div>
    </div>
  );
}
