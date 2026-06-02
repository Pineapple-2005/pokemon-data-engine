'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ProfessorOak } from '@/components/ui/ProfessorOak';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { api } from '@/lib/api';
import type { PredictionWithResult } from '@/types';

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ts; }
}

function csvCorrect(val: number | null | undefined): string {
  if (val == null) return 'pending';
  return val === 1 ? 'yes' : 'no';
}

function downloadCSV(data: PredictionWithResult[]) {
  const headers = ['Match ID', 'Battler A', 'Battler B', 'Predicted Winner', 'Confidence', 'Actual Winner', 'Correct', 'Replay', 'Timestamp'];
  const rows = data.map((b) => [
    b.match_id, b.battler_a, b.battler_b, b.predicted_winner,
    b.confidence_score > 1 ? b.confidence_score.toFixed(1) : (b.confidence_score * 100).toFixed(1),
    b.actual_winner ?? '',
    csvCorrect(b.correct_prediction),
    b.replay_link ?? '', b.predicted_at,
  ]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `battle_history_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

/* ── Spinning Pokéball SVG ──────────────────────────────────── */
function SpinningPokeball() {
  return (
    <svg width="10" height="10" viewBox="0 0 40 40" aria-hidden="true" style={{ animation: 'pokeball-spin 1.5s linear infinite' }}>
      <path d="M4 20 A16 16 0 0 1 36 20" fill="#6B7280" />
      <path d="M36 20 A16 16 0 0 1 4 20" fill="#374151" />
      <line x1="4" y1="20" x2="36" y2="20" stroke="#111" strokeWidth="3" />
      <circle cx="20" cy="20" r="4" fill="#111" />
    </svg>
  );
}

/* ── Result stamp ──────────────────────────────────────────── */
function ResultStamp({ b }: { readonly b: PredictionWithResult }) {
  if (b.actual_winner == null) {
    return (
      <span className="pk-stamp-pending">
        <SpinningPokeball />
        PENDING
      </span>
    );
  }
  if (b.correct_prediction === 1) {
    return <span className="pk-stamp-correct">★ CORRECT</span>;
  }
  return <span className="pk-stamp-wrong">✗ WRONG</span>;
}

/* ── Confidence display ──────────────────────────────────────── */
function confidenceColor(pct: number): string {
  if (pct >= 75) return '#4ADE80';
  if (pct >= 55) return '#F8D030';
  return '#F87171';
}

function ConfidenceDisplay({ score }: { readonly score: number }) {
  const pct = score > 1 ? score : score * 100;
  const color = confidenceColor(pct);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.52rem', color, letterSpacing: '0.04em', fontWeight: 700 }}>{pct.toFixed(1)}%</span>
      <div style={{ height: '4px', width: '56px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, transition: 'width 0.6s ease-out' }} />
      </div>
    </div>
  );
}

/* ── Battle record card ─────────────────────────────────────── */
function battleCardClass(b: PredictionWithResult): string {
  if (b.actual_winner == null) return 'pk-battle-card card-pending';
  if (b.correct_prediction === 1) return 'pk-battle-card card-correct';
  return 'pk-battle-card card-wrong';
}

function BattleCard({ b, idx, total }: { readonly b: PredictionWithResult; readonly idx: number; readonly total: number }) {
  const cardClass = battleCardClass(b);

  return (
    <div className={cardClass}>
      {/* Card header — battle number + timestamp */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.4rem', color: 'var(--pk-text-dim)', letterSpacing: '0.06em' }}>
          BATTLE #{String(total - idx).padStart(3, '0')}
        </span>
        <span style={{ fontSize: '0.68rem', color: 'var(--pk-text-dim)' }}>{formatTimestamp(b.predicted_at)}</span>
      </div>

      {/* Main content — 3-column: Trainer A | VS | Trainer B */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        {/* Trainer A */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="pk-trainer-chip team-a">{b.battler_a}</span>
          <p style={{ margin: '0.25rem 0 0', fontFamily: 'var(--font-pixel)', fontSize: '0.35rem', color: 'rgba(239,68,68,0.55)', letterSpacing: '0.06em' }}>
            TEAM A
          </p>
        </div>

        {/* VS center */}
        <div className="pk-vs-center">
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.6rem', color: 'var(--pk-text-dim)', letterSpacing: '0.08em' }}>VS</span>
          <ResultStamp b={b} />
        </div>

        {/* Trainer B */}
        <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
          <span className="pk-trainer-chip team-b">{b.battler_b}</span>
          <p style={{ margin: '0.25rem 0 0', fontFamily: 'var(--font-pixel)', fontSize: '0.35rem', color: 'rgba(104,144,240,0.55)', letterSpacing: '0.06em', textAlign: 'right' }}>
            TEAM B
          </p>
        </div>
      </div>

      {/* Footer — prediction, confidence, actual result, replay */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', paddingTop: '0.625rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <p style={{ margin: '0 0 0.2rem', fontFamily: 'var(--font-pixel)', fontSize: '0.35rem', color: 'var(--pk-text-dim)', letterSpacing: '0.06em' }}>PREDICTED</p>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--pk-gold)', textTransform: 'capitalize' }}>
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.4rem', marginRight: '0.25rem' }}>▶</span>
            {b.predicted_winner}
          </span>
        </div>
        <div>
          <p style={{ margin: '0 0 0.2rem', fontFamily: 'var(--font-pixel)', fontSize: '0.35rem', color: 'var(--pk-text-dim)', letterSpacing: '0.06em' }}>CONFIDENCE</p>
          <ConfidenceDisplay score={b.confidence_score} />
        </div>
        {b.actual_winner != null && (
          <div>
            <p style={{ margin: '0 0 0.2rem', fontFamily: 'var(--font-pixel)', fontSize: '0.35rem', color: 'var(--pk-text-dim)', letterSpacing: '0.06em' }}>ACTUAL</p>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--pk-text)', textTransform: 'capitalize' }}>{b.actual_winner}</span>
          </div>
        )}
        <div style={{ marginLeft: 'auto' }}>
          {b.replay_link
            ? <a href={b.replay_link} target="_blank" rel="noopener noreferrer" className="pk-replay-btn">WATCH REPLAY ▶</a>
            : <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.38rem', color: 'var(--pk-text-dim)' }}>NO REPLAY</span>}
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [battles, setBattles] = useState<PredictionWithResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await api.getBattleHistory();
      setBattles([...data].sort((a, b) => new Date(b.predicted_at).getTime() - new Date(a.predicted_at).getTime()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load battle history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pending = battles.filter((b) => b.actual_winner == null).length;
  const correct = battles.filter((b) => b.correct_prediction === 1).length;
  const wrong = battles.filter((b) => b.correct_prediction === 0).length;
  const total = battles.filter((b) => b.actual_winner != null).length;

  return (
    <AuthGuard>
    <div className="pk-section">
      <div className="pk-page-glow" aria-hidden="true" />

      {/* ── Header ─────────────────────────────────────────── */}
      <header style={{ marginBottom: 'clamp(1.25rem, 3vw, 2rem)' }}>
        {/* Battle Records title bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem', padding: '0.625rem 1rem', background: 'linear-gradient(90deg, rgba(239,68,68,0.15), rgba(239,68,68,0.04))', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.5rem', borderLeft: '3px solid var(--pk-red)' }}>
          {/* crossed-swords decoration */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
            <line x1="4" y1="4" x2="20" y2="20" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
            <line x1="5.5" y1="9" x2="9" y2="5.5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="19.5" cy="19.5" r="1.2" fill="#EF4444" />
            <line x1="20" y1="4" x2="4" y2="20" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
            <line x1="18.5" y1="9" x2="15" y2="5.5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="4.5" cy="19.5" r="1.2" fill="#EF4444" />
          </svg>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.58rem', color: 'var(--pk-red)', letterSpacing: '0.15em' }}>BATTLE RECORDS</span>
          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(239,68,68,0.3), transparent)' }} />
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['#FF4444', '#FFCC00', '#44CC44'] as const).map((color) => (
              <div key={color} aria-hidden="true" style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}88` }} />
            ))}
          </div>
        </div>

        <h1 style={{ margin: '0 0 0.375rem', fontSize: 'clamp(1.3rem, 3vw, 2rem)', fontWeight: 900, color: 'var(--pk-text)' }}>
          Battle History
        </h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--pk-text-muted)' }}>
          All predictions with recorded results for model evaluation.
        </p>
      </header>

      {/* ── Summary stats — achievement tiles ───────────────── */}
      {!loading && battles.length > 0 && (
        <div className="pk-record-stat-bar">
          {[
            { label: 'TOTAL BATTLES', value: battles.length, cls: 'stat-total', color: 'var(--pk-text)', icon: '◆' },
            { label: 'CORRECT', value: `${correct}/${total}`, cls: 'stat-correct', color: '#4ADE80', icon: '★' },
            { label: 'WRONG', value: wrong, cls: 'stat-wrong', color: '#F87171', icon: '✗' },
            { label: 'PENDING', value: pending, cls: 'stat-pending', color: 'var(--pk-gold)', icon: '⏳' },
          ].map(({ label, value, cls, color, icon }) => (
            <div key={label} className={`pk-history-stat ${cls}`}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.375rem' }}>
                <span style={{ fontSize: '1rem', opacity: 0.7 }} aria-hidden="true">{icon}</span>
              </div>
              <p style={{ margin: '0 0 0.2rem', fontSize: '0.38rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-dim)', letterSpacing: '0.08em' }}>{label}</p>
              <p style={{ margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.6rem)', fontWeight: 800, color, fontFamily: 'var(--font-body)' }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Controls ───────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.4rem', padding: '0.35rem 0.75rem', cursor: loading ? 'not-allowed' : 'pointer', color: 'var(--pk-text-muted)', opacity: loading ? 0.5 : 1, fontFamily: 'var(--font-pixel)', fontSize: '0.45rem', letterSpacing: '0.06em', transition: 'all 0.15s ease' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M1 4v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          REFRESH LOG
        </button>
        <button
          onClick={() => downloadCSV(battles)}
          disabled={battles.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(248,208,48,0.08)', border: '1px solid rgba(248,208,48,0.3)', borderRadius: '0.4rem', padding: '0.35rem 0.875rem', cursor: battles.length === 0 ? 'not-allowed' : 'pointer', color: 'var(--pk-gold)', opacity: battles.length === 0 ? 0.5 : 1, fontFamily: 'var(--font-pixel)', fontSize: '0.45rem', letterSpacing: '0.06em', transition: 'all 0.15s ease' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          EXPORT CSV
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="pk-error" role="alert" style={{ marginBottom: '1rem' }}>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.52rem', letterSpacing: '0.06em' }}>⚠ ERROR: </span>{error}
        </div>
      )}

      {/* ── Battle record cards ─────────────────────────────── */}
      {loading && (
        <div className="pokedex-card" style={{ overflow: 'hidden' }}>
          <div className="pk-loading-msg">
            <LoadingSpinner size="lg" />
            <p className="pk-loading-title" style={{ color: 'var(--pk-red)' }}>SEARCHING BATTLE LOG...</p>
            <p className="pk-loading-sub">Loading all recorded battles</p>
          </div>
        </div>
      )}
      {!loading && battles.length === 0 && (
        <div className="pokedex-card" style={{ overflow: 'hidden' }}>
          <ProfessorOak message="There is a time and place for everything, but not now." />
        </div>
      )}
      {!loading && battles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {battles.map((b, idx) => (
            <BattleCard key={b.match_id} b={b} idx={idx} total={battles.length} />
          ))}
          <div className="pk-table-scroll-hint" style={{ textAlign: 'center', paddingTop: '0.75rem' }}>
            ◆ {battles.length} BATTLE RECORDS TOTAL
          </div>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
