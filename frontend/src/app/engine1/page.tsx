'use client';

import React, { useRef, useState } from 'react';
import { TeamGrid } from '@/components/engines/TeamGrid';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { ProfessorOak } from '@/components/ui/ProfessorOak';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { api } from '@/lib/api';
import { storeBattlePredictorDraft } from '@/lib/battle-transfer';
import { useSessionState } from '@/hooks/useSessionState';
import type { Engine1Response, TeamSlot } from '@/types';

/* ── Type colour map ──────────────────────────────────────────────────── */
const TYPE_COLORS: Record<string, { primary: string; bg: string; glow: string }> = {
  Normal:   { primary: '#A8A878', bg: 'rgba(168,168,120,0.10)', glow: 'rgba(168,168,120,0.35)' },
  Fire:     { primary: '#F08030', bg: 'rgba(240,128,48,0.10)',  glow: 'rgba(240,128,48,0.40)' },
  Water:    { primary: '#6890F0', bg: 'rgba(104,144,240,0.10)', glow: 'rgba(104,144,240,0.40)' },
  Grass:    { primary: '#78C850', bg: 'rgba(120,200,80,0.10)',  glow: 'rgba(120,200,80,0.35)' },
  Electric: { primary: '#F8D030', bg: 'rgba(248,208,48,0.10)',  glow: 'rgba(248,208,48,0.45)' },
  Ice:      { primary: '#98D8D8', bg: 'rgba(152,216,216,0.10)', glow: 'rgba(152,216,216,0.35)' },
  Fighting: { primary: '#C03028', bg: 'rgba(192,48,40,0.10)',   glow: 'rgba(192,48,40,0.40)' },
  Poison:   { primary: '#A040A0', bg: 'rgba(160,64,160,0.10)',  glow: 'rgba(160,64,160,0.40)' },
  Ground:   { primary: '#E0C068', bg: 'rgba(224,192,104,0.10)', glow: 'rgba(224,192,104,0.35)' },
  Flying:   { primary: '#A890F0', bg: 'rgba(168,144,240,0.10)', glow: 'rgba(168,144,240,0.40)' },
  Psychic:  { primary: '#F85888', bg: 'rgba(248,88,136,0.10)',  glow: 'rgba(248,88,136,0.40)' },
  Bug:      { primary: '#A8B820', bg: 'rgba(168,184,32,0.10)',  glow: 'rgba(168,184,32,0.35)' },
  Rock:     { primary: '#B8A038', bg: 'rgba(184,160,56,0.10)',  glow: 'rgba(184,160,56,0.35)' },
  Ghost:    { primary: '#705898', bg: 'rgba(112,88,152,0.10)',  glow: 'rgba(112,88,152,0.45)' },
  Dragon:   { primary: '#7038F8', bg: 'rgba(112,56,248,0.10)',  glow: 'rgba(112,56,248,0.45)' },
  Dark:     { primary: '#705848', bg: 'rgba(112,88,72,0.12)',   glow: 'rgba(112,88,72,0.35)' },
  Steel:    { primary: '#B8B8D0', bg: 'rgba(184,184,208,0.10)', glow: 'rgba(184,184,208,0.35)' },
  Fairy:    { primary: '#EE99AC', bg: 'rgba(238,153,172,0.10)', glow: 'rgba(238,153,172,0.40)' },
  Balanced: { primary: '#94A3B8', bg: 'rgba(148,163,184,0.08)', glow: 'rgba(148,163,184,0.25)' },
};

/* ── Gym type icons ───────────────────────────────────────────────────── */
const TYPE_SYMBOLS: Record<string, string> = {
  Normal:'◎', Fire:'🔥', Water:'💧', Grass:'🌿', Electric:'⚡',
  Ice:'❄', Fighting:'👊', Poison:'☠', Ground:'⛰', Flying:'🌀',
  Psychic:'🔮', Bug:'🐛', Rock:'🪨', Ghost:'👻', Dragon:'🐉',
  Dark:'🌑', Steel:'⚙', Fairy:'✨', Balanced:'⚖',
};

