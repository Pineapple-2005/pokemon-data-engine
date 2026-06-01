'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { storeUser } from '@/lib/auth';
import { PokemonAutocomplete } from '@/components/ui/PokemonAutocomplete';
import { PokemonIntro } from '@/components/ui/PokemonIntro';
import { getPokeapiId } from '@/lib/pokemon-ids';
import type { Pokemon } from '@/types';

type Mode = 'login' | 'register';

const TYPE_BADGES: Array<{ color: string; label: string }> = [
  { color: '#F08030', label: 'FIRE' },
  { color: '#6890F0', label: 'WATER' },
  { color: '#78C850', label: 'GRASS' },
  { color: '#F8D030', label: 'ELEC' },
  { color: '#A890F0', label: 'FLY' },
  { color: '#C03028', label: 'FIGHT' },
  { color: '#7038F8', label: 'DRAGON' },
  { color: '#EE99AC', label: 'FAIRY' },
  { color: '#705898', label: 'GHOST' },
];

// ── Trainer class picker data ────────────────────────────────────────────────
const TRAINER_CLASSES = [
  'youngster', 'lass', 'bugcatcher', 'hiker', 'beauty', 'biker', 'blackbelt',
  'scientist', 'fisherman', 'gentleman', 'juggler', 'tamer', 'birdkeeper',
  'channeler', 'supernerd', 'swimmer-m', 'swimmer-f',
  'cooltrainer-m', 'cooltrainer-f', 'acetrainer-m', 'acetrainer-f',
  'rocket-grunt-m', 'rocket-grunt-f',
  'lt-surge', 'brock', 'misty', 'erika', 'koga', 'sabrina', 'blaine', 'giovanni',
  'lorelei', 'bruno', 'agatha', 'lance', 'red', 'blue',
];

function formatTrainerClass(key: string): string {
  return key.replace(/-/g, ' ').toUpperCase();
}

// ── Card color picker data ───────────────────────────────────────────────────
const CARD_COLORS: Record<string, string> = {
  red: '#EF4444',
  blue: '#6890F0',
  green: '#78C850',
  yellow: '#F8D030',
  purple: '#A040A0',
  gold: '#F0A040',
  silver: '#B8B8D0',
  dark: '#1a1a2e',
};

// ── Starter data ─────────────────────────────────────────────────────────────
const OA_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';

const HOMETOWNS = [
  'Pallet Town', 'Cerulean City', 'Vermilion City', 'Lavender Town',
  'Celadon City', 'Fuchsia City', 'Saffron City', 'Cinnabar Island',
];

const TRAINER_TITLES = [
  'Trainer', 'Gym Leader', 'Elite Four', 'Champion', 'Team Rocket', 'Professor', 'Rival',
];

// ── Shared label style ────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-pixel)',
  fontSize: '0.5rem',
  color: 'var(--pk-text-muted)',
  letterSpacing: '0.1em',
  marginBottom: '0.4rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: '16px',
};

// ── Shared select style ───────────────────────────────────────────────────────
const selectStyle: React.CSSProperties = {
  width: '100%',
  fontSize: '16px',
  background: '#0d1120',
  border: '1px solid rgba(239,68,68,0.3)',
  borderRadius: '0.375rem',
  color: 'var(--pk-text)',
  padding: '0.5rem 0.625rem',
  fontFamily: 'var(--font-body)',
  cursor: 'pointer',
  outline: 'none',
};

// ── Submit button style ───────────────────────────────────────────────────────
function submitBtnStyle(loading: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '0.75rem',
    background: loading ? 'rgba(139,0,0,0.4)' : 'linear-gradient(135deg, #CC0000, #8B0000)',
    border: '1px solid rgba(239,68,68,0.5)',
    borderRadius: '0.5rem',
    color: loading ? 'rgba(255,255,255,0.5)' : '#fff',
    fontFamily: 'var(--font-pixel)',
    fontSize: '0.65rem',
    letterSpacing: '0.12em',
    cursor: loading ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    transition: 'background 0.15s ease, opacity 0.15s ease',
    boxShadow: loading ? 'none' : '0 0 16px rgba(239,68,68,0.3)',
  };
}

