'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { StatCard } from '@/components/ui/StatCard';
import { ProfessorOak } from '@/components/ui/ProfessorOak';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { api } from '@/lib/api';
import { getTrainerProfile, getStoredUser, clearUser } from '@/lib/auth';
import type { PredictionWithResult, ModelMetrics, TrainerProfile } from '@/types';

const Pokeball3D = dynamic(() => import('@/components/ui/Pokeball3D').then(m => ({ default: m.Pokeball3D })), { ssr: false });

const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ts; }
}

/* ── Pokémon-themed SVG Icons ──────────────────────────── */

function IconCrossedPokeballs({ size = 18, color = '#EF4444' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <g transform="rotate(-35, 7, 17)">
        <rect x="5" y="13" width="4" height="9" rx="2" fill={color} />
        <rect x="5" y="10" width="4" height="5" rx="1" fill={color} opacity="0.6" />
        <circle cx="7" cy="10" r="3.5" fill={color} />
        <path d="M3.5 10 A3.5 3.5 0 0 1 10.5 10" stroke="#fff" strokeWidth="1" fill="none" />
        <circle cx="7" cy="10" r="1.2" fill="#fff" />
      </g>
      <g transform="rotate(35, 17, 17)">
        <rect x="15" y="13" width="4" height="9" rx="2" fill={color} />
        <rect x="15" y="10" width="4" height="5" rx="1" fill={color} opacity="0.6" />
        <circle cx="17" cy="10" r="3.5" fill={color} />
        <path d="M13.5 10 A3.5 3.5 0 0 1 20.5 10" stroke="#fff" strokeWidth="1" fill="none" />
        <circle cx="17" cy="10" r="1.2" fill="#fff" />
      </g>
    </svg>
  );
}

function IconPokeballShield({ size = 18, color = '#94A3B8' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M12 2L4 6v5c0 5.25 3.5 9.74 8 11 4.5-1.26 8-5.75 8-11V6L12 2Z" fill={color} opacity="0.18" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="11.5" r="4" fill={color} opacity="0.9" />
      <path d="M8 11.5 A4 4 0 0 1 16 11.5" fill="#1a2235" />
      <line x1="8" y1="11.5" x2="16" y2="11.5" stroke="#1a2235" strokeWidth="1.2" />
      <circle cx="12" cy="11.5" r="1.4" fill="#1a2235" />
      <circle cx="12" cy="11.5" r="0.7" fill={color} />
    </svg>
  );
}