const POKEMON_TYPES = [
  'Balanced', 'Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

/* ── Gym badge SVG (8-point star) ─────────────────────────────────────── */
function GymBadgeStar({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <polygon
        points="12,2 13.8,8.2 20,8.2 14.9,12 16.9,18.2 12,14.8 7.1,18.2 9.1,12 4,8.2 10.2,8.2"
        fill={color}
        stroke="rgba(0,0,0,0.4)"
        strokeWidth="0.8"
      />
      <polygon
        points="12,4 13.2,8.8 18,8.8 14.3,11.4 15.7,16 12,13.2 8.3,16 9.7,11.4 6,8.8 10.8,8.8"
        fill="rgba(255,255,255,0.25)"
      />
      <circle cx="12" cy="12" r="3" fill="rgba(255,255,255,0.15)" />
    </svg>
  );
}

/* ── Arena background — type-reactive tile pattern ───────────────────── */
function ArenaBackground({ typeColor }: { typeColor: { primary: string; bg: string } }) {
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      borderRadius: 'inherit', zIndex: 0, pointerEvents: 'none',
    }}>
      {/* Checkerboard arena floor */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.04 }}>
        <defs>
          <pattern id="arena-tiles" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill={typeColor.primary} />
            <rect x="20" y="20" width="20" height="20" fill={typeColor.primary} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#arena-tiles)" />
      </svg>
      {/* Radial glow from centre */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 60% 40% at 50% 50%, ${typeColor.bg} 0%, transparent 70%)`,
      }} />
      {/* Top vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(10,14,26,0.7) 0%, transparent 40%, transparent 60%, rgba(10,14,26,0.7) 100%)',
      }} />
    </div>
  );
}

/* ── Difficulty badge (8-bit medal style) ────────────────────────────── */
const DIFF_CONFIG = {
  easy:   { label: 'EASY',   color: '#78C850', icon: '🌱', desc: 'Lower BST · Basic roles',     badge: 'BOULDER' },
  medium: { label: 'MEDIUM', color: '#F8D030', icon: '⚡', desc: 'Balanced composition',         badge: 'THUNDER' },
  hard:   { label: 'HARD',   color: '#F08030', icon: '🔥', desc: 'Optimised · High BST',         badge: 'VOLCANO' },
} as const;

/* ── Pokémon cry button ──────────────────────────────────────────────── */
const CRY_BASE = 'https://raw.githubusercontent.com/PokeAPI/sounds/master/cries';

function CryButton({ slot }: { readonly slot: TeamSlot }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  function handleCry() {
    if (!slot.pokeapi_id) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    const audio = new Audio(`${CRY_BASE}/${slot.pokeapi_id}.ogg`);
    audioRef.current = audio;
    audio.addEventListener('ended', () => setPlaying(false));
    audio.addEventListener('error', () => setPlaying(false));
    setPlaying(true);
    void audio.play().catch(() => setPlaying(false));
  }
  return (
    <button type="button" onClick={handleCry} aria-label={`Play ${slot.name} cry`}
      className="cry-btn" title={playing ? 'Playing…' : `Play ${slot.name}'s cry`}>
      {playing ? '🔊' : '🔈'}
    </button>
  );
}

