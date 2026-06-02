'use client';

import React, { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { api } from '@/lib/api';
import type { LeaderboardEntry, ArchiveStats } from '@/types';

const RANK_COLORS: Record<number, string> = { 1: '#F8D030', 2: '#C0C0C0', 3: '#CD7F32' };
const RANK_GLOWS: Record<number, string> = {
  1: 'rgba(248,208,48,0.08)',
  2: 'rgba(192,192,192,0.06)',
  3: 'rgba(205,127,50,0.06)',
};
const RANK_BADGES: Record<number, string> = {
  1: 'CHAMPION',
  2: 'ELITE FOUR',
  3: 'GYM LEADER',
};

function PokeBallIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="20" cy="20" r="18" fill="none" stroke="#333" strokeWidth="2" />
      <path d="M2 20 A18 18 0 0 1 38 20" fill="#DC2626" />
      <path d="M38 20 A18 18 0 0 1 2 20" fill="#F8FAFC" />
      <line x1="2" y1="20" x2="38" y2="20" stroke="#111" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="5" fill="#111" />
      <circle cx="20" cy="20" r="2.8" fill="#F8FAFC" />
    </svg>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      flex: '1 1 160px',
      background: '#0d1120',
      border: '1px solid rgba(239,68,68,0.2)',
      borderRadius: '0.75rem',
      padding: '1rem 1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem',
    }}>
      <p style={{ margin: 0, fontSize: '0.42rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.1em' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'var(--pk-text)', lineHeight: 1.2 }}>
        {value}
      </p>
    </div>
  );
}

export default function ArchivePage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<ArchiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [lb, st] = await Promise.all([api.getLeaderboard(), api.getArchiveStats()]);
        setLeaderboard(lb);
        setStats(st);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load archive');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AuthGuard>
      <div className="pk-section">

        {/* Header */}
        <header style={{ marginBottom: 'clamp(1.25rem, 3vw, 1.75rem)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.12em' }}>
              ENGINE 04
            </span>
            <span style={{
              fontSize: '0.42rem', fontFamily: 'var(--font-pixel)',
              border: '1px solid rgba(248,208,48,0.35)', borderRadius: '0.3rem',
              padding: '0.15rem 0.5rem', color: '#F8D030', letterSpacing: '0.08em',
            }}>
              THE ARCHIVE
            </span>
          </div>
          <h1 style={{ margin: '0 0 0.3rem', fontSize: 'clamp(1.3rem,3vw,2rem)', fontWeight: 900, color: 'var(--pk-text)' }}>
            Battle Leaderboard
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--pk-text-muted)' }}>
            Battle leaderboard and global statistics across all recorded matches.
          </p>
        </header>

        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <LoadingSpinner size="lg" />
            <p style={{ marginTop: '1rem', fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.1em' }}>
              LOADING ARCHIVE...
            </p>
          </div>
        )}

        {error && (
          <div role="alert" style={{
            background: '#2a0505', border: '2px solid rgba(239,68,68,0.5)',
            borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem',
          }}>
            <p style={{ margin: 0, fontSize: '0.6rem', fontFamily: 'var(--font-pixel)', color: '#EF4444' }}>SYSTEM ERROR</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)' }}>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Stats strip */}
            {stats && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <StatCard label="TOTAL BATTLES" value={stats.total_battles} />
                <StatCard label="MOST USED POKEMON" value={stats.most_used_pokemon} />
                <StatCard label="TOP MODEL" value={stats.most_accurate_model} />
                <StatCard label="OVERALL ACCURACY" value={`${(stats.overall_accuracy * 100).toFixed(1)}%`} />
              </div>
            )}

            {/* Leaderboard */}
            <div style={{
              background: '#0a0e1a',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '1rem',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '0.875rem 1.25rem',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <PokeBallIcon size={14} />
                <span style={{ fontSize: '0.52rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.1em' }}>
                  TRAINER RANKINGS
                </span>
              </div>

              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '56px 1fr 60px 60px 80px 80px 100px',
                padding: '0.6rem 1.25rem',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: 'rgba(0,0,0,0.3)',
              }}>
                {['RANK', 'TRAINER', 'W', 'L', 'WIN%', 'BATTLES', 'AVG CONF'].map((h) => (
                  <span key={h} style={{ fontSize: '0.38rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.08em' }}>
                    {h}
                  </span>
                ))}
              </div>

              {leaderboard.length === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.08em' }}>
                    NO BATTLES RECORDED YET
                  </p>
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--pk-text-muted)' }}>
                    Use Engine 3 to record battles and they will appear here.
                  </p>
                </div>
              )}

              {leaderboard.map((entry) => {
                const rankColor = RANK_COLORS[entry.rank] ?? 'var(--pk-text)';
                const rowBg = RANK_GLOWS[entry.rank] ?? 'transparent';
                const badge = RANK_BADGES[entry.rank] ?? 'TRAINER';
                return (
                  <div
                    key={entry.trainer}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '56px 1fr 60px 60px 80px 80px 100px',
                      padding: '0.75rem 1.25rem',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: rowBg,
                      alignItems: 'center',
                    }}
                  >
                    {/* Rank */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 900, color: rankColor, fontFamily: 'var(--font-pixel)' }}>
                        #{entry.rank}
                      </span>
                      <span style={{
                        fontSize: '0.32rem', fontFamily: 'var(--font-pixel)',
                        color: rankColor, opacity: 0.7, letterSpacing: '0.04em',
                      }}>
                        {badge}
                      </span>
                    </div>

                    {/* Trainer */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <PokeBallIcon size={14} />
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: rankColor }}>
                        {entry.trainer}
                      </span>
                    </div>

                    <span style={{ fontSize: '0.85rem', color: '#78C850', fontWeight: 700 }}>{entry.wins}</span>
                    <span style={{ fontSize: '0.85rem', color: '#EF4444', fontWeight: 700 }}>{entry.losses}</span>
                    <span style={{ fontSize: '0.85rem', color: rankColor, fontWeight: 700 }}>
                      {(entry.win_rate * 100).toFixed(1)}%
                    </span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--pk-text-muted)' }}>{entry.total_battles}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--pk-text-muted)' }}>
                      {(entry.avg_confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AuthGuard>
  );
}
