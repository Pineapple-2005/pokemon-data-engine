'use client';

import React, { useState } from 'react';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { api } from '@/lib/api';
import type { ReplayEvent } from '@/types';

const EVENT_ICONS: Record<string, string> = {
  move:   '⚔',
  switch: '↔',
  damage: '💢',
  heal:   '💚',
  faint:  '💀',
  turn:   '▶',
  win:    '🏆',
};

const PLAYER_COLORS: Record<string, string> = {
  p1: '#6890F0',
  p2: '#F08030',
};

function extractReplayId(input: string): string {
  const trimmed = input.trim();
  // Full URL: https://replay.pokemonshowdown.com/gen1ou-12345
  const match = trimmed.match(/replay\.pokemonshowdown\.com\/([^?\s/]+)/);
  if (match) return match[1];
  return trimmed;
}

function formatEvent(event: ReplayEvent): string {
  const player = event.player ? (event.player === 'p1' ? 'PLAYER 1' : 'PLAYER 2') : '';
  switch (event.type) {
    case 'move':   return `${player} — ${event.pokemon ?? ''} used ${event.detail ?? ''}`;
    case 'switch': return `${player} — Sent out ${event.pokemon ?? ''}`;
    case 'damage': return `${event.pokemon ?? ''} took damage (${event.detail ?? ''})`;
    case 'heal':   return `${event.pokemon ?? ''} recovered HP (${event.detail ?? ''})`;
    case 'faint':  return `${event.pokemon ?? ''} fainted!`;
    case 'win':    return `Winner: ${event.detail ?? ''}`;
    default:       return event.detail ?? '';
  }
}