function TeamSlotWithCry({ slot }: { readonly slot: TeamSlot }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', zIndex: 2 }}>
        <CryButton slot={slot} />
      </div>
      <TeamGrid team={[slot]} />
      {/* Native region badge */}
      <div style={{ marginTop: '0.35rem', paddingLeft: '0.25rem' }}>
        <span style={{
          display: 'inline-block',
          fontSize: '0.35rem',
          fontFamily: 'var(--font-pixel)',
          color: '#78C850',
          border: '1px solid rgba(120,200,80,0.4)',
          borderRadius: '0.2rem',
          padding: '0.1rem 0.35rem',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          {slot.native_region ?? 'KANTO'} · GEN {slot.generation ?? 1}
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════ */
export default function Engine1Page() {
  const [theme, setTheme] = useSessionState('engine1.theme', 'Fire');
  const [difficulty, setDifficulty] = useSessionState<'easy' | 'medium' | 'hard'>('engine1.difficulty', 'medium');
  const [region, setRegion] = useSessionState('engine1.region', 'Kanto');
  const [gymLeaderName, setGymLeaderName] = useSessionState('engine1.gymLeaderName', '');
  const [section, setSection] = useSessionState('engine1.section', '3ISC');
  const [groupName, setGroupName] = useSessionState('engine1.groupName', '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useSessionState<Engine1Response | null>('engine1.result', null);
  const [error, setError] = useState<string | null>(null);
  const [showCopied, setShowCopied] = useState(false);
  const [showOpenTip, setShowOpenTip] = useState(false);
  const lineupHistoryRef = useRef<string[][]>([]);

  async function getShowdownText(): Promise<string> {
    if (result?.showdown_text) return result.showdown_text;
    return (await api.getShowdownExport()).text;
  }

  async function handleShowdownExport() {
    if (!result) return;
    const text = await getShowdownText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard unavailable — continue anyway
    }
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  }

  const tc = TYPE_COLORS[theme] ?? TYPE_COLORS['Balanced'];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await api.generateGymLeaderTeam(
        theme,
        difficulty,
        region,
        gymLeaderName,
        section,
        groupName,
        result?.team.map((slot) => slot.name) ?? [],
        lineupHistoryRef.current,
        Date.now(),
      );
      lineupHistoryRef.current.push(data.team.map((slot) => slot.name));
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate team');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGuard>
    <div className="pk-section">

      {/* ── Page header ─────────────────────────────────────── */}
      <header style={{ marginBottom: 'clamp(1.25rem, 3vw, 1.75rem)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.625rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.12em' }}>
            ENGINE 1
          </span>
          {/* Gym badge tag */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(248,208,48,0.08)', border: '1px solid rgba(248,208,48,0.35)',
            borderRadius: '0.4rem', padding: '0.3rem 0.65rem',
          }}>
            <GymBadgeStar color="#F8D030" size={13} />
            <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: '#F8D030', letterSpacing: '0.08em' }}>
              GYM LEADER
            </span>
          </div>
        </div>
        <h1 style={{ margin: '0 0 0.3rem', fontSize: 'clamp(1.3rem, 3vw, 2rem)', fontWeight: 900, color: 'var(--pk-text)' }}>
          Gym Leader Team Builder
        </h1>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--pk-text-muted)' }}>
          Build a Gym Leader's team using ML clustering. Pick a type specialty and challenge rank.
        </p>
      </header>

      {/* ── Main gym arena card ─────────────────────────────── */}
      <form onSubmit={handleSubmit} aria-label="Team generation form">
        <div style={{
          position: 'relative', borderRadius: '1rem', overflow: 'hidden', marginBottom: '1.25rem',
          border: `2px solid ${tc.primary}44`,
          boxShadow: `0 0 40px ${tc.glow}, inset 0 0 60px ${tc.bg}`,
          background: '#0d1120',
          transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
        }}>
          <ArenaBackground typeColor={tc} />

          <div style={{ position: 'relative', zIndex: 1, padding: 'clamp(1.25rem, 3vw, 2rem)' }}>

            {/* ── Arena title strip ─────────────────────────── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }} aria-hidden="true">
                  {TYPE_SYMBOLS[theme] ?? '⚔'}
                </span>
                <div>
                  <p style={{ margin: 0, fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: tc.primary, letterSpacing: '0.1em', opacity: 0.8 }}>
                    GYM ARENA
                  </p>
                  <p style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'var(--font-pixel)', color: tc.primary, textShadow: `0 0 12px ${tc.glow}` }}>
                    {theme.toUpperCase()} TYPE
                  </p>
                </div>
              </div>
              {/* Live type badge */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {theme !== 'Balanced' && <TypeBadge type={theme} size="md" />}
              </div>
            </div>

            {/* ── Region + Gym Leader Name + Section/Group ─ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>

              {/* Region selector */}
              <div>
                <p style={{
                  margin: '0 0 0.5rem',
                  fontSize: '0.5rem', fontFamily: 'var(--font-pixel)',
                  color: 'var(--pk-text-muted)', letterSpacing: '0.08em',
                }}>
                  ◆ GYM LEADER REGION
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {(['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea'] as string[]).map((r) => {
                    const active = region === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRegion(r)}
                        style={{
                          fontFamily: 'var(--font-pixel)',
                          fontSize: '0.5rem',
                          letterSpacing: '0.06em',
                          padding: '0.4rem 0.9rem',
                          borderRadius: '0.4rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: active ? '2px solid #B8B8D0' : '2px solid rgba(184,184,208,0.2)',
                          background: active ? 'rgba(184,184,208,0.12)' : 'rgba(0,0,0,0.25)',
                          color: active ? '#B8B8D0' : 'rgba(255,255,255,0.4)',
                          boxShadow: active ? '0 0 10px rgba(184,184,208,0.35)' : 'none',
                        }}
                      >
                        {r.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gym Leader Name */}
              <div>
                <label htmlFor="gym-leader-name" style={{
                  display: 'block', marginBottom: '0.4rem',
                  fontSize: '0.5rem', fontFamily: 'var(--font-pixel)',
                  color: 'var(--pk-text-muted)', letterSpacing: '0.08em',
                }}>
                  ◆ GYM LEADER NAME
                </label>
                <input
                  id="gym-leader-name"
                  type="text"
                  value={gymLeaderName}
                  onChange={(e) => setGymLeaderName(e.target.value)}
                  placeholder="e.g. Misty, Morty, Valerie..."
                  className="pk-input"
                  style={{ fontSize: '16px', maxWidth: '320px', width: '100%' }}
                />
              </div>

              {/* Section + Group Name side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxWidth: '640px' }}>
                <div>
                  <label htmlFor="section" style={{
                    display: 'block', marginBottom: '0.4rem',
                    fontSize: '0.5rem', fontFamily: 'var(--font-pixel)',
                    color: 'var(--pk-text-muted)', letterSpacing: '0.08em',
                  }}>
                    ◆ SECTION
                  </label>
                  <input
                    id="section"
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="e.g. 3ISC"
                    className="pk-input"
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <div>
                  <label htmlFor="group-name" style={{
                    display: 'block', marginBottom: '0.4rem',
                    fontSize: '0.5rem', fontFamily: 'var(--font-pixel)',
                    color: 'var(--pk-text-muted)', letterSpacing: '0.08em',
                  }}>
                    ◆ GROUP NAME
                  </label>
                  <input
                    id="group-name"
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Group 1"
                    className="pk-input"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>

              {/* ── Type selector ──────────────────────────── */}
              <div>
                <p style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.52rem', fontFamily: 'var(--font-pixel)',
                  color: 'var(--pk-text-muted)', marginBottom: '0.6rem', letterSpacing: '0.08em',
                  margin: '0 0 0.6rem',
                }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                    <polygon points="5,0 6.2,3.5 10,3.5 7,5.8 8.1,9 5,7 1.9,9 3,5.8 0,3.5 3.8,3.5" fill="currentColor" opacity="0.7"/>
                  </svg>
                  TYPE SPECIALITY
                </p>

                {/* Type grid picker — single select (radio-style) */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px',
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '0.625rem', padding: '6px',
                }}>
                  {POKEMON_TYPES.map((t) => {
                    const tColor = TYPE_COLORS[t] ?? TYPE_COLORS['Balanced'];
                    const active = theme === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTheme(t)}
                        title={t}
                        style={{
                          border: active ? `1px solid ${tColor.primary}` : '1px solid transparent',
                          borderRadius: '0.35rem',
                          padding: '5px 2px',
                          background: active ? tColor.bg : 'transparent',
                          cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                          transition: 'all 0.15s ease',
                          boxShadow: active ? `0 0 8px ${tColor.glow}` : 'none',
                          opacity: active ? 1 : 0.4,
                        }}
                      >
                        <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>{TYPE_SYMBOLS[t] ?? '◎'}</span>
                        <span style={{
                          fontSize: '0.32rem', fontFamily: 'var(--font-pixel)',
                          color: active ? tColor.primary : 'rgba(255,255,255,0.35)',
                          letterSpacing: '0.04em', whiteSpace: 'nowrap',
                        }}>
                          {t.toUpperCase().slice(0, 5)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Difficulty (gym badges) ─────────────────── */}
              <div>
                <p style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.52rem', fontFamily: 'var(--font-pixel)',
                  color: 'var(--pk-text-muted)', marginBottom: '0.6rem', letterSpacing: '0.08em', margin: '0 0 0.6rem',
                }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                    <circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.7"/>
                    <circle cx="5" cy="5" r="2" fill="currentColor" opacity="0.7"/>
                  </svg>
                  CHALLENGE RANK
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {(Object.entries(DIFF_CONFIG) as [typeof difficulty, typeof DIFF_CONFIG[keyof typeof DIFF_CONFIG]][]).map(([value, cfg]) => {
                    const active = difficulty === value;
                    return (
                      <label key={value} style={{
                        display: 'flex', alignItems: 'center', gap: '0.875rem',
                        border: active ? `2px solid ${cfg.color}` : '2px solid rgba(255,255,255,0.07)',
                        borderRadius: '0.625rem', padding: '0.625rem 0.875rem',
                        cursor: 'pointer',
                        background: active ? `rgba(${cfg.color.slice(1).match(/.{2}/g)!.map(h=>parseInt(h,16)).join(',')},0.1)` : 'rgba(0,0,0,0.25)',
                        transition: 'all 0.18s ease',
                        boxShadow: active ? `0 0 16px ${cfg.color}55` : 'none',
                      }}>
                        <input type="radio" name="difficulty" value={value} checked={active}
                          onChange={() => setDifficulty(value)}
                          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />

                        {/* Badge star */}
                        <div style={{ flexShrink: 0 }}>
                          <GymBadgeStar color={active ? cfg.color : 'rgba(255,255,255,0.2)'} size={28} />
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: active ? cfg.color : 'var(--pk-text)', fontFamily: 'var(--font-body)' }}>
                              {cfg.label}
                            </span>
                            <span style={{
                              fontSize: '0.42rem', fontFamily: 'var(--font-pixel)',
                              color: active ? cfg.color : 'rgba(255,255,255,0.2)',
                              border: `1px solid ${active ? cfg.color + '66' : 'rgba(255,255,255,0.1)'}`,
                              borderRadius: '0.25rem', padding: '0.1rem 0.3rem', letterSpacing: '0.06em',
                            }}>
                              {cfg.badge} BADGE
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.65rem', color: active ? 'rgba(255,255,255,0.65)' : 'var(--pk-text-dim)', lineHeight: 1.3 }}>
                            {cfg.desc}
                          </p>
                        </div>

                        <span style={{ fontSize: '1.1rem', opacity: active ? 1 : 0.3 }} aria-hidden="true">{cfg.icon}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Submit button ──────────────────────────────── */}
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  background: loading ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg, ${tc.primary}cc, ${tc.primary}88)`,
                  border: `2px solid ${tc.primary}`,
                  borderRadius: '0.625rem',
                  color: '#fff',
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '0.6rem',
                  letterSpacing: '0.08em',
                  padding: '0.75rem 2rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.55 : 1,
                  boxShadow: loading ? 'none' : `0 0 20px ${tc.glow}, 0 4px 14px rgba(0,0,0,0.4)`,
                  transition: 'all 0.2s ease',
                  textTransform: 'uppercase',
                }}
              >
                {loading ? (
                  <><LoadingSpinner size="sm" /><span>BUILDING TEAM...</span></>
                ) : (
                  <>
                    <span style={{ fontSize: '1rem' }}>
                      {TYPE_SYMBOLS[theme] ?? '⚔'}
                    </span>
                    <span>CHOOSE THIS TEAM</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* ── Error ───────────────────────────────────────────── */}
      {error && (
        <div role="alert" style={{
          background: '#2a0505', border: '2px solid rgba(239,68,68,0.5)',
          borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem',
          display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        }}>
          <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>⚠</span>
          <div>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.6rem', fontFamily: 'var(--font-pixel)', color: '#EF4444', letterSpacing: '0.06em' }}>
              SYSTEM ERROR
            </p>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)' }}>{error}</p>
          </div>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <div style={{ marginBottom: '1rem' }}>
            <LoadingSpinner size="lg" />
          </div>
          <p style={{ margin: 0, fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: tc.primary, letterSpacing: '0.1em', animation: 'gold-pulse 1.5s ease infinite' }}>
            CLUSTERING GYM TEAM...
          </p>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.7rem', color: 'var(--pk-text-dim)' }}>ML engines are selecting your {theme} specialists</p>
        </div>
      )}

      {/* ── Oak idle state ──────────────────────────────────── */}
      {!result && !loading && !error && (
        <ProfessorOak message={`Welcome, Trainer! Select a type speciality and challenge rank to build your Gym Leader team.`} />
      )}

      {/* ── Results ─────────────────────────────────────────── */}
      {result && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* VS Screen header */}
          <div style={{
            position: 'relative', borderRadius: '0.875rem', overflow: 'hidden',
            border: `2px solid ${tc.primary}55`,
            background: `linear-gradient(135deg, #0d1120 0%, ${tc.bg} 50%, #0d1120 100%)`,
            padding: '1.25rem 1.5rem',
            boxShadow: `0 0 30px ${tc.glow}`,
          }}>
            {/* Diagonal stripe decoration */}
            <div aria-hidden="true" style={{
              position: 'absolute', inset: 0,
              background: `repeating-linear-gradient(45deg, transparent, transparent 18px, ${tc.bg} 18px, ${tc.bg} 20px)`,
              opacity: 0.4,
            }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: '0 0 0.2rem', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: tc.primary, letterSpacing: '0.12em' }}>
                  GYM TEAM READY
                </p>
                <h2 style={{ margin: 0, fontSize: 'clamp(1rem, 2.5vw, 1.4rem)', fontWeight: 900, color: '#fff' }}>
                  {result.theme} Gym Leader · <span style={{ color: tc.primary }}>{region}</span>
                </h2>
              </div>
              {/* Show a badge for each type from the result — backend joins them with '/' */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {result.theme.split('/').map(t => t.trim()).filter(t => t && t !== 'Balanced').map(t => (
                  <TypeBadge key={t} type={t} size="md" />
                ))}
              </div>
              <span style={{
                marginLeft: 'auto', fontSize: '0.45rem', fontFamily: 'var(--font-pixel)',
                color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.25rem', padding: '0.25rem 0.6rem', textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                {result.difficulty}
              </span>
            </div>
          </div>

          {/* Team grid */}
          <div>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.52rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.1em' }}>
              ▶ TEAM ROSTER
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'clamp(0.75rem, 2vw, 1rem)' }}>
              {result.team.map((slot) => (
                <TeamSlotWithCry key={slot.slot} slot={slot} />
              ))}
            </div>
          </div>

          {/* Stats panels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {/* Clustering metrics */}
            <div style={{
              background: '#0d1120', border: `1px solid ${tc.primary}33`,
              borderRadius: '0.875rem', padding: '1.125rem',
              boxShadow: `inset 0 0 20px ${tc.bg}`,
            }}>
              <p style={{ margin: '0 0 0.875rem', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: tc.primary, letterSpacing: '0.1em' }}>
                ◆ ML METRICS
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--pk-text-muted)' }}>Silhouette Score</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: tc.primary, textShadow: `0 0 12px ${tc.glow}` }}>
                  {result.metrics.silhouette_score.toFixed(4)}
                </span>
              </div>
              {/* Score bar */}
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '3px',
                  width: `${Math.max(0, Math.min(100, result.metrics.silhouette_score * 100))}%`,
                  background: `linear-gradient(90deg, ${tc.primary}88, ${tc.primary})`,
                  boxShadow: `0 0 6px ${tc.glow}`,
                  transition: 'width 0.8s ease-out',
                }} />
              </div>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.65rem', color: 'var(--pk-text-dim)' }}>
                Closer to 1.0 = tighter clusters
              </p>
            </div>

            {/* AI explanation */}
            <div style={{
              background: '#0d1120', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '0.875rem', padding: '1.125rem',
            }}>
              <p style={{ margin: '0 0 0.875rem', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.1em' }}>
                ◆ AI ANALYSIS
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--pk-text-muted)', lineHeight: 1.7 }}>
                {result.explanation}
              </p>
            </div>
          </div>

          {/* Oak success state */}
          <ProfessorOak message={`${result.theme} team assembled! ${result.team.length} Pokémon selected for your Gym.`} />

          {/* ── Next step CTA + Showdown export ────────── */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                const names = result.team.map(s => s.name);
                storeBattlePredictorDraft({
                  battlerA: `${result.theme} Gym Leader`,
                  teamA: names,
                });
                sessionStorage.setItem('gym_team_transfer', JSON.stringify({
                  names,
                  theme: result.theme,
                  difficulty: result.difficulty,
                }));
                window.location.href = '/engine3';
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                background: `linear-gradient(135deg, #0d1120, #13192e)`,
                border: `2px solid ${tc.primary}`,
                borderRadius: '0.625rem',
                color: '#fff',
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.6rem',
                letterSpacing: '0.08em',
                padding: '0.875rem 2.5rem',
                cursor: 'pointer',
                boxShadow: `0 0 28px ${tc.glow}, 0 4px 20px rgba(0,0,0,0.5)`,
                textTransform: 'uppercase',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>⚔</span>
              <div style={{ textAlign: 'left' }}>
                <div>TAKE THIS TEAM TO BATTLE</div>
                <div style={{ fontSize: '0.38rem', opacity: 0.6, marginTop: '2px', fontFamily: 'var(--font-pixel)' }}>
                  PREFILL TEAM A IN BATTLE PREDICTOR →
                </div>
              </div>
              <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>▶</span>
            </button>

            {/* Showdown export button + open link */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => { void handleShowdownExport(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: 'transparent',
                    border: '2px solid rgba(120,200,80,0.5)',
                    borderRadius: '0.625rem',
                    color: '#78C850',
                    fontFamily: 'var(--font-pixel)',
                    fontSize: '0.55rem',
                    letterSpacing: '0.08em',
                    padding: '0.75rem 1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  📋 EXPORT FOR SHOWDOWN
                </button>
                {showCopied && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 0.4rem)', left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#0d1120',
                    border: '1px solid rgba(120,200,80,0.5)',
                    borderRadius: '0.35rem',
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.42rem',
                    fontFamily: 'var(--font-pixel)',
                    color: '#78C850',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}>
                    COPIED!
                  </div>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={async () => {
                    if (result) {
                      try { await navigator.clipboard.writeText(await getShowdownText()); } catch { /* ignore */ }
                    }
                    window.open('https://play.pokemonshowdown.com/teambuilder', '_blank', 'noopener,noreferrer');
                    setShowOpenTip(true);
                    setTimeout(() => setShowOpenTip(false), 5000);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(120,200,80,0.6)',
                    fontFamily: 'var(--font-pixel)',
                    fontSize: '0.45rem',
                    letterSpacing: '0.06em',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(120,200,80,0.3)',
                    paddingBottom: '1px',
                    padding: '0',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#78C850'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(120,200,80,0.6)'; }}
                >
                  Open in Showdown ↗
                </button>
                {showOpenTip && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 0.5rem)', left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#0d1120',
                    border: '1px solid rgba(120,200,80,0.5)',
                    borderRadius: '0.4rem',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.4rem',
                    fontFamily: 'var(--font-pixel)',
                    color: '#78C850',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 10,
                    lineHeight: 1.6,
                    textAlign: 'center',
                    boxShadow: '0 0 12px rgba(120,200,80,0.2)',
                  }}>
                    Team copied!<br />
                    In Showdown: click<br />
                    <span style={{ color: '#F8D030' }}>"Import from text or URL"</span><br />
                    and paste.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
