'use client';

import React, { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { api } from '@/lib/api';
import type { PredictionWithResult, CommentaryResponse } from '@/types';

function PokeBallSpinner() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes pk-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <svg width="32" height="32" viewBox="0 0 40 40" style={{ animation: 'pk-spin 0.8s linear infinite' }} aria-hidden="true">
        <circle cx="20" cy="20" r="18" fill="none" stroke="#333" strokeWidth="2" />
        <path d="M2 20 A18 18 0 0 1 38 20" fill="#DC2626" />
        <path d="M38 20 A18 18 0 0 1 2 20" fill="#F8FAFC" />
        <line x1="2" y1="20" x2="38" y2="20" stroke="#111" strokeWidth="2.5" />
        <circle cx="20" cy="20" r="5" fill="#111" />
        <circle cx="20" cy="20" r="2.8" fill="#F8FAFC" />
      </svg>
    </div>
  );
}

export default function Engine5Page() {
  const [battles, setBattles] = useState<PredictionWithResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [commentary, setCommentary] = useState<CommentaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [battlesLoading, setBattlesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.getBattleHistory().then(setBattles).catch(() => setBattles([])).finally(() => setBattlesLoading(false));
  }, []);

  async function handleGenerate() {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    setCommentary(null);
    try {
      const data = await api.generateCommentary(selectedId);
      setCommentary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate commentary');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGuard>
      <div className="pk-section">

        {/* Header */}
        <header style={{ marginBottom: 'clamp(1.25rem, 3vw, 1.75rem)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.12em' }}>
              ENGINE 05 | AI
            </span>
          </div>
          <h1 style={{ margin: '0 0 0.3rem', fontSize: 'clamp(1.3rem,3vw,2rem)', fontWeight: 900, color: 'var(--pk-text)' }}>
            The Commentator
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--pk-text-muted)' }}>
            Live AI battle commentary powered by Claude.
          </p>
        </header>

        {/* Broadcast booth banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '0.625rem',
          padding: '0.625rem 1rem',
          marginBottom: '1.5rem',
        }}>
          <style>{`@keyframes live-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', background: '#EF4444', flexShrink: 0,
            animation: 'live-pulse 1s ease infinite',
          }} />
          <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: '#EF4444', letterSpacing: '0.12em' }}>
            LIVE COMMENTARY
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.42rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.06em' }}>
            POWERED BY CLAUDE SONNET
          </span>
        </div>

        {/* Battle selector */}
        <div style={{
          background: '#0a0e1a', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '0.875rem', padding: '1rem', marginBottom: '1.25rem',
        }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.08em' }}>
            ◆ SELECT A BATTLE
          </p>

          {battlesLoading && <LoadingSpinner size="sm" />}

          {!battlesLoading && battles.length === 0 && (
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--pk-text-muted)' }}>
              No battles recorded yet — use Engine 3 to record a battle first.
            </p>
          )}

          {!battlesLoading && battles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '280px', overflowY: 'auto' }}>
              {battles.map((b) => {
                const isSelected = selectedId === b.match_id;
                return (
                  <button
                    key={b.match_id}
                    type="button"
                    onClick={() => setSelectedId(b.match_id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.625rem 0.875rem',
                      background: isSelected ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.2)',
                      border: isSelected ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '0.42rem', fontFamily: 'var(--font-pixel)', color: isSelected ? '#EF4444' : 'var(--pk-text-muted)', letterSpacing: '0.06em', flexShrink: 0 }}>
                      {b.match_id}
                    </span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--pk-text)', flex: 1 }}>
                      {b.battler_a} <span style={{ color: 'var(--pk-text-muted)' }}>vs</span> {b.battler_b}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--pk-text-muted)', flexShrink: 0 }}>
                      {new Date(b.predicted_at).toLocaleDateString()}
                    </span>
                    {b.actual_winner && (
                      <span style={{
                        fontSize: '0.38rem', fontFamily: 'var(--font-pixel)',
                        color: '#78C850', border: '1px solid rgba(120,200,80,0.3)',
                        borderRadius: '0.25rem', padding: '0.1rem 0.4rem', letterSpacing: '0.06em', flexShrink: 0,
                      }}>
                        CONCLUDED
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Generate button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => { void handleGenerate(); }}
            disabled={!selectedId || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.875rem 2.5rem',
              background: !selectedId || loading ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #8B0000, #DC2626)',
              border: '2px solid rgba(239,68,68,0.5)',
              borderRadius: '0.625rem',
              color: '#fff',
              fontFamily: 'var(--font-pixel)',
              fontSize: '0.6rem',
              letterSpacing: '0.1em',
              cursor: !selectedId || loading ? 'not-allowed' : 'pointer',
              opacity: !selectedId ? 0.45 : 1,
              transition: 'all 0.2s ease',
              boxShadow: selectedId && !loading ? '0 0 20px rgba(239,68,68,0.3)' : 'none',
            }}
          >
            {loading ? (
              <><PokeBallSpinner /><span>GENERATING COMMENTARY...</span></>
            ) : (
              <><span style={{ fontSize: '1rem' }}>🎙</span><span>GENERATE COMMENTARY</span></>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" style={{
            background: '#2a0505', border: '2px solid rgba(239,68,68,0.5)',
            borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem',
          }}>
            <p style={{ margin: 0, fontSize: '0.6rem', fontFamily: 'var(--font-pixel)', color: '#EF4444' }}>ERROR</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)' }}>{error}</p>
          </div>
        )}

        {/* Commentary panel */}
        {commentary && (
          <div style={{
            background: '#0a0e1a',
            border: '2px solid rgba(239,68,68,0.3)',
            borderRadius: '1rem',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '0.875rem 1.25rem',
              background: 'rgba(239,68,68,0.06)',
              borderBottom: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
              <span style={{ fontSize: '1.1rem' }} aria-hidden="true">📺</span>
              <span style={{ fontSize: '0.52rem', fontFamily: 'var(--font-pixel)', color: '#EF4444', letterSpacing: '0.1em' }}>
                MATCH REPORT
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '0.4rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.06em' }}>
                MATCH {commentary.match_id}
              </span>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {commentary.commentary.split('\n\n').filter(Boolean).map((para, i) => (
                <p key={i} style={{
                  margin: i === 0 ? '0' : '1rem 0 0',
                  fontSize: '0.9rem',
                  color: 'var(--pk-text)',
                  lineHeight: 1.8,
                }}>
                  {para.trim()}
                </p>
              ))}
            </div>
            <div style={{
              padding: '0.5rem 1.25rem',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
              <span style={{ fontSize: '0.38rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.06em' }}>
                GENERATED BY {commentary.model.toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
