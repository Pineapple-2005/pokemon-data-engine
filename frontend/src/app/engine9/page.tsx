'use client';

import React, { useState } from 'react';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PokemonAutocomplete } from '@/components/ui/PokemonAutocomplete';
import { api } from '@/lib/api';
import type { ScanResult, WeaknessEntry } from '@/types';

const TYPES_18 = [
  'Normal','Fire','Water','Electric','Grass','Ice',
  'Fighting','Poison','Ground','Flying','Psychic','Bug',
  'Rock','Ghost','Dragon','Dark','Steel','Fairy',
];

const TYPE_COLORS: Record<string, string> = {
  Normal:'#A8A878', Fire:'#F08030', Water:'#6890F0', Electric:'#F8D030',
  Grass:'#78C850', Ice:'#98D8D8', Fighting:'#C03028', Poison:'#A040A0',
  Ground:'#E0C068', Flying:'#A890F0', Psychic:'#F85888', Bug:'#A8B820',
  Rock:'#B8A038', Ghost:'#705898', Dragon:'#7038F8', Dark:'#705848',
  Steel:'#B8B8D0', Fairy:'#EE99AC',
};
const TEAM_SIZE_LIMIT = 4;

function TypeBadge({ type, variant = 'neutral' }: { type: string; variant?: 'weak' | 'neutral' | 'resist' | 'cover' | 'gap' | 'rec' }) {
  const bg =
    variant === 'weak'    ? 'rgba(239,68,68,0.15)' :
    variant === 'resist'  ? 'rgba(120,200,80,0.12)' :
    variant === 'rec'     ? 'rgba(248,208,48,0.12)' :
    variant === 'gap'     ? 'rgba(255,255,255,0.05)' :
    'rgba(255,255,255,0.06)';
  const border =
    variant === 'weak'    ? 'rgba(239,68,68,0.4)' :
    variant === 'resist'  ? 'rgba(120,200,80,0.35)' :
    variant === 'rec'     ? 'rgba(248,208,48,0.4)' :
    TYPE_COLORS[type] ? `${TYPE_COLORS[type]}44` : 'rgba(255,255,255,0.15)';
  const color =
    variant === 'weak'    ? '#EF4444' :
    variant === 'resist'  ? '#78C850' :
    variant === 'rec'     ? '#F8D030' :
    TYPE_COLORS[type] ?? 'var(--pk-text)';
  return (
    <span style={{
      display: 'inline-block',
      fontSize: '0.42rem', fontFamily: 'var(--font-pixel)',
      background: bg, border: `1px solid ${border}`,
      borderRadius: '0.3rem', padding: '0.2rem 0.55rem',
      color, letterSpacing: '0.06em',
    }}>
      {type.toUpperCase()}
    </span>
  );
}

