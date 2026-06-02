'use client';

import React, { useRef, useState } from 'react';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CounterScoreBar } from '@/components/engines/CounterScoreBar';
import { MatchupTable } from '@/components/engines/MatchupTable';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { ShowdownImportModal } from '@/components/ui/ShowdownImportModal';
import { PokemonAutocomplete } from '@/components/ui/PokemonAutocomplete';
import { api } from '@/lib/api';
import { storeBattlePredictorDraft } from '@/lib/battle-transfer';
import { parsePokemonCsv } from '@/lib/pokemon-import';
import { useSessionState } from '@/hooks/useSessionState';
import type { Engine2Response } from '@/types';

/* ── Type colour map (mirrors Engine 1) ────────────────────── */
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
};

/* Detect dominant type from opponent team result */
function detectDominantType(teamTypes: string[]): string {
  if (teamTypes.length === 0) return 'Normal';
  const freq: Record<string, number> = {};
  for (const t of teamTypes) {
    const cap = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    freq[cap] = (freq[cap] ?? 0) + 1;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0] ?? 'Normal';
}

/* ── Arena background (type-reactive) ─────────────────────── */
function ArenaBackground({ typeColor }: { typeColor: { primary: string; bg: string } }) {
  return (
    <div aria-hidden="true" className="pk-arena-bg">
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.03 }}>
        <defs>
          <pattern id="e2-arena-tiles" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill={typeColor.primary} />
            <rect x="20" y="20" width="20" height="20" fill={typeColor.primary} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#e2-arena-tiles)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 40% at 50% 50%, ${typeColor.bg} 0%, transparent 70%)` }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,14,26,0.6) 0%, transparent 35%, transparent 65%, rgba(10,14,26,0.6) 100%)' }} />
    </div>
  );
}

