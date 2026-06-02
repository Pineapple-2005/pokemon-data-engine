'use client';

import React from 'react';

interface MatchupEntry {
  readonly advantage: string;
  readonly multiplier: number;
}

interface MatchupTableProps {
  readonly matchupTable: Record<string, MatchupEntry>;
  readonly opponentTeam: string[];
  readonly counterTeam: string[];
}

function getCellClass(multiplier: number): string {
  if (multiplier === 0) return 'matchup-cell-immune';
  if (multiplier >= 2) return 'matchup-cell-2x';
  if (multiplier < 1 && multiplier > 0) return 'matchup-cell-half';
  return '';
}

function getCellColor(multiplier: number): string {
  if (multiplier === 0) return 'var(--pk-text-dim)';
  if (multiplier >= 2) return '#86EFAC';
  if (multiplier >= 1.5) return '#FDE047';
  if (multiplier < 1) return '#FCA5A5';
  return 'var(--pk-text-muted)';
}

function getCellLabel(advantage: string, multiplier: number): string {
  if (multiplier === 0) return '✗';
  if (multiplier >= 2) return `${multiplier}×`;
  if (multiplier < 1) return `${multiplier}×`;
  return `${multiplier}×`;
}

export function MatchupTable({ matchupTable, opponentTeam, counterTeam }: MatchupTableProps) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: '0.75rem', border: '1px solid var(--pk-glass-border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }} aria-label="Type matchup table">
        <thead>
          <tr style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid var(--pk-glass-border)' }}>
            <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', color: 'var(--pk-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.65rem', position: 'sticky', left: 0, background: 'var(--pk-bg-2)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
              Counter \ Opp.
            </th>
            {opponentTeam.map((opp) => (
              <th key={opp} style={{ padding: '0.625rem 0.75rem', textAlign: 'center', color: 'var(--pk-text-muted)', fontWeight: 700, textTransform: 'capitalize', fontSize: '0.65rem', whiteSpace: 'nowrap' }}>
                {opp}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {counterTeam.map((counter) => (
            <tr key={counter} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '0.5rem 0.875rem', fontWeight: 600, color: 'var(--pk-text)', textTransform: 'capitalize', position: 'sticky', left: 0, background: 'var(--pk-bg-2)', borderRight: '1px solid var(--pk-glass-border)', whiteSpace: 'nowrap' }}>
                {counter}
              </td>
              {opponentTeam.map((opp) => {
                const key = `${counter}_vs_${opp}`;
                const entry = matchupTable[key] ?? { advantage: 'neutral', multiplier: 1 };
                const cellClass = getCellClass(entry.multiplier);
                const cellColor = getCellColor(entry.multiplier);
                const cellLabel = getCellLabel(entry.advantage, entry.multiplier);
                return (
                  <td
                    key={opp}
                    title={`${entry.advantage} (${entry.multiplier}×)`}
                    className={cellClass}
                    style={{
                      padding: '0.5rem 0.75rem',
                      textAlign: 'center',
                      fontWeight: 700,
                      color: cellColor,
                      fontFamily: entry.multiplier >= 2 ? 'var(--font-pixel)' : 'var(--font-body)',
                      fontSize: entry.multiplier >= 2 ? '0.55rem' : '0.75rem',
                      transition: 'box-shadow 0.2s ease',
                    }}
                  >
                    {cellLabel}
                  </td>
                );
              })}
            </tr>
          ))}
          {counterTeam.length === 0 && (
            <tr>
              <td colSpan={opponentTeam.length + 1} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--pk-text-dim)' }}>
                No matchup data
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', padding: '0.5rem 0.875rem', borderTop: '1px solid var(--pk-glass-border)', background: 'rgba(255,255,255,0.02)' }}>
        {[
          { color: '#86EFAC', bg: 'rgba(78,200,78,0.2)', label: '2× — Super Effective', boxClass: 'matchup-cell-2x' },
          { color: 'var(--pk-text-muted)', bg: 'transparent', label: '1× — Neutral', boxClass: '' },
          { color: '#FCA5A5', bg: 'rgba(239,68,68,0.2)', label: '<1× — Resisted', boxClass: 'matchup-cell-half' },
          { color: 'var(--pk-text-dim)', bg: 'rgba(80,80,80,0.25)', label: '0× — Immune', boxClass: 'matchup-cell-immune' },
        ].map(({ color, bg, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.65rem', color: 'var(--pk-text-muted)' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: bg, border: `1px solid ${color}44`, display: 'inline-block', flexShrink: 0 }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
