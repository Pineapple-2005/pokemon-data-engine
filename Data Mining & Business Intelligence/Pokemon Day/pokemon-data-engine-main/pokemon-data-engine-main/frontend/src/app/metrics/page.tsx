'use client';

import React, { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { api } from '@/lib/api';
import type { ModelMetrics, PredictionWithResult, CounterMetrics } from '@/types';

/* ── HP-bar metric card ─────────────────────────────────── */
interface MetricCardProps {
  readonly label: string;
  readonly value: number;
  readonly description: string;
  readonly format?: 'percent' | 'decimal' | 'raw';
  readonly goodHigh?: boolean;
  readonly pokemonTerm?: string;
}

function MetricCard({ label, value, description, format = 'percent', goodHigh = true, pokemonTerm }: MetricCardProps) {
  const display =
    format === 'percent' ? `${(value * 100).toFixed(1)}%`
    : format === 'decimal' ? value.toFixed(4)
    : value.toFixed(2);

  /* Bar width and colour */
  const barValue = format === 'percent' ? value : Math.min(value, 1);
  const effectiveBar = goodHigh ? barValue : 1 - barValue;
  const barPct = Math.min(effectiveBar * 100, 100);
  const barClass = barPct >= 65 ? 'hp-high' : barPct >= 35 ? 'hp-mid' : 'hp-low';

  return (
    <div className="pokedex-card" style={{ padding: 'clamp(1rem, 2.5vw, 1.25rem)', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 0.15rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--pk-text)' }}>{label}</h3>
          {pokemonTerm && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-gold)', marginBottom: '0.15rem', letterSpacing: '0.04em' }}>
              <span aria-hidden="true">▶</span> {pokemonTerm}
            </span>
          )}
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--pk-text-dim)', lineHeight: 1.5 }}>{description}</p>
        </div>
        <span style={{ fontSize: 'clamp(1.3rem, 2.5vw, 1.75rem)', fontWeight: 900, color: 'var(--pk-text)', flexShrink: 0 }}>{display}</span>
      </div>

      {/* GBA HP-bar style */}
      <div className="pk-metric-card-hp">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.38rem', color: 'var(--pk-text-dim)', letterSpacing: '0.05em' }}>
            {goodHigh ? 'SCORE' : 'LOSS'}
          </span>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.38rem', color: barPct >= 65 ? '#58C84A' : barPct >= 35 ? '#E0C030' : '#E82828' }}>
            {barPct.toFixed(0)}%
          </span>
        </div>
        <div className="hp-bar-metric-track">
          <div
            className={`hp-bar-metric-fill ${barClass}`}
            style={{ width: `${barPct}%` }}
            role="progressbar"
            aria-valuenow={barPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${label} score`}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Confusion matrix ───────────────────────────────────── */
function ConfusionMatrix({ matrix }: { readonly matrix: { tp: number; fp: number; tn: number; fn: number } }) {
  const total = matrix.tp + matrix.fp + matrix.tn + matrix.fn || 1;
  const cells = [
    { label: 'TP', value: matrix.tp, bg: '#0d1f0d', color: '#4ADE80', term: 'SUPER EFFECTIVE!', accent: '#4ADE80', glowClass: 'cell-tp' },
    { label: 'FP', value: matrix.fp, bg: '#1f0d0d', color: '#F87171', term: 'NOT VERY EFFECTIVE', accent: '#F87171', glowClass: 'cell-fp' },
    { label: 'FN', value: matrix.fn, bg: '#1f1800', color: '#FBBF24', term: 'MISSED!', accent: '#FBBF24', glowClass: 'cell-fn' },
    { label: 'TN', value: matrix.tn, bg: '#0d1220', color: '#93C5FD', term: 'DODGED!', accent: '#93C5FD', glowClass: 'cell-tn' },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', maxWidth: '300px' }}>
        {cells.map((c) => (
          <div key={c.label} className={`pk-confusion-cell ${c.glowClass}`} style={{ '--cell-accent': c.accent, background: c.bg, border: `1px solid ${c.color}44` } as React.CSSProperties}>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.42rem', fontFamily: 'var(--font-pixel)', color: c.color, letterSpacing: '0.04em' }}>{c.term}</p>
            <p style={{ margin: '0 0 0.15rem', fontSize: '1.5rem', fontWeight: 900, color: c.color }}>{c.value}</p>
            <p style={{ margin: '0 0 0.15rem', fontSize: '0.55rem', fontWeight: 700, color: c.color, fontFamily: 'var(--font-pixel)' }}>{c.label}</p>
            <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--pk-text-dim)' }}>{((c.value / total) * 100).toFixed(1)}%</p>
          </div>
        ))}
      </div>
      <p style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--pk-text-dim)', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--pk-text-muted)' }}>Rows:</strong> Actual class &nbsp;
        <strong style={{ color: 'var(--pk-text-muted)' }}>Cols:</strong> Predicted class
        &nbsp;— Total evaluated: {total}
      </p>
    </div>
  );
}

/* ── Accuracy chart in GBA LCD frame ───────────────────── */
function AccuracyChart({ battles }: { readonly battles: PredictionWithResult[] }) {
  const evaluated = battles
    .filter((b) => b.actual_winner != null)
    .sort((a, b) => new Date(a.predicted_at).getTime() - new Date(b.predicted_at).getTime());

  if (evaluated.length < 2) {
    return (
      <div style={{ height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-pixel)', fontSize: '0.48rem', color: 'var(--pk-text-dim)', letterSpacing: '0.06em' }}>NEED MORE DATA</p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--pk-text-dim)' }}>Record at least 2 battle results</p>
      </div>
    );
  }

  const points: { x: number; y: number }[] = [];
  let correctCount = 0;
  evaluated.forEach((b, i) => {
    if (b.correct_prediction === 1) correctCount++;
    points.push({ x: i, y: correctCount / (i + 1) });
  });

  const W = 480; const H = 140;
  const PAD = { top: 12, right: 20, bottom: 28, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const xScale = (i: number) => PAD.left + (i / Math.max(points.length - 1, 1)) * chartW;
  const yScale = (v: number) => PAD.top + (1 - v) * chartH;
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${xScale(points.length - 1).toFixed(1)} ${(PAD.top + chartH).toFixed(1)} L ${PAD.left.toFixed(1)} ${(PAD.top + chartH).toFixed(1)} Z`;
  const finalAccuracy = points[points.length - 1].y;
  const lineColor = finalAccuracy >= 0.65 ? '#58C84A' : finalAccuracy >= 0.4 ? '#E0C030' : '#E82828';

  return (
    <div>
      {/* GBA LCD frame */}
      <div className="pk-accuracy-timeline">
        {/* Scanlines inside chart */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,60,0.015) 3px, rgba(0,255,60,0.015) 4px)', pointerEvents: 'none', zIndex: 1 }} />
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', position: 'relative', zIndex: 2 }} role="img" aria-label="Accuracy over battles">
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yScale(v)} y2={yScale(v)} stroke="rgba(0,255,60,0.08)" strokeWidth="1" />
              <text x={PAD.left - 4} y={yScale(v) + 4} textAnchor="end" fontSize="9" fill="#22aa44">{(v * 100).toFixed(0)}%</text>
            </g>
          ))}
          <path d={areaD} fill={lineColor} fillOpacity="0.08" />
          <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={xScale(points.length - 1)} cy={yScale(finalAccuracy)} r="4" fill={lineColor} />
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + chartH} y2={PAD.top + chartH} stroke="rgba(0,255,60,0.15)" strokeWidth="1" />
          <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="#22aa44">BATTLE #</text>
          <line x1={PAD.left} x2={W - PAD.right} y1={yScale(0.5)} y2={yScale(0.5)} stroke="rgba(0,255,60,0.2)" strokeWidth="1" strokeDasharray="4 3" />
        </svg>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--pk-text-dim)' }}>
          Cumulative accuracy over {evaluated.length} battles
        </p>
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.48rem', color: lineColor }}>
          {(finalAccuracy * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────── */
export default function MetricsPage() {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [battles, setBattles] = useState<PredictionWithResult[]>([]);
  const [counterMetrics, setCounterMetrics] = useState<CounterMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [metricsData, historyData, counterData] = await Promise.allSettled([
          api.getAccuracyMetrics(), api.getBattleHistory(), api.getCounterSuccessRate(),
        ]);
        if (cancelled) return;
        if (metricsData.status === 'fulfilled') setMetrics(metricsData.value);
        if (historyData.status === 'fulfilled') setBattles(historyData.value);
        if (counterData.status === 'fulfilled') setCounterMetrics(counterData.value);
        if (metricsData.status === 'rejected') setError(metricsData.reason?.message ?? 'Failed to load metrics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <AuthGuard>
    <div className="pk-section">
      <div className="pk-page-glow" aria-hidden="true" />

      {/* ── Header ────────────────────────────────────── */}
      <header style={{ marginBottom: 'clamp(1.25rem, 3vw, 2rem)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.12em' }}>ANALYSIS</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(248,208,48,0.08)', border: '1px solid rgba(248,208,48,0.3)', borderRadius: '0.4rem', padding: '0.25rem 0.6rem' }}>
            <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-gold)', letterSpacing: '0.06em' }}>📊 MODEL METRICS</span>
          </div>
        </div>
        <h1 style={{ margin: '0 0 0.375rem', fontSize: 'clamp(1.3rem, 3vw, 2rem)', fontWeight: 900, color: 'var(--pk-text)' }}>
          Model Evaluation Metrics
        </h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--pk-text-muted)' }}>
          Ensemble model performance across all recorded battle outcomes.
        </p>
      </header>

      {error && (
        <div className="pk-error" role="alert" style={{ marginBottom: '1rem' }}>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.52rem', letterSpacing: '0.06em' }}>⚠ ERROR: </span>{error}
        </div>
      )}

      {loading ? (
        <div className="pk-loading-msg" style={{ padding: '5rem 0' }}>
          <LoadingSpinner size="lg" />
          <p className="pk-loading-title">ANALYSING BATTLE DATA...</p>
          <p className="pk-loading-sub">Loading model performance metrics</p>
        </div>
      ) : metrics ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* ── Primary metrics — GBA HP bars ─────────── */}
          <section aria-label="Model performance metrics">
            <p className="pk-section-label">
              <span aria-hidden="true">◆</span> PERFORMANCE METRICS
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.875rem' }}>
              <MetricCard label="Accuracy"    value={metrics.accuracy}    description="Fraction of correct predictions" pokemonTerm="SUPER EFFECTIVE!" goodHigh />
              <MetricCard label="Precision"   value={metrics.precision}   description="Of all positive predictions, how many were correct" pokemonTerm="CRITICAL HIT!" goodHigh />
              <MetricCard label="Recall"      value={metrics.recall}      description="Of all actual positives, how many were identified" pokemonTerm="IT'S EFFECTIVE!" goodHigh />
              <MetricCard label="F1 Score"    value={metrics.f1}          description="Harmonic mean of precision and recall" pokemonTerm="COMBO ATTACK!" goodHigh />
              <MetricCard label="Brier Score" value={metrics.brier_score} description="Probability calibration error (lower = better)" format="decimal" pokemonTerm="NOT VERY EFFECTIVE…" goodHigh={false} />
              <MetricCard label="Log Loss"    value={metrics.log_loss}    description="Penalises confident wrong predictions (lower = better)" format="decimal" pokemonTerm="WILD MISS!" goodHigh={false} />
            </div>
          </section>

          {/* ── Battle count tiles ──────────────────── */}
          <section aria-label="Battle statistics">
            <p className="pk-section-label">
              <span aria-hidden="true">◆</span> BATTLE STATISTICS
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
              {[
                { label: 'TOTAL BATTLES', value: metrics.total_battles, color: 'var(--pk-text)' },
                { label: 'CORRECT', value: metrics.correct_predictions, color: '#4ADE80' },
                { label: 'INCORRECT', value: metrics.total_battles - metrics.correct_predictions, color: '#F87171' },
                { label: 'WIN RATE', value: metrics.total_battles > 0 ? `${((metrics.correct_predictions / metrics.total_battles) * 100).toFixed(1)}%` : '—', color: 'var(--pk-gold)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="pokedex-card" style={{ padding: '0.875rem', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.42rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.06em' }}>{label}</p>
                  <p style={{ margin: 0, fontSize: 'clamp(1.3rem, 3vw, 1.75rem)', fontWeight: 900, color }}>{value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Counter success rate ─────────────────── */}
          {counterMetrics && (
            <section aria-label="Counter-Pick success rate">
              <p className="pk-section-label">
                <span aria-hidden="true">◆</span> ENGINE 2 — COUNTER SUCCESS RATE
              </p>
              <div className="pokedex-card" style={{ padding: 'clamp(1rem, 2.5vw, 1.5rem)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', minWidth: '80px' }}>
                    <p style={{ margin: 0, fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: 900, color: '#4ADE80' }}>{counterMetrics.rate_pct}</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.52rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-dim)', letterSpacing: '0.04em' }}>SUCCESS RATE</p>
                  </div>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.42rem', color: 'var(--pk-text-muted)', letterSpacing: '0.04em' }}>COUNTER SESSIONS WON</span>
                      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.48rem', color: '#4ADE80' }}>{counterMetrics.wins} / {counterMetrics.total}</span>
                    </div>
                    {/* GBA HP bar */}
                    <div className="hp-bar-metric-track">
                      <div
                        className="hp-bar-metric-fill hp-high"
                        style={{ width: `${Math.min(counterMetrics.rate * 100, 100)}%` }}
                        role="progressbar"
                        aria-valuenow={counterMetrics.rate * 100}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Counter success rate"
                      />
                    </div>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: 'var(--pk-text-dim)' }}>
                      How often Engine 2 counter recommendations led to a win.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Confusion matrix + accuracy chart ──── */}
          <section aria-label="Confusion matrix and accuracy trend" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            <div className="pokedex-card" style={{ padding: 'clamp(1rem, 2.5vw, 1.5rem)' }}>
              <p className="pk-section-label">
                <span aria-hidden="true">◆</span> CONFUSION MATRIX
              </p>
              <ConfusionMatrix matrix={metrics.confusion_matrix} />
            </div>
            <div className="pokedex-card" style={{ padding: 'clamp(1rem, 2.5vw, 1.5rem)' }}>
              <p className="pk-section-label">
                <span aria-hidden="true">◆</span> ACCURACY OVER TIME
              </p>
              <AccuracyChart battles={battles} />
            </div>
          </section>

          {/* ── Model Hall of Fame ────────────────── */}
          <section aria-label="Model Hall of Fame">
            <p className="pk-section-label accent-gold">
              <span aria-hidden="true">◆</span> MODEL HALL OF FAME
            </p>
            <div className="pk-hof-panel">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="pk-hof-trophy" aria-hidden="true">🏆</div>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <p style={{ margin: '0 0 0.25rem', fontFamily: 'var(--font-pixel)', fontSize: '0.38rem', color: 'rgba(248,208,48,0.55)', letterSpacing: '0.1em' }}>TOP PERFORMING MODEL</p>
                  <p style={{ margin: '0 0 0.35rem', fontFamily: 'var(--font-pixel)', fontSize: '0.65rem', color: 'var(--pk-gold)', letterSpacing: '0.06em' }}>5-MODEL ENSEMBLE</p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--pk-text-muted)', lineHeight: 1.6 }}>
                    Decision Tree · Random Forest · Logistic Regression · Naive Bayes · K-NN
                  </p>
                </div>
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <p style={{ margin: '0 0 0.15rem', fontFamily: 'var(--font-pixel)', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', color: 'var(--pk-gold)', textShadow: '0 0 16px var(--pk-gold-glow)', fontWeight: 900 }}>
                    {(metrics.accuracy * 100).toFixed(1)}%
                  </p>
                  <p style={{ margin: 0, fontFamily: 'var(--font-pixel)', fontSize: '0.38rem', color: 'rgba(248,208,48,0.6)', letterSpacing: '0.08em' }}>ACCURACY</p>
                </div>
              </div>
            </div>
          </section>

        </div>
      ) : (
        <div className="pk-empty-state">
          <span className="pk-empty-icon">📊</span>
          <p className="pk-empty-title">NO DATA YET</p>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--pk-text-dim)' }}>Record some battle results first to see metrics.</p>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
