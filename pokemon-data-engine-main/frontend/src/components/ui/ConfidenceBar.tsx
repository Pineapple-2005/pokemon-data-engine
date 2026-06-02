'use client';

import React from 'react';

interface ConfidenceBarProps {
  readonly value: number; // 0–1 or 0–100
  readonly label?: string;
  readonly showPercent?: boolean;
  readonly height?: 'sm' | 'md' | 'lg';
  readonly color?: 'red' | 'green' | 'blue' | 'auto';
}

export function ConfidenceBar({
  value,
  label,
  showPercent = true,
  height = 'md',
  color = 'auto',
}: ConfidenceBarProps) {
  // Normalize 0–1 to 0–100
  const pct = value > 1 ? Math.min(value, 100) : Math.min(value * 100, 100);

  /* GBA-accurate colour thresholds — exactly as they appear in the games */
  function getGbaClass(): string {
    if (color === 'red') return 'hp-gba-low';
    if (color === 'green') return 'hp-gba-high';
    if (color === 'blue') return ''; // override via inline style
    if (pct >= 50) return 'hp-gba-high';
    if (pct >= 20) return 'hp-gba-mid';
    return 'hp-gba-low';
  }

  const trackHeight = { sm: '6px', md: '6px', lg: '8px' }[height];

  const blueStyle: React.CSSProperties =
    color === 'blue'
      ? { background: '#6890F0', boxShadow: '0 0 4px rgba(104,144,240,0.8)' }
      : {};

  return (
    <div className="hp-bar-gba" style={{ width: '100%' }}>
      {(label || showPercent) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
          {label ? (
            <span className="hp-bar-gba-label">{label}</span>
          ) : (
            /* "HP" label — game-accurate left-aligned tag */
            <span className="hp-bar-gba-label">HP</span>
          )}
          {showPercent && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--pk-text)', fontFamily: 'var(--font-body)' }}>
              {pct.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {/* GBA HP track — pixel-sharp, no border-radius */}
      <div className="hp-bar-gba-track" style={{ height: trackHeight }}>
        {/* Hidden accessible progress element */}
        <progress
          value={pct}
          max={100}
          aria-label={label ?? 'HP'}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            display: 'block',
            width: '100%',
            height: '100%',
            border: 'none',
            background: 'transparent',
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
        {/* Visible bar */}
        <div
          className={`hp-bar-gba-fill ${getGbaClass()}`}
          style={{ width: `${pct}%`, ...blueStyle }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