function RadarChart({ profile }: { profile: WeaknessEntry[] }) {
  const cx = 200, cy = 200, r = 150;
  const n = TYPES_18.length;

  const points = profile.map((entry, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const plotR = Math.min(r, (entry.avg_multiplier / 4) * r);
    return {
      x: cx + plotR * Math.cos(angle),
      y: cy + plotR * Math.sin(angle),
      labelX: cx + (r + 20) * Math.cos(angle),
      labelY: cy + (r + 20) * Math.sin(angle),
      classification: entry.classification,
      type: entry.type,
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  const hasWeak = profile.some((e) => e.classification === 'weak');
  const allResist = profile.every((e) => e.classification === 'resist');
  const fillColor = hasWeak ? 'rgba(239,68,68,0.25)' : allResist ? 'rgba(120,200,80,0.2)' : 'rgba(104,144,240,0.2)';
  const strokeColor = hasWeak ? '#EF4444' : allResist ? '#78C850' : '#6890F0';

  const refCircles = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox="0 0 400 400" width="100%" style={{ maxWidth: '400px', display: 'block', margin: '0 auto' }} aria-label="Team weakness radar chart">
      {/* Reference circles */}
      {refCircles.map((frac) => (
        <circle key={frac} cx={cx} cy={cy} r={r * frac} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}

      {/* Axis lines */}
      {TYPES_18.map((_, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + r * Math.cos(angle)}
            y2={cy + r * Math.sin(angle)}
            stroke="rgba(255,255,255,0.08)" strokeWidth="1"
          />
        );
      })}

      {/* Data polygon */}
      <polygon points={polygonPoints} fill={fillColor} stroke={strokeColor} strokeWidth="1.5" strokeOpacity="0.8" />

      {/* Axis labels */}
      {points.map((p) => {
        const labelColor =
          p.classification === 'weak'   ? '#EF4444' :
          p.classification === 'resist' ? '#78C850' :
          'rgba(255,255,255,0.45)';
        return (
          <text
            key={p.type}
            x={p.labelX} y={p.labelY}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="8" fill={labelColor}
            fontFamily="var(--font-pixel)"
          >
            {p.type.slice(0, 4).toUpperCase()}
          </text>
        );
      })}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r="3" fill={strokeColor} opacity="0.6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Import helpers
// ---------------------------------------------------------------------------

function parseNamesFromText(raw: string): string[] {
  // Split by newlines then commas; strip whitespace/quotes; take first 4 non-empty
  const parts = raw
    .split(/[\n,]+/)
    .map((s) => s.trim().replace(/^["']|["']$/g, '').toLowerCase())
    .filter(Boolean);
  return parts.slice(0, TEAM_SIZE_LIMIT);
}

function parseNamesFromCsv(text: string): string[] {
  const lines = text.split('\n').filter((l) => l.trim());
  const names: string[] = [];
  for (const line of lines) {
    const cell = line.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
    if (cell) names.push(cell);
    if (names.length >= TEAM_SIZE_LIMIT) break;
  }
  return names;
}

// ---------------------------------------------------------------------------

export default function Engine9Page() {
  const [names, setNames] = useState<string[]>(Array(TEAM_SIZE_LIMIT).fill(''));
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'none' | 'paste'>('none');
  const [pasteText, setPasteText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function setName(i: number, val: string) {
    setNames((prev) => { const n = [...prev]; n[i] = val; return n; });
  }

  function applyImportedNames(parsed: string[]) {
    if (parsed.length === 0) { setImportError('No valid names found.'); return; }
    const next = Array(TEAM_SIZE_LIMIT).fill('');
    parsed.forEach((n, i) => { next[i] = n; });
    setNames(next);
    setImportMode('none');
    setPasteText('');
    setImportError(null);
  }

  function handlePasteApply() {
    const parsed = parseNamesFromText(pasteText);
    applyImportedNames(parsed);
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseNamesFromCsv(text);
      applyImportedNames(parsed);
    };
    reader.readAsText(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  }

  async function handleScan() {
    const filled = names.filter(Boolean);
    if (filled.length === 0) { setError('Enter at least 1 Pokemon name.'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await api.scanTeam(filled);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  }

  const weakTypes   = result?.weakness_profile.filter((e) => e.classification === 'weak')   ?? [];
  const resistTypes = result?.weakness_profile.filter((e) => e.classification === 'resist') ?? [];

  return (
    <AuthGuard>
      <div className="pk-section">

        {/* Header */}
        <header style={{ marginBottom: 'clamp(1.25rem, 3vw, 1.75rem)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.12em' }}>
              ENGINE 09 | ANALYTICS
            </span>
          </div>
          <h1 style={{ margin: '0 0 0.3rem', fontSize: 'clamp(1.3rem,3vw,2rem)', fontWeight: 900, color: 'var(--pk-text)' }}>
            The Scanner
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--pk-text-muted)' }}>
            Analyze your team's weakness profile across all 18 types.
          </p>
        </header>

        {/* Team input */}
        <div style={{
          background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '0.875rem', padding: '1.25rem', marginBottom: '1.25rem',
        }}>
          {/* Header row with import toggles */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <p style={{ margin: 0, fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.08em' }}>
              ◆ ENTER YOUR TEAM (up to 4 Pokemon)
            </p>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                style={{ display: 'none' }}
                onChange={handleCsvFile}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '0.25rem 0.6rem',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '0.35rem',
                  color: 'rgba(255,255,255,0.55)',
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '0.38rem',
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                }}
              >
                ↑ CSV
              </button>
              <button
                type="button"
                onClick={() => setImportMode((m) => m === 'paste' ? 'none' : 'paste')}
                style={{
                  padding: '0.25rem 0.6rem',
                  background: importMode === 'paste' ? 'rgba(104,144,240,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${importMode === 'paste' ? 'rgba(104,144,240,0.4)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: '0.35rem',
                  color: importMode === 'paste' ? '#6890F0' : 'rgba(255,255,255,0.55)',
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '0.38rem',
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                }}
              >
                ✎ PASTE
              </button>
            </div>
          </div>

          {/* Paste text panel */}
          {importMode === 'paste' && (
            <div style={{
              background: 'rgba(104,144,240,0.04)',
              border: '1px solid rgba(104,144,240,0.2)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              marginBottom: '0.875rem',
            }}>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.38rem', fontFamily: 'var(--font-pixel)', color: 'rgba(104,144,240,0.7)', letterSpacing: '0.08em' }}>
                PASTE NAMES — comma or newline separated (up to 4)
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={'pikachu, charizard, mewtwo\nor one per line'}
                rows={3}
                style={{
                  width: '100%',
                  background: '#0a0e1a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '0.375rem',
                  color: 'var(--pk-text)',
                  fontSize: '0.78rem',
                  fontFamily: 'monospace',
                  padding: '0.5rem 0.6rem',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {importError && (
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.7rem', color: '#EF4444' }}>{importError}</p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handlePasteApply}
                  disabled={!pasteText.trim()}
                  style={{
                    padding: '0.3rem 0.75rem',
                    background: pasteText.trim() ? 'rgba(104,144,240,0.18)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(104,144,240,0.35)',
                    borderRadius: '0.35rem',
                    color: pasteText.trim() ? '#6890F0' : 'rgba(255,255,255,0.25)',
                    fontFamily: 'var(--font-pixel)',
                    fontSize: '0.38rem',
                    letterSpacing: '0.08em',
                    cursor: pasteText.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  APPLY
                </button>
                <button
                  type="button"
                  onClick={() => { setImportMode('none'); setPasteText(''); setImportError(null); }}
                  style={{
                    padding: '0.3rem 0.75rem',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '0.35rem',
                    color: 'rgba(255,255,255,0.35)',
                    fontFamily: 'var(--font-pixel)',
                    fontSize: '0.38rem',
                    letterSpacing: '0.08em',
                    cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {names.map((name, i) => (
              <PokemonAutocomplete
                key={i}
                id={`e9-slot-${i}`}
                label={`POKEMON ${i + 1}`}
                value={name}
                onChange={(val) => setName(i, val)}
                onSelect={(pokemon) => setName(i, pokemon.name)}
                placeholder="e.g. pikachu"
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => { void handleScan(); }}
            disabled={loading || names.every((n) => !n)}
            style={{
              padding: '0.75rem 2rem',
              background: loading ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #8B0000, #DC2626)',
              border: '2px solid rgba(239,68,68,0.5)',
              borderRadius: '0.625rem',
              color: '#fff',
              fontFamily: 'var(--font-pixel)',
              fontSize: '0.6rem',
              letterSpacing: '0.1em',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            {loading ? <><LoadingSpinner size="sm" /><span>ANALYZING WEAKNESSES...</span></> : 'SCAN TEAM'}
          </button>
        </div>

        {error && (
          <div role="alert" style={{
            background: '#2a0505', border: '2px solid rgba(239,68,68,0.5)',
            borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem',
          }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#EF4444' }}>{error}</p>
          </div>
        )}

        {result && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>

            {/* Radar chart */}
            <div style={{
              background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '0.875rem', padding: '1.25rem',
            }}>
              <p style={{ margin: '0 0 0.875rem', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.08em' }}>
                ◆ WEAKNESS RADAR
              </p>
              <RadarChart profile={result.weakness_profile} />
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.75rem' }}>
                {[['#EF4444','WEAK'],['rgba(255,255,255,0.4)','NEUTRAL'],['#78C850','RESIST']].map(([c,l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                    <span style={{ fontSize: '0.38rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.06em' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coverage audit */}
            <div style={{
              background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '0.875rem', padding: '1.25rem',
              display: 'flex', flexDirection: 'column', gap: '1rem',
            }}>
              {/* Team status */}
              <div>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.46rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.08em' }}>
                  ◆ TEAM
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {result.team.map((t) => (
                    <span key={t.name} style={{
                      fontSize: '0.72rem', padding: '0.2rem 0.55rem',
                      background: t.found ? 'rgba(120,200,80,0.08)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${t.found ? 'rgba(120,200,80,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      borderRadius: '0.3rem', color: t.found ? '#78C850' : '#EF4444',
                    }}>
                      {t.name}{!t.found && ' ?'}
                    </span>
                  ))}
                </div>
              </div>

              {weakTypes.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.46rem', fontFamily: 'var(--font-pixel)', color: '#EF4444', letterSpacing: '0.08em' }}>
                    ▲ WEAKNESSES
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {weakTypes.map((e) => <TypeBadge key={e.type} type={e.type} variant="weak" />)}
                  </div>
                </div>
              )}

              {resistTypes.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.46rem', fontFamily: 'var(--font-pixel)', color: '#78C850', letterSpacing: '0.08em' }}>
                    ▼ RESISTANCES
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {resistTypes.map((e) => <TypeBadge key={e.type} type={e.type} variant="resist" />)}
                  </div>
                </div>
              )}

              <div>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.46rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.08em' }}>
                  ◆ OFFENSIVE COVERAGE
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {result.offensive_coverage.map((t) => <TypeBadge key={t} type={t} variant="cover" />)}
                </div>
              </div>

              {result.uncovered_types.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.46rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.08em' }}>
                    ◆ COVERAGE GAPS
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {result.uncovered_types.map((t) => <TypeBadge key={t} type={t} variant="gap" />)}
                  </div>
                </div>
              )}

              {result.recommended_cover.length > 0 && (
                <div style={{
                  background: 'rgba(248,208,48,0.05)', border: '1px solid rgba(248,208,48,0.2)',
                  borderRadius: '0.625rem', padding: '0.75rem',
                }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.46rem', fontFamily: 'var(--font-pixel)', color: '#F8D030', letterSpacing: '0.08em' }}>
                    ★ RECOMMENDED ADDITIONS
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {result.recommended_cover.map((t) => <TypeBadge key={t} type={t} variant="rec" />)}
                  </div>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: 'var(--pk-text-muted)' }}>
                    Adding a Pokemon with {result.recommended_cover.join(' or ')} typing would improve coverage.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