function PokemonSlotInput({ index, value, onChange }: { readonly index: number; readonly value: string; readonly onChange: (val: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
      <span className="pk-slot-number">{index + 1}</span>
      <PokemonAutocomplete
        id={`e2-slot-${index}`}
        value={value}
        onChange={onChange}
        onSelect={(pokemon) => onChange(pokemon.name)}
        placeholder={`Pokémon ${index + 1}`}
      />
    </div>
  );
}

export default function Engine2Page() {
  const [opponentSlots, setOpponentSlots] = useSessionState<string[]>('engine2.opponentSlots', ['', '', '', '', '', '']);
  const [challengerRegion, setChallengerRegion] = useSessionState('engine2.challengerRegion', 'Johto');
  const [section, setSection] = useSessionState('engine2.section', '3ISC');
  const [groupName, setGroupName] = useSessionState('engine2.groupName', '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useSessionState<Engine2Response | null>('engine2.result', null);
  const [error, setError] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  function updateSlot(i: number, val: string) {
    setOpponentSlots((prev) => { const next = [...prev]; next[i] = val; return next; });
  }

  function handleTeamImported(teamNames: string[]) {
    const next = ['', '', '', '', '', ''];
    teamNames.slice(0, 6).forEach((name, i) => { next[i] = name; });
    setOpponentSlots(next);
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const names = parsePokemonCsv(String(event.target?.result ?? ''));
      if (names.length === 0) {
        setError('No Pokemon names were found in the CSV file.');
        return;
      }
      setError(null);
      handleTeamImported(names);
    };
    reader.onerror = () => setError('Could not read the CSV file.');
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filled = opponentSlots.filter((s) => s.trim() !== '');
    if (filled.length === 0) { setError('Enter at least one opponent Pokémon name.'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await api.getCounterTeam(filled, challengerRegion, section, groupName);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get counters');
    } finally {
      setLoading(false);
    }
  }

  const [copied, setCopied] = useState(false);

  function buildPSText(): string {
    if (!result) return '';
    if (result.showdown_text) return result.showdown_text;
    return result.recommended_team.map((c) => {
      if (!c.loadout) return c.name;
      return [
        `${c.name} @ ${c.loadout.item}`,
        `Ability: ${c.loadout.ability}`,
        `EVs: ${c.loadout.evs}`,
        `${c.loadout.nature} Nature`,
        ...c.loadout.moves.map((move) => `- ${move}`),
      ].join('\n');
    }).join('\n\n');
  }

  function handleCopyPS() {
    const text = buildPSText();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownloadCSV() {
    if (!result) return;
    const header = 'rank,name,type_1,type_2,counter_score,tcs,sas,rs,knn,dt,reason';
    const rows = result.recommended_team.map((c) =>
      `${c.rank},"${c.name}","${c.type_1}","${c.type_2 ?? ''}",${c.counter_score},${c.score_breakdown.tcs},${c.score_breakdown.sas},${c.score_breakdown.rs},${c.score_breakdown.knn},${c.score_breakdown.dt},"${c.reason.replace(/"/g, '""')}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'counter_team.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSendToEngine3() {
    if (!result) return;
    const myTeam = result.recommended_team.map((c) => c.name);
    const opponentTeam = opponentSlots.filter((s) => s.trim() !== '');
    storeBattlePredictorDraft({ teamA: myTeam, teamB: opponentTeam });
    sessionStorage.setItem('counter_team_transfer', JSON.stringify({
      myTeam,
      opponentTeam,
    }));
    window.location.href = '/engine3';
  }

  /* Derive reactive type from results if available */
  const dominantType = result
    ? detectDominantType(result.recommended_team.flatMap(c => [c.type_1, c.type_2 ?? ''].filter(Boolean)))
    : null;
  const tc = dominantType && TYPE_COLORS[dominantType]
    ? TYPE_COLORS[dominantType]
    : { primary: '#94A3B8', bg: 'rgba(148,163,184,0.08)', glow: 'rgba(148,163,184,0.2)' };

  const counterNames = result?.recommended_team.map((c) => c.name) ?? [];

  return (
    <AuthGuard>
    <div className="pk-section">
      {/* Page-level ambient glow */}
      <div className="pk-page-glow" aria-hidden="true" />

      {/* ── Page header ────────────────────────────────── */}
      <header style={{ marginBottom: 'clamp(1.25rem, 3vw, 2rem)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.12em' }}>ENGINE 2</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(104,144,240,0.08)', border: '1px solid rgba(104,144,240,0.3)', borderRadius: '0.4rem', padding: '0.25rem 0.6rem' }}>
            <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: '#6890F0', letterSpacing: '0.06em' }}>🛡 COUNTER PICK</span>
          </div>
        </div>
        <h1 style={{ margin: '0 0 0.375rem', fontSize: 'clamp(1.3rem, 3vw, 2rem)', fontWeight: 900, color: 'var(--pk-text)' }}>
          Counter-Pick Engine
        </h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--pk-text-muted)' }}>
          Analyse an opponent team and find the optimal counter-picks using type effectiveness and stat analysis.
        </p>
      </header>

      {/* ── Input arena card ───────────────────────────── */}
      <form onSubmit={handleSubmit} aria-label="Counter pick form" noValidate style={{ marginBottom: '1.5rem' }}>
        <div style={{
          position: 'relative', borderRadius: '1rem', overflow: 'hidden',
          border: '2px solid rgba(104,144,240,0.3)',
          boxShadow: '0 0 32px rgba(104,144,240,0.12), inset 0 0 40px rgba(104,144,240,0.04)',
          background: '#0d1120',
          marginBottom: '0',
        }}>
          {/* Arena bg — neutral blue since no type selected yet */}
          <ArenaBackground typeColor={{ primary: '#6890F0', bg: 'rgba(104,144,240,0.06)' }} />

          <div style={{ position: 'relative', zIndex: 1, padding: 'clamp(1.25rem, 3vw, 1.75rem)' }}>
            {/* Arena header strip */}
            <div className="pk-arena-header" style={{ margin: '-1.25rem -1.25rem 1.25rem', borderRadius: '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }} aria-hidden="true">🛡</span>
                <div>
                  <p style={{ margin: 0, fontSize: '0.45rem', fontFamily: 'var(--font-pixel)', color: '#6890F0', letterSpacing: '0.1em', opacity: 0.8 }}>COUNTER ANALYSIS</p>
                  <p style={{ margin: 0, fontSize: '0.65rem', fontFamily: 'var(--font-pixel)', color: '#6890F0', textShadow: '0 0 10px rgba(104,144,240,0.5)' }}>OPPONENT SCOUT</p>
                </div>
              </div>
              <span style={{ fontSize: '0.42rem', fontFamily: 'var(--font-pixel)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}>ENTER UP TO 6 POKÉMON</span>
            </div>

            {/* ── Challenger Region + Section/Group ─────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>

              {/* Challenger Region selector */}
              <div>
                <p style={{
                  margin: '0 0 0.4rem',
                  fontSize: '0.5rem', fontFamily: 'var(--font-pixel)',
                  color: 'var(--pk-text-muted)', letterSpacing: '0.08em',
                }}>
                  ◆ CHALLENGER REGION (3ISC)
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {(['Johto', 'Kalos', 'Alola'] as const).map((r) => {
                    const active = challengerRegion === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setChallengerRegion(r)}
                        style={{
                          fontFamily: 'var(--font-pixel)',
                          fontSize: '0.5rem',
                          letterSpacing: '0.06em',
                          padding: '0.4rem 0.9rem',
                          borderRadius: '0.4rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: active ? '2px solid #6890F0' : '2px solid rgba(104,144,240,0.2)',
                          background: active ? 'rgba(104,144,240,0.12)' : 'rgba(0,0,0,0.25)',
                          color: active ? '#6890F0' : 'rgba(255,255,255,0.4)',
                          boxShadow: active ? '0 0 10px rgba(104,144,240,0.35)' : 'none',
                        }}
                      >
                        {r.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: '0.6rem', color: 'var(--pk-text-muted)', marginTop: '0.25rem' }}>
                  Section 3ISC challenger pool — native Pokémon only
                </p>
              </div>

              {/* Section + Group Name side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxWidth: '640px' }}>
                <div>
                  <label htmlFor="e2-section" style={{
                    display: 'block', marginBottom: '0.4rem',
                    fontSize: '0.5rem', fontFamily: 'var(--font-pixel)',
                    color: 'var(--pk-text-muted)', letterSpacing: '0.08em',
                  }}>
                    ◆ SECTION
                  </label>
                  <input
                    id="e2-section"
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="e.g. 3ISC"
                    className="pk-input"
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <div>
                  <label htmlFor="e2-group-name" style={{
                    display: 'block', marginBottom: '0.4rem',
                    fontSize: '0.5rem', fontFamily: 'var(--font-pixel)',
                    color: 'var(--pk-text-muted)', letterSpacing: '0.08em',
                  }}>
                    ◆ GROUP NAME
                  </label>
                  <input
                    id="e2-group-name"
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

            {/* Label + Import button row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <p className="pk-section-label" style={{ margin: 0 }}>
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <polygon points="5,0 6.2,3.5 10,3.5 7,5.8 8.1,9 5,7 1.9,9 3,5.8 0,3.5 3.8,3.5" fill="currentColor" opacity="0.7"/>
                </svg>
                OPPONENT TEAM ROSTER
              </p>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={handleCsvUpload}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'transparent',
                  border: '1px solid rgba(248,208,48,0.4)',
                  borderRadius: '0.4rem',
                  color: '#F8D030',
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '0.42rem',
                  letterSpacing: '0.06em',
                  padding: '0.35rem 0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                CSV IMPORT
              </button>
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'transparent',
                  border: '1px solid rgba(104,144,240,0.4)',
                  borderRadius: '0.4rem',
                  color: '#6890F0',
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '0.42rem',
                  letterSpacing: '0.06em',
                  padding: '0.35rem 0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(104,144,240,0.08)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(104,144,240,0.7)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(104,144,240,0.4)';
                }}
              >
                📥 IMPORT FROM SHOWDOWN
              </button>
              </div>
            </div>

            {/* Slot grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.625rem', marginBottom: '1.25rem' }}>
              {opponentSlots.map((val, i) => (
                <PokemonSlotInput key={i} index={i} value={val} onChange={(v) => updateSlot(i, v)} />
              ))}
            </div>

            {/* Submit */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="submit"
                disabled={loading}
                className="pk-analyse-btn"
                style={{ borderColor: '#6890F0', background: loading ? 'rgba(104,144,240,0.05)' : 'linear-gradient(135deg, rgba(104,144,240,0.2), rgba(104,144,240,0.1))', boxShadow: loading ? 'none' : '0 0 20px rgba(104,144,240,0.2)', opacity: loading ? 0.55 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading
                  ? <><LoadingSpinner size="sm" /><span>ANALYSING...</span></>
                  : <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" stroke="#fff" strokeWidth="2"/>
                        <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="8" y1="11" x2="14" y2="11" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="11" y1="8" x2="11" y2="14" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      FIND COUNTERS
                    </>
                }
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="pk-error" role="alert" style={{ marginBottom: '1rem' }}>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.52rem', letterSpacing: '0.06em' }}>⚠ ERROR: </span>{error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="pk-loading-msg">
          <LoadingSpinner size="lg" />
          <p className="pk-loading-title">SCANNING OPPONENT DATA...</p>
          <p className="pk-loading-sub">Computing optimal counter-picks with type analysis</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'slide-in-up 0.4s ease-out' }}>

          {/* Opponent team */}
          <section aria-label="Opponent team">
            <p className="pk-section-label">
              <span aria-hidden="true">◆</span> OPPONENT TEAM ({result.opponent_team.length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {result.opponent_team.map((name) => (
                <span key={name} className="pk-opponent-tag">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="20" y1="4" x2="4" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="5.5" y1="9" x2="9" y2="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="18.5" y1="9" x2="15" y2="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {name}
                </span>
              ))}
            </div>
          </section>

          {/* Counter cards — type-reactive arena */}
          <section aria-label="Recommended counter team">
            {/* Results arena card */}
            <div style={{
              position: 'relative', borderRadius: '1rem', overflow: 'hidden', marginBottom: '1rem',
              border: `2px solid ${tc.primary}44`,
              boxShadow: `0 0 40px ${tc.glow}, inset 0 0 50px ${tc.bg}`,
              background: '#0d1120',
              transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
            }}>
              <ArenaBackground typeColor={tc} />
              <div style={{ position: 'relative', zIndex: 1, padding: 'clamp(1rem, 2.5vw, 1.5rem)' }}>
                {/* Arena header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ margin: '0 0 0.15rem', fontSize: '0.45rem', fontFamily: 'var(--font-pixel)', color: tc.primary, letterSpacing: '0.1em' }}>
                      COUNTER TEAM READY
                    </p>
                    <h2 style={{ margin: 0, fontSize: 'clamp(0.95rem, 2vw, 1.3rem)', fontWeight: 900, color: '#fff' }}>
                      Recommended Counters
                    </h2>
                  </div>
                  {/* Challenger region badge */}
                  <span style={{
                    fontSize: '0.42rem', fontFamily: 'var(--font-pixel)',
                    color: '#6890F0',
                    border: '1px solid rgba(104,144,240,0.4)',
                    borderRadius: '0.25rem', padding: '0.2rem 0.55rem',
                    letterSpacing: '0.06em',
                    background: 'rgba(104,144,240,0.08)',
                    textTransform: 'uppercase',
                  }}>
                    {challengerRegion} CHALLENGER POOL
                  </span>
                  <span style={{ fontSize: '0.42rem', fontFamily: 'var(--font-pixel)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.25rem', padding: '0.2rem 0.5rem', letterSpacing: '0.06em', marginLeft: 'auto' }}>
                    MODEL: {result.model_used.toUpperCase()}
                  </span>
                </div>

                {/* Counter cards grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.875rem' }}>
                  {result.recommended_team.map((counter) => {
                    const cType = counter.type_1.charAt(0).toUpperCase() + counter.type_1.slice(1).toLowerCase();
                    const cColor = TYPE_COLORS[cType] ?? tc;
                    return (
                      <div key={counter.name} className="pk-counter-card" style={{ '--card-accent': cColor.primary } as React.CSSProperties}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {counter.pokeapi_id && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${counter.pokeapi_id}.png`}
                                alt={counter.name}
                                width={56}
                                height={56}
                                style={{ imageRendering: 'pixelated', objectFit: 'contain', flexShrink: 0 }}
                                loading="lazy"
                              />
                            )}
                            <div>
                              <h3 style={{ margin: '0 0 0.35rem', fontWeight: 800, color: 'var(--pk-text)', textTransform: 'capitalize', fontSize: 'clamp(0.9rem, 1.5vw, 1.05rem)' }}>{counter.name}</h3>
                              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                <TypeBadge type={counter.type_1} />
                                {counter.type_2 && <TypeBadge type={counter.type_2} />}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ margin: 0, fontSize: '0.4rem', fontFamily: 'var(--font-pixel)', color: cColor.primary, letterSpacing: '0.08em' }}>RANK</p>
                            <p style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'var(--font-pixel)', color: cColor.primary, textShadow: `0 0 8px ${cColor.glow}` }}>#{counter.rank}</p>
                          </div>
                        </div>
                        <CounterScoreBar score={counter.counter_score} breakdown={counter.score_breakdown} rank={counter.rank} />
                        <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: 'var(--pk-text-muted)', lineHeight: 1.55, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.625rem' }}>
                          {counter.reason}
                        </p>
                        {counter.loadout && (
                          <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ fontSize: '0.64rem', color: 'var(--pk-gold)', fontWeight: 700 }}>
                              {counter.loadout.item}
                            </div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--pk-text-muted)' }}>
                              Ability: {counter.loadout.ability}
                            </div>
                            <div style={{ fontSize: '0.56rem', color: 'var(--pk-text-dim)' }}>
                              {counter.loadout.evs}
                            </div>
                            <div style={{ fontSize: '0.56rem', color: 'var(--pk-text-dim)' }}>
                              {counter.loadout.nature} Nature
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.15rem' }}>
                              {counter.loadout.moves.map((move) => (
                                <span key={move} style={{ fontSize: '0.58rem', color: 'var(--pk-text-muted)' }}>- {move}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Export bar */}
                <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <button
                    type="button"
                    onClick={handleCopyPS}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(104,144,240,0.10)', border: `1px solid ${copied ? 'rgba(74,222,128,0.5)' : 'rgba(104,144,240,0.35)'}`, borderRadius: '0.4rem', color: copied ? '#4ADE80' : '#6890F0', fontFamily: 'var(--font-pixel)', fontSize: '0.42rem', letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.15s' }}
                  >
                    {copied ? '✓ COPIED!' : '📋 COPY PS TEXT'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCSV}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'rgba(248,208,48,0.08)', border: '1px solid rgba(248,208,48,0.3)', borderRadius: '0.4rem', color: '#F8D030', fontFamily: 'var(--font-pixel)', fontSize: '0.42rem', letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.15s' }}
                  >
                    ⬇ DOWNLOAD CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleSendToEngine3}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '0.4rem', color: '#EF4444', fontFamily: 'var(--font-pixel)', fontSize: '0.42rem', letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.15s' }}
                  >
                    ⚔ TAKE TO BATTLE
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* VS table */}
          {result.recommended_team.length > 0 && (
            <section aria-label="VS team comparison">
              <p className="pk-section-label"><span aria-hidden="true">◆</span> MATCHUP PREVIEW</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0', background: 'var(--pk-glass)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                {/* MY TEAM header */}
                <div style={{ padding: '0.6rem 1rem', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.45rem', color: '#EF4444', letterSpacing: '0.08em' }}>🔴 MY TEAM</span>
                </div>
                <div style={{ padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.45rem', color: 'var(--pk-text-muted)' }}>VS</span>
                </div>
                {/* OPPONENT header */}
                <div style={{ padding: '0.6rem 1rem', background: 'rgba(104,144,240,0.08)', borderBottom: '1px solid rgba(104,144,240,0.2)', display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
                  <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.45rem', color: '#6890F0', letterSpacing: '0.08em' }}>OPPONENT 🔵</span>
                </div>

                {/* Row pairs */}
                {Array.from({ length: Math.max(result.recommended_team.length, (result.opponent_team_data ?? result.opponent_team).length) }).map((_, i) => {
                  const counter = result.recommended_team[i];
                  const opp = result.opponent_team_data?.[i] ?? (result.opponent_team[i] ? { name: result.opponent_team[i], pokeapi_id: undefined, type_1: undefined, type_2: undefined } : undefined);
                  const isLast = i === Math.max(result.recommended_team.length, (result.opponent_team_data ?? result.opponent_team).length) - 1;
                  const rowBorder = isLast ? 'none' : '1px solid rgba(255,255,255,0.05)';
                  return (
                    <React.Fragment key={i}>
                      {/* Counter cell */}
                      <div style={{ padding: '0.5rem 1rem', borderBottom: rowBorder, display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.03)' }}>
                        {counter ? (
                          <>
                            {counter.pokeapi_id && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${counter.pokeapi_id}.png`} alt={counter.name} width={40} height={40} style={{ imageRendering: 'pixelated', objectFit: 'contain', flexShrink: 0 }} loading="lazy" />
                            )}
                            <div>
                              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.82rem', color: 'var(--pk-text)', textTransform: 'capitalize' }}>{counter.name}</p>
                              <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
                                <TypeBadge type={counter.type_1} />
                                {counter.type_2 && <TypeBadge type={counter.type_2} />}
                              </div>
                            </div>
                          </>
                        ) : <span style={{ color: 'var(--pk-text-dim)', fontSize: '0.75rem' }}>—</span>}
                      </div>
                      {/* VS divider cell */}
                      <div style={{ padding: '0.5rem 0.75rem', borderBottom: rowBorder, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.01)' }}>
                        <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-pixel)' }}>⚔</span>
                      </div>
                      {/* Opponent cell */}
                      <div style={{ padding: '0.5rem 1rem', borderBottom: rowBorder, display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', background: 'rgba(104,144,240,0.03)' }}>
                        {opp ? (
                          <>
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.82rem', color: 'var(--pk-text)', textTransform: 'capitalize' }}>{opp.name}</p>
                              <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.15rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {opp.type_1 && <TypeBadge type={opp.type_1} />}
                                {opp.type_2 && <TypeBadge type={opp.type_2} />}
                              </div>
                            </div>
                            {opp.pokeapi_id && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${opp.pokeapi_id}.png`} alt={opp.name} width={40} height={40} style={{ imageRendering: 'pixelated', objectFit: 'contain', flexShrink: 0 }} loading="lazy" />
                            )}
                          </>
                        ) : <span style={{ color: 'var(--pk-text-dim)', fontSize: '0.75rem' }}>—</span>}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </section>
          )}

          {/* Matchup table */}
          {result.opponent_team.length > 0 && counterNames.length > 0 && (
            <section aria-label="Type matchup heatmap">
              <p className="pk-section-label">
                <span aria-hidden="true">◆</span> TYPE MATCHUP TABLE
              </p>
              <MatchupTable matchupTable={result.matchup_table} opponentTeam={result.opponent_team} counterTeam={counterNames} />
            </section>
          )}
        </div>
      )}
    </div>

    <ShowdownImportModal
      isOpen={importModalOpen}
      onClose={() => setImportModalOpen(false)}
      onTeamImported={handleTeamImported}
    />
    </AuthGuard>
  );
}