export default function LoginPage() {
  const router = useRouter();

  // ── Shared state ────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Step 1 fields ───────────────────────────────────────────────────────────
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [section, setSection] = useState('3ISC');

  // ── Step 2 fields ───────────────────────────────────────────────────────────
  const [trainerClass, setTrainerClass] = useState('youngster');
  const [cardColor, setCardColor] = useState('#EF4444');
  const [starterPokemon, setStarterPokemon] = useState('');
  const [starterQuery, setStarterQuery] = useState('');
  const [selectedStarter, setSelectedStarter] = useState<Pokemon | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [hometown, setHometown] = useState('Pallet Town');
  const [trainerTitle, setTrainerTitle] = useState('Trainer');
  const [trainerId, setTrainerId] = useState('');

  function switchMode(next: Mode) {
    setMode(next);
    setStep(1);
    setError(null);
    setUsername('');
    setPassword('');
    setSection('3ISC');
  }

  // ── Step 1 → Step 2 ─────────────────────────────────────────────────────────
  function handleNextStep(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('USERNAME and PASSWORD are required.');
      return;
    }
    setError(null);
    setDisplayName(username.trim());
    setStep(2);
  }

  // ── Final submit (login or register step 2) ──────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'login') {
      if (!username.trim() || !password.trim()) {
        setError('USERNAME and PASSWORD are required.');
        return;
      }
    }
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const data = await api.login(username.trim(), password);
        storeUser({
          id: data.id, username: data.username, access_token: data.access_token,
          display_name: data.display_name, section: data.section,
          trainer_class: data.trainer_class, trainer_card_color: data.trainer_card_color,
          starter_pokemon: data.starter_pokemon, hometown: data.hometown,
          favorite_type: data.favorite_type, trainer_title: data.trainer_title,
          rival_name: data.rival_name, trainer_id: data.trainer_id,
        });
      } else {
        const trainerFields = {
          display_name: displayName.trim() || username.trim(),
          trainer_class: trainerClass,
          trainer_card_color: cardColor,
          starter_pokemon: starterPokemon,
          hometown,
          favorite_type: 'Normal',
          trainer_title: trainerTitle,
          trainer_id: trainerId,
          rival_name: '',
        };
        const data = await api.register(username.trim(), password, section.trim() || undefined, trainerFields);
        storeUser({
          id: data.id, username: data.username, access_token: data.access_token,
          display_name: data.display_name, section: data.section,
          trainer_class: data.trainer_class, trainer_card_color: data.trainer_card_color,
          starter_pokemon: data.starter_pokemon, hometown: data.hometown,
          favorite_type: data.favorite_type, trainer_title: data.trainer_title,
          rival_name: data.rival_name, trainer_id: data.trainer_id,
        });
      }
      const intended = sessionStorage.getItem('pk_intended') ?? '/';
      sessionStorage.removeItem('pk_intended');
      router.push(intended);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const isRegister = mode === 'register';

  // ── Outer container ──────────────────────────────────────────────────────────
  return (
    <div
      className="pk-login-outer"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--pk-bg)',
        padding: '1.5rem',
      }}
    >
      {/* Boot sequence intro — self-managing, fires once per session */}
      <PokemonIntro />

      {/* Ambient glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(239,68,68,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Falling pokeballs background */}
      {[
        { left: '8%',  delay: '0s',   duration: '5.2s' },
        { left: '21%', delay: '1.3s', duration: '6.1s' },
        { left: '36%', delay: '0.7s', duration: '5.7s' },
        { left: '51%', delay: '2.1s', duration: '4.9s' },
        { left: '64%', delay: '0.4s', duration: '5.5s' },
        { left: '79%', delay: '1.8s', duration: '6.3s' },
      ].map((b) => (
        <div
          key={b.left}
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: b.left,
            top: '-60px',
            zIndex: 0,
            pointerEvents: 'none',
            animation: `intro-pokeball-fall ${b.duration} ease-in infinite`,
            animationDelay: b.delay,
            opacity: 0.06,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="18" fill="none" stroke="#333" strokeWidth="2" />
            <path d="M2 20 A18 18 0 0 1 38 20" fill="#DC2626" />
            <path d="M38 20 A18 18 0 0 1 2 20" fill="#F8FAFC" />
            <line x1="2" y1="20" x2="38" y2="20" stroke="#111" strokeWidth="2.5" />
            <circle cx="20" cy="20" r="5" fill="#111" />
            <circle cx="20" cy="20" r="2.8" fill="#F8FAFC" />
          </svg>
        </div>
      ))}

      {/* ── STEP 2: Trainer Customization ─────────────────────────────────── */}
      {isRegister && step === 2 ? (
        <div
          className="pk-login-card"
          style={{
            background: 'linear-gradient(145deg, #0d1120, #0a0e1a)',
            border: '2px solid rgba(239,68,68,0.4)',
            borderRadius: '1rem',
            padding: '2rem',
            width: '100%',
            maxWidth: '640px',
            boxShadow: '0 0 40px rgba(239,68,68,0.15), 0 20px 60px rgba(0,0,0,0.6)',
            position: 'relative',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true" style={{ filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.5))', flexShrink: 0 }}>
              <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(239,68,68,0.5)" strokeWidth="1.5" />
              <path d="M2 20 A18 18 0 0 1 38 20" fill="#DC2626" />
              <path d="M38 20 A18 18 0 0 1 2 20" fill="#F8FAFC" />
              <line x1="2" y1="20" x2="38" y2="20" stroke="#111" strokeWidth="2.5" />
              <circle cx="20" cy="20" r="5" fill="#111" />
              <circle cx="20" cy="20" r="2.8" fill="#F8FAFC" />
            </svg>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-pixel)', fontSize: 'clamp(0.6rem, 2vw, 0.8rem)', color: 'var(--pk-red)', letterSpacing: '0.12em' }}>
              CHOOSE YOUR TRAINER
            </h1>
          </div>

          {/* Error box */}
          {error && (
            <div
              role="alert"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.5)', borderRadius: '0.5rem', padding: '0.625rem 0.875rem', marginBottom: '1.25rem' }}
            >
              <span style={{ display: 'block', fontFamily: 'var(--font-pixel)', fontSize: '0.5rem', color: 'var(--pk-red)', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>ERROR</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'rgba(239,68,68,0.9)', lineHeight: 1.5 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* A. Trainer Class Picker */}
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ ...labelStyle, marginBottom: '0.75rem' }}>TRAINER CLASS</p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.5rem',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  padding: '0.25rem',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(239,68,68,0.3) transparent',
                }}
              >
                {TRAINER_CLASSES.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTrainerClass(key)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.5rem 0.25rem',
                      borderRadius: '0.5rem',
                      border: trainerClass === key ? '2px solid var(--pk-red)' : '2px solid rgba(255,255,255,0.08)',
                      background: trainerClass === key ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    aria-pressed={trainerClass === key}
                    title={formatTrainerClass(key)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://play.pokemonshowdown.com/sprites/trainers/${key}.png`}
                      alt={formatTrainerClass(key)}
                      width={64}
                      height={64}
                      style={{ imageRendering: 'pixelated', objectFit: 'contain', minHeight: '64px' }}
                      onError={(e) => {
                        const el = e.currentTarget.parentElement;
                        if (el) el.style.display = 'none';
                      }}
                    />
                    <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.32rem', color: trainerClass === key ? 'var(--pk-red)' : 'var(--pk-text-muted)', letterSpacing: '0.05em', textAlign: 'center', lineHeight: 1.3 }}>
                      {formatTrainerClass(key)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* B. Card Color Picker */}
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ ...labelStyle, marginBottom: '0.75rem' }}>CARD COLOR</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
                {Object.entries(CARD_COLORS).map(([name, hex]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setCardColor(hex)}
                    aria-label={`Card color: ${name}`}
                    aria-pressed={cardColor === hex}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: hex,
                      border: '2px solid rgba(255,255,255,0.15)',
                      outline: cardColor === hex ? '2px solid white' : 'none',
                      outlineOffset: '2px',
                      cursor: 'pointer',
                      transition: 'outline 0.1s ease',
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* C. Starter Pokemon */}
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ ...labelStyle, marginBottom: '0.25rem' }}>MY POKEMON</p>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.68rem', color: 'var(--pk-text-muted)' }}>
                Search for the Pokemon you were assigned
              </p>
              <PokemonAutocomplete
                value={starterQuery}
                onChange={setStarterQuery}
                onSelect={(p) => {
                  setStarterPokemon(p.name);
                  setSelectedStarter(p);
                  setStarterQuery(p.name);
                }}
                placeholder="e.g. pikachu, gengar, lapras..."
              />
              {selectedStarter && (
                <div style={{
                  marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.875rem',
                  padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
                  background: 'rgba(248,208,48,0.07)', border: '2px solid rgba(248,208,48,0.35)',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${OA_SPRITE}/${selectedStarter.pokeapi_id || getPokeapiId(selectedStarter.name)}.png`}
                    alt={selectedStarter.name}
                    width={56} height={56}
                    style={{ objectFit: 'contain', flexShrink: 0 }}
                  />
                  <div>
                    <p style={{ margin: '0 0 0.2rem', fontFamily: 'var(--font-pixel)', fontSize: '0.5rem', color: '#F8D030', letterSpacing: '0.08em', textTransform: 'capitalize' }}>
                      {selectedStarter.name} ✓
                    </p>
                    <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--pk-text-muted)' }}>
                      {selectedStarter.type_1}{selectedStarter.type_2 ? ` / ${selectedStarter.type_2}` : ''} · {selectedStarter.role_label}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* D. Other fields — 2-column grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* Trainer Name */}
              <div>
                <label htmlFor="display-name" style={labelStyle}>TRAINER NAME</label>
                <input
                  id="display-name"
                  type="text"
                  className="pk-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={loading}
                  placeholder="Display name"
                  style={inputStyle}
                />
              </div>

              {/* Hometown */}
              <div>
                <label htmlFor="hometown" style={labelStyle}>HOMETOWN</label>
                <select
                  id="hometown"
                  value={hometown}
                  onChange={(e) => setHometown(e.target.value)}
                  disabled={loading}
                  style={selectStyle}
                >
                  {HOMETOWNS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Trainer Title */}
              <div>
                <label htmlFor="trainer-title" style={labelStyle}>TRAINER TITLE</label>
                <select
                  id="trainer-title"
                  value={trainerTitle}
                  onChange={(e) => setTrainerTitle(e.target.value)}
                  disabled={loading}
                  style={selectStyle}
                >
                  {TRAINER_TITLES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Trainer ID */}
              <div>
                <label htmlFor="trainer-id" style={labelStyle}>TRAINER ID</label>
                <input
                  id="trainer-id"
                  type="text"
                  className="pk-input"
                  value={trainerId}
                  onChange={(e) => setTrainerId(e.target.value.slice(0, 6))}
                  disabled={loading}
                  placeholder="e.g. 123456"
                  maxLength={6}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Bottom buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => { setStep(1); setError(null); }}
                disabled={loading}
                style={{
                  flex: '0 0 auto',
                  padding: '0.75rem 1.25rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '0.5rem',
                  color: 'var(--pk-text-muted)',
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '0.58rem',
                  letterSpacing: '0.1em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                ← BACK
              </button>

              <button
                type="submit"
                disabled={loading}
                style={{ ...submitBtnStyle(loading), flex: 1 }}
              >
                {loading && (
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                    <path d="M12 2 A10 10 0 0 1 22 12" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                )}
                {loading ? 'CREATING ACCOUNT...' : 'START JOURNEY →'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: '420px',
          zIndex: 1,
          position: 'relative',
        }}>

          {/* ── Game title above the card ─────────────── */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            {/* Pokeball logo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.875rem' }}>
              <svg
                width="72" height="72" viewBox="0 0 40 40"
                aria-hidden="true"
                className="animate-glow"
                style={{ filter: 'drop-shadow(0 0 16px rgba(239,68,68,0.7)) drop-shadow(0 0 32px rgba(239,68,68,0.3))' }}
              >
                <circle cx="20" cy="20" r="19" fill="none" stroke="rgba(239,68,68,0.25)" strokeWidth="1" />
                <path d="M1 20 A19 19 0 0 1 39 20 Z" fill="#DC2626" />
                <path d="M1 20 A19 19 0 0 0 39 20 Z" fill="#F8FAFC" />
                <rect x="0" y="18.5" width="40" height="3" fill="#111" />
                <circle cx="20" cy="20" r="5.5" fill="#111" />
                <circle cx="20" cy="20" r="3.5" fill="#F8FAFC" />
                <circle cx="20" cy="20" r="1.8" fill="#111" />
                <ellipse cx="15" cy="13" rx="2.5" ry="1.5" fill="rgba(255,255,255,0.22)" transform="rotate(-30 15 13)" />
              </svg>
            </div>

            <h1 style={{
              margin: '0 0 0.4rem',
              fontFamily: 'var(--font-pixel)',
              fontSize: 'clamp(0.65rem, 2.5vw, 0.9rem)',
              color: 'var(--pk-red)',
              letterSpacing: '0.15em',
              textShadow: '0 0 20px rgba(239,68,68,0.5)',
              textTransform: 'uppercase',
            }}>
              POKEMON DATA ENGINE
            </h1>

            {/* Version badge */}
            <span style={{
              display: 'inline-block',
              fontFamily: 'var(--font-pixel)',
              fontSize: '0.32rem',
              color: '#F8D030',
              border: '1px solid rgba(248,208,48,0.3)',
              borderRadius: '0.25rem',
              padding: '0.2rem 0.6rem',
              letterSpacing: '0.08em',
              background: 'rgba(248,208,48,0.05)',
            }}>
              GEN 1–9 · BATTLE SYSTEM · DATA ENGINE
            </span>
          </div>

          {/* Card */}
          <div
            className="pk-login-card pk-login-card-animated"
            style={{
              width: '100%',
              background: '#0d1120',
              border: '2px solid rgba(239,68,68,0.4)',
              borderRadius: '0.875rem',
              padding: '2rem',
              boxShadow: '0 0 40px rgba(239,68,68,0.12)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Decorative overlays */}
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.04, background: '#000' }} />
            <div aria-hidden="true" style={{ position: 'absolute', right: '-40px', top: '-40px', width: '160px', height: '160px', borderRadius: '50%', border: '20px solid rgba(239,68,68,0.04)', pointerEvents: 'none', zIndex: 0 }} />

            {/* Card content — z-index 1 so it's above decorations */}
            <div style={{ position: 'relative', zIndex: 1 }}>

              {/* Subtitle — TRAINER LOGIN / CREATE ACCOUNT */}
              <p style={{
                margin: '0 0 1.5rem',
                fontFamily: 'var(--font-pixel)',
                fontSize: 'clamp(0.48rem, 1.8vw, 0.6rem)',
                color: 'var(--pk-text-muted)',
                letterSpacing: '0.12em',
                textAlign: 'center',
                textTransform: 'uppercase',
              }}>
                ◆ {isRegister ? 'CREATE ACCOUNT' : 'TRAINER LOGIN'} ◆
              </p>

              {/* Error box */}
              {error && (
                <div role="alert" style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.45)',
                  borderRadius: '0.5rem',
                  padding: '0.625rem 0.875rem',
                  marginBottom: '1.25rem',
                }}>
                  <span style={{ display: 'block', fontFamily: 'var(--font-pixel)', fontSize: '0.48rem', color: 'var(--pk-red)', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                    ▶ ERROR
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'rgba(239,68,68,0.85)', lineHeight: 1.5 }}>{error}</span>
                </div>
              )}

              <form onSubmit={isRegister ? handleNextStep : handleSubmit} noValidate>
                {/* Username */}
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="login-username" style={labelStyle}>USERNAME</label>
                  <input
                    id="login-username"
                    type="text"
                    className="pk-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={loading}
                    placeholder="TRAINER NAME"
                    style={inputStyle}
                  />
                </div>

                {/* Password */}
                <div style={{ marginBottom: isRegister ? '1rem' : '1.5rem' }}>
                  <label htmlFor="login-password" style={labelStyle}>PASSWORD</label>
                  <input
                    id="login-password"
                    type="password"
                    className="pk-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    disabled={loading}
                    placeholder="••••••••"
                    style={inputStyle}
                  />
                </div>

                {/* Register-only: Section */}
                {isRegister && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label htmlFor="login-section" style={labelStyle}>
                      SECTION <span style={{ color: 'var(--pk-text-muted)', opacity: 0.5 }}>(optional)</span>
                    </label>
                    <input
                      id="login-section"
                      type="text"
                      className="pk-input"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      disabled={loading}
                      placeholder="3ISC"
                      style={inputStyle}
                    />
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  style={submitBtnStyle(loading)}
                >
                  {loading && (
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                      <path d="M12 2 A10 10 0 0 1 22 12" stroke="white" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  )}
                  {loading
                    ? (isRegister ? 'LOADING...' : 'LOGGING IN...')
                    : (isRegister ? 'NEXT →' : '▶ LOG IN')
                  }
                </button>
              </form>

              {/* Mode toggle */}
              <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                {isRegister ? (
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    style={{ background: 'none', border: 'none', color: 'var(--pk-text-muted)', fontFamily: 'var(--font-pixel)', fontSize: '0.48rem', letterSpacing: '0.08em', cursor: 'pointer', padding: '0.25rem', transition: 'color 0.15s ease' }}
                  >
                    Already registered? Log In
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    style={{ background: 'none', border: 'none', color: 'var(--pk-text-muted)', fontFamily: 'var(--font-pixel)', fontSize: '0.48rem', letterSpacing: '0.08em', cursor: 'pointer', padding: '0.25rem', transition: 'color 0.15s ease' }}
                  >
                    New trainer? Create Account
                  </button>
                )}
              </div>

            </div>{/* end card content */}
          </div>{/* end card */}

          {/* ── Type badges — properly BELOW the card ────── */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            justifyContent: 'center',
            marginTop: '1rem',
            opacity: 0.7,
          }}>
            {TYPE_BADGES.map(({ color, label }) => (
              <span key={label} style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.26rem',
                letterSpacing: '0.04em',
                padding: '0.15rem 0.45rem',
                borderRadius: '999px',
                background: `${color}18`,
                border: `1px solid ${color}44`,
                color,
              }}>
                {label}
              </span>
            ))}
          </div>

        </div>{/* end outer wrapper */}
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