function IconTarget({ size = 18, color = '#EF4444' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5.5" stroke={color} strokeWidth="1.2" opacity="0.6" />
      <circle cx="12" cy="12" r="2" fill={color} />
      <line x1="12" y1="2" x2="12" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="12" x2="6" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="18" y1="12" x2="22" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconPokedex({ size = 16, color = '#94A3B8' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="4" y="2" width="16" height="20" rx="2" fill={color} opacity="0.15" stroke={color} strokeWidth="1.5" />
      <line x1="8" y1="2" x2="8" y2="22" stroke={color} strokeWidth="1" opacity="0.5" />
      <rect x="10" y="5" width="7" height="4" rx="1" fill={color} opacity="0.6" />
      <circle cx="11.5" cy="13" r="1.2" fill={color} opacity="0.8" />
      <circle cx="15.5" cy="13" r="1.2" fill={color} opacity="0.5" />
      <line x1="10" y1="17" x2="17" y2="17" stroke={color} strokeWidth="1" opacity="0.4" strokeLinecap="round" />
      <line x1="10" y1="19.5" x2="15" y2="19.5" stroke={color} strokeWidth="1" opacity="0.3" strokeLinecap="round" />
    </svg>
  );
}

function IconPokeballCheck({ size = 16, color = '#94A3B8' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="1.5" />
      <path d="M2.5 12 A9.5 9.5 0 0 1 21.5 12" fill={color} opacity="0.2" />
      <line x1="2.5" y1="12" x2="21.5" y2="12" stroke={color} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.8" fill="var(--pk-bg-2)" stroke={color} strokeWidth="1.2" />
      <polyline points="10.2,12 11.3,13.3 13.8,10.7" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCrossedSwords({ size = 16, color = '#EF4444' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <line x1="4" y1="4" x2="20" y2="20" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="4" y1="4" x2="7" y2="7" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      <line x1="5.5" y1="9" x2="9" y2="5.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="19.5" cy="19.5" r="1.2" fill={color} />
      <line x1="20" y1="4" x2="4" y2="20" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="4" x2="17" y2="7" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
      <line x1="18.5" y1="9" x2="15" y2="5.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="4.5" cy="19.5" r="1.2" fill={color} />
    </svg>
  );
}

function IconBullseye({ size = 16, color = '#F8D030' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6" stroke={color} strokeWidth="1.2" opacity="0.6" />
      <circle cx="12" cy="12" r="2.8" fill={color} opacity="0.9" />
    </svg>
  );
}

function ResultBadge({ b }: { readonly b: PredictionWithResult }) {
  if (b.actual_winner == null) {
    return (
      <span className="pk-vs-stamp pending">
        <svg width="10" height="10" viewBox="0 0 40 40" aria-hidden="true" style={{ animation: 'pokeball-spin 1.5s linear infinite' }}>
          <path d="M4 20 A16 16 0 0 1 36 20" fill="#6B7280" />
          <path d="M36 20 A16 16 0 0 1 4 20" fill="#374151" />
          <line x1="4" y1="20" x2="36" y2="20" stroke="#111" strokeWidth="3" />
          <circle cx="20" cy="20" r="4" fill="#111" />
        </svg>
        PENDING
      </span>
    );
  }
  if (b.correct_prediction === 1) {
    return <span className="pk-vs-stamp correct">★ CORRECT</span>;
  }
  return <span className="pk-vs-stamp wrong">✗ WRONG</span>;
}

/* Pokédex device — Pokemon DS game style (Gen 4/5 Diamond/Pearl/Black/White) */
function TrainerCard({
  totalPokemon, assignedPokemon, totalBattles, accuracy, loading, trainer, lastTeam, leaderboard,
}: {
  readonly totalPokemon: number | null;
  readonly assignedPokemon: number | null;
  readonly totalBattles: number | null;
  readonly accuracy: number | null;
  readonly loading: boolean;
  readonly trainer: TrainerProfile | null;
  readonly lastTeam: Array<{ name: string; pokeapi_id: number }> | null;
  readonly leaderboard: import('@/types').LeaderboardEntry[] | null;
}) {
  const accuracyPct = accuracy !== null ? accuracy * 100 : null;
  const stars = accuracyPct !== null ? Math.round(accuracyPct / 20) : 0;

  const idNo = totalPokemon !== null
    ? `${String(totalPokemon).padStart(3, '0')}001`
    : '———';

  const [showLaunchTip, setShowLaunchTip] = React.useState(false);
  const [showCopyTip, setShowCopyTip] = React.useState(false);
  const [leftTab, setLeftTab] = React.useState<'leaderboard' | 'replay'>('leaderboard');
  const [replayInput, setReplayInput] = React.useState('');
  const [activeReplayId, setActiveReplayId] = React.useState('');

  async function handleLaunchBattle() {
    try {
      const { text } = await api.getShowdownExport();
      await navigator.clipboard.writeText(text);
      window.open('https://play.pokemonshowdown.com/teambuilder', '_blank', 'noopener,noreferrer');
      setShowLaunchTip(true);
      setTimeout(() => setShowLaunchTip(false), 4000);
    } catch {
      // silently fail — clipboard may be denied in some contexts
    }
  }

  async function handleCopyTeam() {
    try {
      const { text } = await api.getShowdownExport();
      await navigator.clipboard.writeText(text);
      setShowCopyTip(true);
      setTimeout(() => setShowCopyTip(false), 2000);
    } catch {
      // silently fail
    }
  }

  // Derive the team ready status
  const teamReady = React.useMemo(() => {
    return lastTeam !== null && lastTeam.length > 0;
  }, [lastTeam]);

  // DS-style panel shared styles
  const dsPanel: React.CSSProperties = {
    background: '#f5f5f5',
    border: '3px solid #1a1c2e',
    borderRadius: '6px',
    boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.8), inset -2px -2px 0 rgba(0,0,0,0.15)',
  };

  const dsPanelHeader: React.CSSProperties = {
    background: '#1a1c2e',
    borderRadius: '3px 3px 0 0',
    padding: '3px 6px',
    marginBottom: '5px',
  };

  return (
    <div
      aria-label="Pokédex Trainer Data"
      style={{
        width: '100%',
        maxWidth: '760px',
        flex: '1 1 680px',
        background: 'linear-gradient(135deg, #CC0000 0%, #EF4444 30%, #CC0000 70%, #991111 100%)',
        borderRadius: '12px 6px 6px 12px',
        border: '3px solid #880000',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,160,160,0.3), inset 0 -1px 0 rgba(0,0,0,0.3)',
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top navigation bar — DS Pokédex header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '7px 10px',
        background: 'linear-gradient(180deg, #CC0000, #8B0000)',
        borderBottom: '2px solid #4a0000',
      }}>
        {/* Blue orb */}
        <div aria-hidden="true" style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #88ccff, #2266cc)', boxShadow: '0 0 6px rgba(34,102,204,0.7)', border: '2px solid #1144aa', flexShrink: 0 }} />
        {/* Indicator dots */}
        {(['#EF4444', '#F8D030', '#4A90D9'] as const).map((color, i) => (
          <div key={i} aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, border: '1px solid rgba(0,0,0,0.4)', flexShrink: 0 }} />
        ))}
        {/* POKéDEX label */}
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.48rem', color: '#ffffff', letterSpacing: '0.14em', marginLeft: '4px' }}>
          POK&#233;DEX
        </span>
        {/* Right side bars */}
        <div aria-hidden="true" style={{ marginLeft: 'auto', display: 'flex', gap: '3px', alignItems: 'center' }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ width: '3px', height: '10px', background: i <= 4 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)', borderRadius: '1px' }} />
          ))}
        </div>
      </div>

      {/* Main body — two panels side by side */}
      <div style={{ display: 'flex', gap: '10px', padding: '10px', flex: 1, minHeight: '320px' }}>

        {/* LEFT PANEL: Leaderboard / Replay tabs */}
        <div style={{ flex: '1 1 0', ...dsPanel, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tab header */}
          <div style={{ ...dsPanelHeader, padding: '0', display: 'flex' }}>
            <button
              type="button"
              onClick={() => setLeftTab('leaderboard')}
              style={{
                flex: 1,
                background: leftTab === 'leaderboard' ? '#1a1c2e' : 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '3px 0 0 0',
                padding: '3px 4px',
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.36rem',
                color: leftTab === 'leaderboard' ? '#ffffff' : 'rgba(255,255,255,0.45)',
                letterSpacing: '0.06em',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              LEADERBOARD
            </button>
            <button
              type="button"
              onClick={() => setLeftTab('replay')}
              style={{
                flex: 1,
                background: leftTab === 'replay' ? '#1a1c2e' : 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '0 3px 0 0',
                padding: '3px 4px',
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.36rem',
                color: leftTab === 'replay' ? '#ffffff' : 'rgba(255,255,255,0.45)',
                letterSpacing: '0.06em',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              REPLAY
            </button>
          </div>

          {/* LEADERBOARD tab content */}
          {leftTab === 'leaderboard' && (
            <>
              {/* Leaderboard rows */}
              <div style={{ flex: 1, padding: '0 5px 4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {loading || leaderboard === null ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '80px' }}>
                    <p style={{ margin: 0, fontFamily: 'var(--font-pixel)', fontSize: '0.38rem', color: '#888', letterSpacing: '0.06em', textAlign: 'center' }}>
                      LOADING...
                    </p>
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '80px' }}>
                    <p style={{ margin: 0, fontFamily: 'var(--font-pixel)', fontSize: '0.38rem', color: '#888', letterSpacing: '0.06em', textAlign: 'center', lineHeight: 2 }}>
                      NO BATTLES<br />YET
                    </p>
                  </div>
                ) : (
                  leaderboard.slice(0, 8).map((entry, idx) => {
                    const rankColors: Record<number, string> = { 0: '#C9A227', 1: '#9EA0A6', 2: '#A0522D' };
                    const rankBg = rankColors[idx] ?? '#555';
                    const winRatePct = entry.win_rate > 1 ? entry.win_rate : entry.win_rate * 100;
                    const winRateColor = winRatePct >= 100 ? '#C9A227' : winRatePct >= 50 ? '#2e7d32' : '#CC0000';
                    const rowBg = idx % 2 === 0 ? '#f5f5f5' : '#e8f0ff';
                    return (
                      <div key={entry.trainer} style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: rowBg, borderRadius: '2px',
                        padding: '2px 4px', minHeight: '20px',
                      }}>
                        {/* Rank badge */}
                        <div style={{
                          width: '14px', height: '14px', borderRadius: '50%',
                          background: rankBg, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.3rem', color: '#fff', lineHeight: 1 }}>
                            {entry.rank}
                          </span>
                        </div>
                        {/* Trainer name */}
                        <span style={{
                          fontFamily: 'var(--font-body)', fontSize: '0.65rem', color: '#111',
                          fontWeight: 600, textTransform: 'uppercase', flex: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          minWidth: 0,
                        }}>
                          {entry.trainer}
                        </span>
                        {/* W/L */}
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.58rem', color: '#444', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {entry.wins}W {entry.losses}L
                        </span>
                        {/* Win rate */}
                        <span style={{
                          fontFamily: 'var(--font-body)', fontSize: '0.58rem',
                          color: winRateColor, fontWeight: 700, whiteSpace: 'nowrap',
                          flexShrink: 0, minWidth: '34px', textAlign: 'right',
                        }}>
                          {winRatePct.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Divider + View Full link */}
              <div style={{ borderTop: '2px solid #1a1c2e', padding: '3px 5px' }}>
                <Link
                  href="/archive"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
                    fontFamily: 'var(--font-pixel)', fontSize: '0.35rem', color: '#4A90D9',
                    textDecoration: 'none', letterSpacing: '0.06em',
                  }}
                >
                  VIEW FULL &#9656;
                </Link>
              </div>
            </>
          )}

          {/* REPLAY tab content */}
          {leftTab === 'replay' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '5px', gap: '5px', overflow: 'hidden' }}>
              {/* Input row */}
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={replayInput}
                  onChange={(e) => setReplayInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const id = replayInput.match(/replay\.pokemonshowdown\.com\/([^?\s/]+)/)?.[1] ?? replayInput.trim();
                      if (id) setActiveReplayId(id);
                    }
                  }}
                  placeholder="URL or replay ID..."
                  className="pk-input"
                  style={{ flex: 1, fontSize: '10px', minWidth: 0 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const id = replayInput.match(/replay\.pokemonshowdown\.com\/([^?\s/]+)/)?.[1] ?? replayInput.trim();
                    if (id) setActiveReplayId(id);
                  }}
                  style={{
                    background: '#1a1c2e',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '3px',
                    color: '#fff',
                    fontFamily: 'var(--font-pixel)',
                    fontSize: '0.32rem',
                    letterSpacing: '0.05em',
                    padding: '3px 6px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  &#9654; LOAD
                </button>
              </div>

              {/* Iframe or placeholder */}
              {activeReplayId ? (
                <iframe
                  src={`https://replay.pokemonshowdown.com/${activeReplayId}`}
                  style={{ width: '100%', flex: 1, border: 'none', borderRadius: '3px', minHeight: '200px' }}
                  allowFullScreen
                  title="Pokemon Showdown Replay"
                />
              ) : (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.08)', borderRadius: '3px',
                  minHeight: '120px',
                }}>
                  <p style={{
                    margin: 0, fontFamily: 'var(--font-pixel)', fontSize: '0.32rem',
                    color: '#888', letterSpacing: '0.05em', textAlign: 'center', lineHeight: 2,
                  }}>
                    ENTER A REPLAY URL<br />TO WATCH
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Trainer info + team + controls */}
        <div style={{ width: '200px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>

          {/* ── Section A: Trainer info ── */}
          <div style={{ ...dsPanel, padding: '5px 7px' }}>
            <p style={{ margin: '0 0 1px', fontFamily: 'var(--font-pixel)', fontSize: '0.32rem', color: '#555', letterSpacing: '0.05em' }}>NAME</p>
            <p style={{
              margin: '0 0 1px',
              fontFamily: 'var(--font-pixel)', fontSize: '0.44rem', color: '#111',
              letterSpacing: '0.04em',
              textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: '180px',
            }}>
              {(trainer?.display_name ?? 'TRAINER').slice(0, 12)}
            </p>
            <p style={{ margin: '0 0 3px', fontFamily: 'var(--font-pixel)', fontSize: '0.3rem', color: '#777', letterSpacing: '0.04em' }}>
              ID: {trainer?.trainer_id ? trainer.trainer_id : (loading ? '—' : idNo)}
            </p>
            {trainer?.trainer_title && (
              <span style={{
                display: 'inline-block', padding: '0.06rem 0.24rem', borderRadius: '999px',
                background: '#4A90D922',
                border: '1px solid #4A90D966',
                fontFamily: 'var(--font-pixel)', fontSize: '0.26rem',
                color: '#4A90D9', letterSpacing: '0.05em',
              }}>
                {trainer.trainer_title.toUpperCase()}
              </span>
            )}
          </div>

          {/* ── Section B: Last team grid ── */}
          <div style={{ ...dsPanel, padding: '5px' }}>
            <div style={dsPanelHeader}>
              <p style={{ margin: 0, fontFamily: 'var(--font-pixel)', fontSize: '0.36rem', color: '#ffffff', letterSpacing: '0.06em' }}>
                &#9830; LAST TEAM
              </p>
            </div>
            {lastTeam && lastTeam.length > 0 ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', marginBottom: '3px' }}>
                  {lastTeam.slice(0, 6).map((mon, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', aspectRatio: '1', background: '#e8e8e8', borderRadius: '2px', border: '1px solid #ccc' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${mon.pokeapi_id}.png`}
                        alt={mon.name}
                        width={20}
                        height={20}
                        style={{ imageRendering: 'pixelated', objectFit: 'contain', display: 'block' }}
                        loading="lazy"
                      />
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 6 - lastTeam.length) }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ aspectRatio: '1', background: '#ddd', borderRadius: '2px', border: '1px solid #bbb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.35rem', color: '#aaa' }}>?</span>
                    </div>
                  ))}
                </div>
                {teamReady && (
                  <p style={{ margin: 0, fontFamily: 'var(--font-pixel)', fontSize: '0.3rem', color: '#2e7d32', letterSpacing: '0.05em' }}>
                    READY &#9679;
                  </p>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '48px', gap: '2px' }}>
                <p style={{ margin: 0, fontFamily: 'var(--font-pixel)', fontSize: '0.3rem', color: '#888', letterSpacing: '0.05em', textAlign: 'center' }}>
                  - -
                </p>
              </div>
            )}
          </div>

          {/* ── Section C: Battle controls ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
            {/* Launch tooltip */}
            {showLaunchTip && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, right: 0,
                background: '#1a1c2e', border: '2px solid #f5f5f5', borderRadius: '4px',
                padding: '4px 6px', zIndex: 10,
              }}>
                <p style={{ margin: 0, fontFamily: 'var(--font-pixel)', fontSize: '0.3rem', color: '#fff', letterSpacing: '0.05em', textAlign: 'center', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                  {'TEAM COPIED!\nPASTE IN SHOWDOWN'}
                </p>
              </div>
            )}
            {/* Copy tooltip */}
            {showCopyTip && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, right: 0,
                background: '#1a1c2e', border: '2px solid #f5f5f5', borderRadius: '4px',
                padding: '4px 6px', zIndex: 10,
              }}>
                <p style={{ margin: 0, fontFamily: 'var(--font-pixel)', fontSize: '0.3rem', color: '#fff', letterSpacing: '0.05em', textAlign: 'center' }}>
                  COPIED!
                </p>
              </div>
            )}

            {/* LAUNCH BATTLE button */}
            <button
              type="button"
              onClick={() => { void handleLaunchBattle(); }}
              style={{
                width: '100%',
                background: '#CC0000',
                border: '2px solid #1a1c2e',
                borderRadius: '4px',
                color: '#fff',
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.36rem',
                letterSpacing: '0.08em',
                padding: '0.35rem 0.4rem',
                cursor: 'pointer',
                textTransform: 'uppercase',
                textAlign: 'center',
                boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.2)',
              }}
              onFocus={e => { e.currentTarget.style.outline = '2px solid #4A90D9'; e.currentTarget.style.outlineOffset = '2px'; }}
              onBlur={e => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
            >
              &#9658; LAUNCH BATTLE
            </button>

            {/* COPY TEAM button */}
            <button
              type="button"
              onClick={() => { void handleCopyTeam(); }}
              style={{
                width: '100%',
                background: '#f5f5f5',
                border: '2px solid #1a1c2e',
                borderRadius: '4px',
                color: '#1a1c2e',
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.32rem',
                letterSpacing: '0.06em',
                padding: '0.25rem 0.4rem',
                cursor: 'pointer',
                textTransform: 'uppercase',
                textAlign: 'center',
                boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.8), inset -1px -1px 0 rgba(0,0,0,0.12)',
              }}
              onFocus={e => { e.currentTarget.style.outline = '2px solid #4A90D9'; e.currentTarget.style.outlineOffset = '2px'; }}
              onBlur={e => { e.currentTarget.style.outline = ''; e.currentTarget.style.outlineOffset = ''; }}
            >
              &#9670; COPY TEAM
            </button>
          </div>

          {/* ── Section D: Star rating ── */}
          <div style={{ display: 'flex', gap: '2px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1px' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <svg key={n} width="11" height="11" viewBox="0 0 14 14" aria-hidden="true">
                <polygon points="7,1 8.8,5.2 13.3,5.7 10.1,8.7 11,13.2 7,10.9 3,13.2 3.9,8.7 0.7,5.7 5.2,5.2" fill={n <= stars ? '#F8D030' : '#cccccc'} stroke={n <= stars ? '#B8A038' : '#aaaaaa'} strokeWidth="0.8" />
              </svg>
            ))}
          </div>
          <p style={{ margin: 0, fontFamily: 'var(--font-pixel)', fontSize: '0.3rem', color: 'rgba(255,255,255,0.45)', textAlign: 'center', letterSpacing: '0.05em' }}>TRAINER RANK</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [totalPokemon, setTotalPokemon] = useState<number | null>(null);
  const [assignedPokemon, setAssignedPokemon] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [recentBattles, setRecentBattles] = useState<PredictionWithResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);
  const [lastTeam, setLastTeam] = useState<Array<{ name: string; pokeapi_id: number }> | null>(null);
  const [leaderboard, setLeaderboard] = useState<import('@/types').LeaderboardEntry[] | null>(null);

  useEffect(() => {
    setTrainer(getTrainerProfile());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const isLoggedIn = !!getStoredUser();

        // Always fetch public data
        const [allPokemon, lbData] = await Promise.allSettled([
          api.getPokemon(),
          api.getLeaderboard(),
        ]);

        if (cancelled) return;

        let pokemonList: import('@/types').Pokemon[] = [];
        if (allPokemon.status === 'fulfilled') {
          pokemonList = allPokemon.value;
          setTotalPokemon(pokemonList.length);
        }
        if (lbData.status === 'fulfilled') setLeaderboard(lbData.value);
        else setLeaderboard([]);

        // Only fetch user-scoped data when logged in
        if (isLoggedIn) {
          const [myPool, metricsData, history] = await Promise.allSettled([
            api.getMyPool(),
            api.getAccuracyMetrics(),
            api.getBattleHistory(),
          ]);
          if (cancelled) return;

          // If pool returns 401, token is stale — clear it so UI reflects logout
          if (myPool.status === 'rejected') {
            const msg = (myPool.reason as Error)?.message ?? '';
            if (msg.includes('401') || msg.includes('Unauthorized')) {
              clearUser();
            }
          } else {
            setAssignedPokemon(myPool.value.filter(p => p.user_assigned).length);
          }

          if (metricsData.status === 'fulfilled') setMetrics(metricsData.value);
          if (history.status === 'fulfilled') {
            const sorted = [...history.value].sort((a, b) => new Date(b.predicted_at).getTime() - new Date(a.predicted_at).getTime());
            setRecentBattles(sorted.slice(0, 5));
          }

          // Load last generated team — only for authenticated users
          if (pokemonList.length > 0) {
            try {
              const exportData = await api.getShowdownExport();
              if (!cancelled && exportData.team_names && exportData.team_names.length > 0) {
                const mapped = exportData.team_names
                  .map((teamName: string) => {
                    const found = pokemonList.find(p => p.name === teamName);
                    return found ? { name: found.name, pokeapi_id: found.pokeapi_id } : null;
                  })
                  .filter((entry): entry is { name: string; pokeapi_id: number } => entry !== null);
                setLastTeam(mapped.length > 0 ? mapped : null);
              }
            } catch {
              // no team generated yet — ignore
            }
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <AuthGuard>
    <div className="pk-section">
      {/* Subtle arena floor texture */}
      <div className="pk-page-arena" aria-hidden="true" />
      <div className="pk-page-glow" aria-hidden="true" />

      {/* ── Trainer Card hero ─────────────────────────────── */}
      <header className="pk-dashboard-header">
        <TrainerCard
          totalPokemon={totalPokemon}
          assignedPokemon={assignedPokemon}
          totalBattles={metrics?.total_battles ?? null}
          accuracy={metrics?.accuracy ?? null}
          loading={loading}
          trainer={trainer}
          lastTeam={lastTeam}
          leaderboard={leaderboard}
        />

        {/* Battle Station */}
        <div className="pk-pokeball-station">
          {/* Station label */}
          <p style={{ margin: 0, fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            ◆ BATTLE STATION
          </p>

          {/* 3D Pokéball */}
          <Pokeball3D size={220} loading={false} />

          {/* Game-menu quick actions */}
          <div style={{ width: '100%' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.4rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>
              ▶ SELECT ACTION
            </p>
            <nav className="pk-quick-actions" aria-label="Quick navigation">
              <Link href="/engine1" className="pk-quick-action-item">
                <IconCrossedPokeballs size={14} color="#EF4444" />
                <span>GYM TEAM BUILDER</span>
                <span className="item-arrow">▶</span>
              </Link>
              <Link href="/engine2" className="pk-quick-action-item">
                <IconPokeballShield size={14} color="#94A3B8" />
                <span>COUNTER PICK</span>
                <span className="item-arrow">▶</span>
              </Link>
              <Link href="/engine3" className="pk-quick-action-item">
                <IconTarget size={14} color="#EF4444" />
                <span>BATTLE PREDICT</span>
                <span className="item-arrow">▶</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="pk-error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <strong style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.55rem', letterSpacing: '0.06em' }}>⚠ SYSTEM ERROR: </strong>{error}
        </div>
      )}

      {/* ── Battle arena divider ──────────────────────── */}
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', marginTop: '0.5rem' }}>
        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.4))' }} />
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.42rem', color: 'var(--pk-red)', letterSpacing: '0.1em' }}>◆ BATTLE ARENA</span>
        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(239,68,68,0.4), transparent)' }} />
      </div>

      {/* ── Pokédex stat panels ───────────────────────── */}
      <section aria-label="Summary statistics" style={{ marginBottom: 'clamp(1.5rem, 3vw, 2rem)' }}>
        <p className="pk-section-label">
          <span aria-hidden="true">◆</span> TRAINER STATUS
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'clamp(0.75rem, 2vw, 1rem)' }}>
          <StatCard label="Total Pokémon" value={totalPokemon ?? '—'} icon={<IconPokedex size={16} color="#94A3B8" />} loading={loading && totalPokemon === null} />
          <StatCard label="Assigned Pool" value={assignedPokemon ?? '—'} icon={<IconPokeballCheck size={16} color="#94A3B8" />} loading={loading && assignedPokemon === null} />
          <StatCard label="Total Battles" value={metrics?.total_battles ?? '—'} icon={<IconCrossedSwords size={16} color="#EF4444" />} loading={loading && metrics === null} />
          <StatCard label="Accuracy" value={metrics ? `${(metrics.accuracy * 100).toFixed(1)}%` : loading ? '—' : 'N/A'} icon={<IconBullseye size={16} color="#F8D030" />} loading={loading && metrics === null} accent />
        </div>
      </section>

      {/* ── Recent battle log ─────────────────────────── */}
      <hr className="pk-pixel-hr" aria-hidden="true" />
      <section aria-label="Recent battle predictions" className="pk-battle-log-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <p className="pk-section-label" style={{ margin: 0 }}>
            <span aria-hidden="true">◆</span> RECENT BATTLE LOG
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link href="/history" style={{ fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', textDecoration: 'none', letterSpacing: '0.06em' }}>
              VIEW ALL ▶
            </Link>
            {/* Battling sprites */}
            <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '0.25rem' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/25.png" alt="" loading="lazy" width={18} height={18} style={{ imageRendering: 'pixelated', filter: 'brightness(0.7)', animation: 'float-up 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.42rem', color: 'rgba(239,68,68,0.55)' }}>VS</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/150.png" alt="" loading="lazy" width={18} height={18} style={{ imageRendering: 'pixelated', filter: 'brightness(0.7)', animation: 'float-up 2s ease-in-out 1s infinite' }} />
            </div>
          </div>
        </div>
        {/* Battle flavor row */}
        {recentBattles.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 40 40" style={{ animation: 'pokeball-spin 2s linear infinite', flexShrink: 0 }}>
              <path d="M1 20 A19 19 0 0 1 39 20 Z" fill="#DC2626" />
              <path d="M1 20 A19 19 0 0 0 39 20 Z" fill="#F8FAFC" />
              <rect x="0" y="18" width="40" height="4" fill="#111" />
              <circle cx="20" cy="20" r="5" fill="#111" />
              <circle cx="20" cy="20" r="2.5" fill="#F8FAFC" />
            </svg>
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.38rem', color: 'var(--pk-text-dim)', letterSpacing: '0.06em' }}>
              {recentBattles.length} BATTLE{recentBattles.length !== 1 ? 'S' : ''} RECORDED
            </span>
            {metrics?.accuracy !== undefined && metrics.accuracy >= 0.7 && (
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-pixel)', fontSize: '0.36rem', color: '#4ADE80', letterSpacing: '0.06em', animation: 'gold-pulse 2s ease-in-out infinite' }}>
                SUPER EFFECTIVE!
              </span>
            )}
            {metrics?.accuracy !== undefined && metrics.accuracy > 0 && metrics.accuracy < 0.5 && (
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-pixel)', fontSize: '0.36rem', color: '#F87171', letterSpacing: '0.06em' }}>
                NOT VERY EFFECTIVE...
              </span>
            )}
          </div>
        )}

        <div className="pokedex-card" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div className="pk-loading-msg">
              <svg width="36" height="36" viewBox="0 0 40 40" aria-label="Loading" style={{ animation: 'pokeball-spin 0.9s linear infinite', display: 'block', margin: '0 auto' }}>
                <path d="M4 20 A16 16 0 0 1 36 20" fill="#DC2626" />
                <path d="M36 20 A16 16 0 0 1 4 20" fill="#F8FAFC" />
                <line x1="4" y1="20" x2="36" y2="20" stroke="#111" strokeWidth="2.5" />
                <circle cx="20" cy="20" r="4.5" fill="#111" />
                <circle cx="20" cy="20" r="2.5" fill="#F8FAFC" />
              </svg>
              <p className="pk-loading-title" style={{ color: 'var(--pk-red)' }}>LOADING BATTLE LOG...</p>
              <p className="pk-loading-sub">Scanning battle records</p>
            </div>
          ) : recentBattles.length === 0 ? (
            <ProfessorOak message="There is a time and place for everything, but not now." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="pk-table" style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Recent battles">
                <thead>
                  <tr>
                    <th style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.42rem' }}>◆ BATTLERS</th>
                    <th style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.42rem' }}>PREDICTED</th>
                    <th style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.42rem' }}>CONF</th>
                    <th style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.42rem' }}>RESULT</th>
                    <th style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.42rem' }}>TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBattles.map((b, idx) => (
                    <tr key={b.match_id} className="pk-log-table-row">
                      <td style={{ fontWeight: 600, textTransform: 'capitalize', whiteSpace: 'nowrap', position: 'relative', paddingLeft: '1.5rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`${SPRITE_BASE}/0.png`} alt="" width={20} height={20} style={{ imageRendering: 'pixelated', opacity: 0.6 }} loading="lazy" />
                          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.4rem', color: 'var(--pk-text-dim)', minWidth: '1rem' }}>
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          {b.battler_a} <span style={{ color: 'var(--pk-text-dim)' }}>vs</span> {b.battler_b}
                        </span>
                      </td>
                      <td style={{ textTransform: 'capitalize', color: 'var(--pk-text)' }}>{b.predicted_winner}</td>
                      <td style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.5rem', fontWeight: 700, color: 'var(--pk-gold)' }}>
                        {(b.confidence_score > 1 ? b.confidence_score : b.confidence_score * 100).toFixed(1)}%
                      </td>
                      <td><ResultBadge b={b} /></td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--pk-text-dim)', fontSize: '0.72rem' }}>{formatTimestamp(b.predicted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pk-table-scroll-hint">◆ SHOWING LAST 5 RECORDS</div>
            </div>
          )}
        </div>
      </section>
    </div>
    </AuthGuard>
  );
}
