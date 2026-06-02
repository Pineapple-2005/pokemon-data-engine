'use client';

import React from 'react';

interface ScoreBreakdown {
  readonly tcs: number;
  readonly sas: number;
  readonly rs: number;
  readonly knn: number;
  readonly dt: number;
}

interface CounterScoreBarProps {
  readonly score: number;
  readonly breakdown: ScoreBreakdown;
  readonly rank: number;
}

const SEGMENTS: { key: keyof ScoreBreakdown; label: string; color: string }[] = [
  { key: 'tcs', label: 'TCS', color: '#EF4444' },
  { key: 'sas', label: 'SAS', color: '#F08030' },
  { key: 'rs',  label: 'RS',  color: '#F8D030' },
  { key: 'knn', label: 'KNN', color: '#78C850' },
  { key: 'dt',  label: 'DT',  color: '#6890F0' },
];

export function CounterScoreBar({ score, breakdown, rank }: CounterScoreBarProps) {
  const displayScore = score > 1 ? score : score * 100;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
        <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)' }}>#{rank}</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--pk-text)' }}>
          {displayScore.toFixed(1)}%
        </span>
      </div>

      {/* Main bar */}
      <div style={{ height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '5px', overflow: 'hidden', marginBottom: '0.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
        <progress
          value={Math.min(displayScore, 100)}
          max={100}
          aria-label={`Counter score ${displayScore.toFixed(1)}%`}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        />
        <div
          aria-hidden="true"
          style={{
            height: '100%',
            width: `${Math.min(displayScore, 100)}%`,
            background: 'linear-gradient(90deg, #EF4444, #F08030)',
            boxShadow: '0 0 8px rgba(239,68,68,0.5)',
            borderRadius: '5px',
            transition: 'width 0.7s ease-out',
          }}
        />
      </div>

      {/* Breakdown pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
        {SEGMENTS.map(({ key, label, color }) => {
          const v = breakdown[key];
          const pct = v > 1 ? v : v * 100;
          return (
            <span
              key={key}
              title={`${label}: ${pct.toFixed(1)}%`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                borderRadius: '0.25rem',
                padding: '0.1rem 0.4rem',
                fontSize: '0.6rem',
                fontWeight: 700,
                background: `${color}22`,
                color,
                border: `1px solid ${color}44`,
                fontFamily: 'var(--font-body)',
              }}
            >
              {label} {pct.toFixed(0)}%
            </span>
          );
        })}
      </div>
    </div>
  );
}
