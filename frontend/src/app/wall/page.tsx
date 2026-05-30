'use client';

import React, { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { LeaderboardEntry } from '@/types';

const RANK_COLORS: Record<number, string> = { 1: '#F8D030', 2: '#C0C0C0', 3: '#CD7F32' };

function PokeBallLogo() {
  return (
    <svg width="48" height="48" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="none" stroke="#555" strokeWidth="2" />
      <path d="M2 20 A18 18 0 0 1 38 20" fill="#DC2626" />
      <path d="M38 20 A18 18 0 0 1 2 20" fill="#e8e8e8" />
      <line x1="2" y1="20" x2="38" y2="20" stroke="#222" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="5" fill="#222" />
      <circle cx="20" cy="20" r="2.8" fill="#e8e8e8" />
    </svg>
  );
}

export default function WallPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [flashRanks, setFlashRanks] = useState<Set<string>>(new Set());
  const prevRanks = useRef<Map<string, number>>(new Map());

  async function fetchLeaderboard() {
    try {
      const data = await api.getLeaderboard();
      const changed = new Set<string>();
      data.forEach((entry) => {
        const prev = prevRanks.current.get(entry.trainer);
        if (prev !== undefined && prev !== entry.rank) {
          changed.add(entry.trainer);
        }
      });
      if (changed.size > 0) {
        setFlashRanks(changed);
        setTimeout(() => setFlashRanks(new Set()), 1500);
      }
      const newMap = new Map<string, number>();
      data.forEach((e) => newMap.set(e.trainer, e.rank));
      prevRanks.current = newMap;
      setLeaderboard(data);
      setLastRefresh(new Date());
    } catch {
      // silently retry on next interval
    }
  }

  useEffect(() => {
    void fetchLeaderboard();
    const interval = setInterval(() => { void fetchLeaderboard(); }, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden',
      background: '#050810',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-pixel)',
    }}>
      <style>{`
        @keyframes wall-pulse { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
        @keyframes row-flash { 0%,100% { background: rgba(248,208,48,0.12); } 50% { background: rgba(248,208,48,0.04); } }
      `}</style>

      {/* Header bar */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '0.75rem 2rem',
        background: 'linear-gradient(180deg, #0d1120 0%, rgba(13,17,32,0.9) 100%)',
        borderBottom: '2px solid rgba(239,68,68,0.25)',
      }}>
        <PokeBallLogo />
        <div>
          <p style={{ margin: 0, fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em' }}>
            POKEMON DATA ENGINE
          </p>
          <p style={{ margin: 0, fontSize: 'clamp(1rem,2.5vw,1.5rem)', color: '#fff', letterSpacing: '0.1em' }}>
            LIVE LEADERBOARD
          </p>
        </div>

        {/* LIVE indicator */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%', background: '#EF4444',
            animation: 'wall-pulse 1s ease infinite',
          }} />
          <span style={{ fontSize: '0.65rem', color: '#EF4444', letterSpacing: '0.15em' }}>LIVE</span>
          <span style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.3)', marginLeft: '1rem', letterSpacing: '0.06em' }}>
            {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Table header */}
      <div style={{
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: '100px 1fr 100px 100px 120px 120px',
        padding: '0.6rem 2rem',
        background: 'rgba(0,0,0,0.4)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {['RANK', 'TRAINER', 'W', 'L', 'WIN%', 'BATTLES'].map((h) => (
          <span key={h} style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {leaderboard.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
              NO BATTLES RECORDED YET
            </p>
          </div>
        )}
        {leaderboard.map((entry, i) => {
          const rankColor = RANK_COLORS[entry.rank] ?? '#fff';
          const isFlashing = flashRanks.has(entry.trainer);
          return (
            <div
              key={entry.trainer}
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 1fr 100px 100px 120px 120px',
                padding: '1rem 2rem',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: isFlashing
                  ? undefined
                  : i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                animation: isFlashing ? 'row-flash 0.4s ease 3' : undefined,
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 'clamp(1.1rem,2vw,1.5rem)', fontWeight: 900, color: rankColor }}>
                #{entry.rank}
              </span>
              <span style={{ fontSize: 'clamp(1.1rem,2vw,1.5rem)', fontWeight: 700, color: rankColor, letterSpacing: '0.05em' }}>
                {entry.trainer}
              </span>
              <span style={{ fontSize: 'clamp(1rem,1.8vw,1.3rem)', color: '#78C850', fontWeight: 700 }}>
                {entry.wins}
              </span>
              <span style={{ fontSize: 'clamp(1rem,1.8vw,1.3rem)', color: '#EF4444', fontWeight: 700 }}>
                {entry.losses}
              </span>
              <span style={{ fontSize: 'clamp(1rem,1.8vw,1.3rem)', color: rankColor, fontWeight: 700 }}>
                {(entry.win_rate * 100).toFixed(1)}%
              </span>
              <span style={{ fontSize: 'clamp(0.9rem,1.5vw,1.1rem)', color: 'rgba(255,255,255,0.5)' }}>
                {entry.total_battles}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        flexShrink: 0,
        padding: '0.5rem 2rem',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
          REFRESHES EVERY 10 SECONDS
        </span>
        <span style={{ fontSize: '0.42rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>
          LAST REFRESH: {lastRefresh.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