export default function Engine10Page() {
  const [inputId, setInputId] = useState('');
  const [events, setEvents] = useState<ReplayEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function handleLoad() {
    const id = extractReplayId(inputId);
    if (!id) return;
    setLoading(true); setError(null); setEvents([]); setLoaded(false);
    try {
      const data = await api.getReplayTimeline(id);
      setEvents(data);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load replay');
    } finally {
      setLoading(false);
    }
  }

  // Group events by turn number
  const turnGroups = events.reduce<Map<number, ReplayEvent[]>>((acc, ev) => {
    const key = ev.type === 'win' ? -1 : ev.turn;
    const group = acc.get(key) ?? [];
    group.push(ev);
    acc.set(key, group);
    return acc;
  }, new Map());

  const turnNumbers = Array.from(turnGroups.keys())
    .filter((k) => k >= 0)
    .sort((a, b) => a - b);
  const winEvents = turnGroups.get(-1) ?? [];

  return (
    <AuthGuard>
      <div className="pk-section">

        {/* Header */}
        <header style={{ marginBottom: 'clamp(1.25rem, 3vw, 1.75rem)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.12em' }}>
              ENGINE 10 | VISUALIZER
            </span>
          </div>
          <h1 style={{ margin: '0 0 0.3rem', fontSize: 'clamp(1.3rem,3vw,2rem)', fontWeight: 900, color: 'var(--pk-text)' }}>
            The Replay
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--pk-text-muted)' }}>
            Replay any Pokemon Showdown battle turn by turn.
          </p>
        </header>

        {/* Input */}
        <div style={{
          background: '#0a0e1a', border: '1px solid rgba(120,200,80,0.15)',
          borderRadius: '0.875rem', padding: '1.25rem', marginBottom: '1.25rem',
        }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.08em' }}>
            ◆ REPLAY ID OR URL
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              placeholder="gen1ou-12345 or https://replay.pokemonshowdown.com/gen1ou-12345"
              className="pk-input"
              style={{ flex: '1 1 300px', fontSize: '16px' }}
              onKeyDown={(e) => { if (e.key === 'Enter') { void handleLoad(); } }}
            />
            <button
              type="button"
              onClick={() => { void handleLoad(); }}
              disabled={!inputId.trim() || loading}
              style={{
                padding: '0.625rem 1.5rem',
                background: loading || !inputId.trim() ? 'rgba(255,255,255,0.04)' : 'rgba(120,200,80,0.12)',
                border: '1px solid rgba(120,200,80,0.35)',
                borderRadius: '0.5rem',
                color: '#78C850',
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.52rem',
                letterSpacing: '0.08em',
                cursor: loading || !inputId.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                flexShrink: 0,
                opacity: !inputId.trim() ? 0.45 : 1,
              }}
            >
              {loading ? <><LoadingSpinner size="sm" /><span>LOADING REPLAY...</span></> : 'LOAD REPLAY'}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" style={{
            background: '#2a0505', border: '2px solid rgba(239,68,68,0.5)',
            borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem',
          }}>
            <p style={{ margin: 0, fontSize: '0.6rem', fontFamily: 'var(--font-pixel)', color: '#EF4444' }}>REPLAY ERROR</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)' }}>{error}</p>
          </div>
        )}

        {loaded && events.length === 0 && (
          <p style={{ fontSize: '0.8rem', color: 'var(--pk-text-muted)' }}>No parseable events found in this replay.</p>
        )}

        {loaded && events.length > 0 && (
          <div style={{
            background: '#060c12',
            border: '1px solid rgba(120,200,80,0.2)',
            borderRadius: '0.875rem',
            overflow: 'hidden',
          }}>
            {/* Battle log header */}
            <div style={{
              padding: '0.625rem 1rem',
              background: 'rgba(120,200,80,0.04)',
              borderBottom: '1px solid rgba(120,200,80,0.15)',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <span style={{ fontSize: '0.52rem', fontFamily: 'var(--font-pixel)', color: '#78C850', letterSpacing: '0.1em' }}>
                BATTLE LOG
              </span>
              <span style={{ fontSize: '0.42rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', marginLeft: 'auto', letterSpacing: '0.06em' }}>
                {turnNumbers.length} TURNS — {events.length} EVENTS
              </span>
            </div>

            {/* Player legend */}
            <div style={{ padding: '0.5rem 1rem', display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              {(['p1','p2'] as const).map((p) => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: PLAYER_COLORS[p] }} />
                  <span style={{ fontSize: '0.4rem', fontFamily: 'var(--font-pixel)', color: PLAYER_COLORS[p], letterSpacing: '0.06em' }}>
                    {p.toUpperCase()} = PLAYER {p[1]}
                  </span>
                </div>
              ))}
            </div>

            {/* Turn blocks */}
            <div style={{ maxHeight: '65vh', overflowY: 'auto', padding: '0.75rem' }}>
              {turnNumbers.map((turn) => {
                const turnEvents = (turnGroups.get(turn) ?? []).filter((e) => e.type !== 'turn');
                return (
                  <div key={turn} style={{ marginBottom: '0.75rem' }}>
                    <div style={{
                      fontSize: '0.46rem', fontFamily: 'var(--font-pixel)',
                      color: 'rgba(120,200,80,0.6)', letterSpacing: '0.1em',
                      padding: '0.25rem 0.5rem',
                      borderLeft: '2px solid rgba(120,200,80,0.25)',
                      marginBottom: '0.3rem',
                    }}>
                      TURN {turn}
                    </div>
                    {turnEvents.map((ev, i) => {
                      const isFaint = ev.type === 'faint';
                      const playerColor = ev.player ? PLAYER_COLORS[ev.player] : undefined;
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                          padding: '0.3rem 0.5rem',
                          background: isFaint ? 'rgba(239,68,68,0.06)' : 'transparent',
                          borderRadius: '0.3rem',
                          marginBottom: '0.15rem',
                        }}>
                          <span style={{ fontSize: '0.9rem', flexShrink: 0, lineHeight: 1.2 }} aria-hidden="true">
                            {EVENT_ICONS[ev.type] ?? '·'}
                          </span>
                          <span style={{
                            fontSize: '0.78rem',
                            color: isFaint ? '#EF4444' : playerColor ?? 'var(--pk-text-muted)',
                            fontFamily: 'monospace',
                            lineHeight: 1.5,
                          }}>
                            {formatEvent(ev)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Win highlight */}
              {winEvents.length > 0 && winEvents.map((ev, i) => (
                <div key={`win-${i}`} style={{
                  margin: '1rem 0 0.5rem',
                  padding: '1rem',
                  background: 'rgba(248,208,48,0.08)',
                  border: '2px solid rgba(248,208,48,0.4)',
                  borderRadius: '0.625rem',
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                }}>
                  <span style={{ fontSize: '1.5rem' }} aria-hidden="true">🏆</span>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: '#F8D030', letterSpacing: '0.1em' }}>
                      BATTLE OVER
                    </p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '1rem', fontWeight: 900, color: '#F8D030' }}>
                      {ev.detail} wins!
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
