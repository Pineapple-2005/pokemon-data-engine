'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { TrainerCard } from '@/components/ui/TrainerCard';
import { PokemonAutocomplete } from '@/components/ui/PokemonAutocomplete';
import { api } from '@/lib/api';
import { getTrainerProfile, storeUser, getStoredUser } from '@/lib/auth';
import { getPokeapiId } from '@/lib/pokemon-ids';
import type { TrainerProfile, Pokemon } from '@/types';

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

const OA_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';

const HOMETOWNS = [
  'Pallet Town', 'Cerulean City', 'Vermilion City', 'Lavender Town',
  'Celadon City', 'Fuchsia City', 'Saffron City', 'Cinnabar Island',
];

const TRAINER_TITLES = [
  'Trainer', 'Gym Leader', 'Elite Four', 'Champion', 'Team Rocket', 'Professor', 'Rival',
];

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-pixel)',
  fontSize: '0.5rem',
  color: 'var(--pk-text-muted)',
  letterSpacing: '0.1em',
  marginBottom: '0.4rem',
};

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

// ── Edit modal ───────────────────────────────────────────────────────────────
interface EditModalProps {
  profile: TrainerProfile;
  onSave: (updated: TrainerProfile) => void;
  onClose: () => void;
}

function EditModal({ profile, onSave, onClose }: EditModalProps) {
  const [trainerClass, setTrainerClass] = useState(profile.trainer_class);
  const [cardColor, setCardColor] = useState(profile.trainer_card_color);
  const [starterPokemon, setStarterPokemon] = useState(profile.starter_pokemon);
  const [starterQuery, setStarterQuery] = useState(profile.starter_pokemon);
  const [selectedStarter, setSelectedStarter] = useState<Pokemon | null>(null);
  const [myPool, setMyPool] = useState<Array<Pokemon & { user_assigned: boolean }>>([]);

  useEffect(() => {
    api.getMyPool().then((pool) => setMyPool(pool.filter((p) => p.user_assigned))).catch(() => {});
  }, []);
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [hometown, setHometown] = useState(profile.hometown);
  const [trainerTitle, setTrainerTitle] = useState(profile.trainer_title);
  const [trainerId, setTrainerId] = useState(profile.trainer_id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const updated = await api.updateProfile({
        trainer_class: trainerClass,
        trainer_card_color: cardColor,
        starter_pokemon: starterPokemon,
        display_name: displayName,
        hometown,
        trainer_title: trainerTitle,
        trainer_id: trainerId,
      });
      const stored = getStoredUser();
      if (stored) {
        storeUser({
          ...stored,
          trainer_class: updated.trainer_class,
          trainer_card_color: updated.trainer_card_color,
          starter_pokemon: updated.starter_pokemon,
          display_name: updated.display_name,
          hometown: updated.hometown,
          trainer_title: updated.trainer_title,
          trainer_id: updated.trainer_id,
        });
      }
      onSave(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit Trainer"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #0d1120, #0a0e1a)',
          border: '2px solid rgba(239,68,68,0.4)',
          borderRadius: '1rem',
          padding: '2rem',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90dvh',
          overflowY: 'auto',
          boxShadow: '0 0 40px rgba(239,68,68,0.2), 0 20px 60px rgba(0,0,0,0.7)',
        }}
      >
        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-pixel)', fontSize: 'clamp(0.6rem, 2vw, 0.75rem)', color: 'var(--pk-red)', letterSpacing: '0.12em' }}>
            EDIT TRAINER
          </h2>
          <button
            onClick={onClose}
            aria-label="Close edit modal"
            style={{ background: 'none', border: 'none', color: 'var(--pk-text-muted)', fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div role="alert" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.5)', borderRadius: '0.5rem', padding: '0.625rem 0.875rem', marginBottom: '1.25rem' }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-pixel)', fontSize: '0.5rem', color: 'var(--pk-red)', letterSpacing: '0.08em', marginBottom: '0.2rem' }}>ERROR</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'rgba(239,68,68,0.9)' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} noValidate>
          {/* A. Trainer Class */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ ...labelStyle, marginBottom: '0.75rem' }}>TRAINER CLASS</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto', padding: '0.25rem', scrollbarWidth: 'thin', scrollbarColor: 'rgba(239,68,68,0.3) transparent' }}>
              {TRAINER_CLASSES.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTrainerClass(key)}
                  aria-pressed={trainerClass === key}
                  title={formatTrainerClass(key)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem',
                    padding: '0.5rem 0.25rem', borderRadius: '0.5rem',
                    border: trainerClass === key ? '2px solid var(--pk-red)' : '2px solid rgba(255,255,255,0.08)',
                    background: trainerClass === key ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://play.pokemonshowdown.com/sprites/trainers/${key}.png`}
                    alt={formatTrainerClass(key)}
                    width={64} height={64}
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

          {/* B. Card Color */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ ...labelStyle, marginBottom: '0.75rem' }}>CARD COLOR</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
              {Object.entries(CARD_COLORS).map(([name, hex]) => (
                <button key={name} type="button" onClick={() => setCardColor(hex)} aria-label={`Card color: ${name}`} aria-pressed={cardColor === hex}
                  style={{ width: '36px', height: '36px', borderRadius: '50%', background: hex, border: '2px solid rgba(255,255,255,0.15)', outline: cardColor === hex ? '2px solid white' : 'none', outlineOffset: '2px', cursor: 'pointer', transition: 'outline 0.1s ease', flexShrink: 0 }}
                />
              ))}
            </div>
          </div>

          {/* C. Starter */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ ...labelStyle, marginBottom: '0.25rem' }}>MY POKEMON</p>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.68rem', color: 'var(--pk-text-muted)' }}>
              Search or pick from your assigned pool
            </p>

            {/* Assigned pool quick-pick chips */}
            {myPool.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                {myPool.map((p) => {
                  const active = starterPokemon === p.name;
                  return (
                    <button
                      key={p.pokemon_id}
                      type="button"
                      onClick={() => { setStarterPokemon(p.name); setStarterQuery(p.name); setSelectedStarter(p); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.2rem 0.5rem 0.2rem 0.2rem',
                        borderRadius: '999px',
                        border: active ? '2px solid #F8D030' : '1px solid rgba(255,255,255,0.15)',
                        background: active ? 'rgba(248,208,48,0.1)' : 'rgba(255,255,255,0.04)',
                        cursor: 'pointer', transition: 'all 0.15s ease',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.pokeapi_id}.png`}
                        alt={p.name} width={24} height={24}
                        style={{ imageRendering: 'pixelated', flexShrink: 0 }}
                      />
                      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.36rem', color: active ? '#F8D030' : 'var(--pk-text-muted)', textTransform: 'capitalize', letterSpacing: '0.04em' }}>
                        {p.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <PokemonAutocomplete
              value={starterQuery}
              onChange={setStarterQuery}
              onSelect={(p) => { setStarterPokemon(p.name); setSelectedStarter(p); setStarterQuery(p.name); }}
              placeholder="Search any Pokemon..."
            />

            {starterPokemon && (
              <div style={{
                marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.875rem',
                padding: '0.625rem 0.875rem', borderRadius: '0.625rem',
                background: 'rgba(248,208,48,0.07)', border: '2px solid rgba(248,208,48,0.35)',
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${OA_SPRITE}/${selectedStarter?.pokeapi_id ?? getPokeapiId(starterPokemon)}.png`}
                  alt={starterPokemon} width={56} height={56}
                  style={{ objectFit: 'contain', flexShrink: 0 }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div>
                  <p style={{ margin: '0 0 0.2rem', fontFamily: 'var(--font-pixel)', fontSize: '0.5rem', color: '#F8D030', letterSpacing: '0.08em', textTransform: 'capitalize' }}>
                    {starterPokemon} ✓
                  </p>
                  <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--pk-text-muted)' }}>
                    {selectedStarter ? `${selectedStarter.type_1}${selectedStarter.type_2 ? ` / ${selectedStarter.type_2}` : ''} · ${selectedStarter.role_label}` : 'Current selection'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* D. Other fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label htmlFor="edit-display-name" style={labelStyle}>TRAINER NAME</label>
              <input id="edit-display-name" type="text" className="pk-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={loading} placeholder="Display name" style={{ width: '100%', fontSize: '16px' }} />
            </div>
            <div>
              <label htmlFor="edit-hometown" style={labelStyle}>HOMETOWN</label>
              <select id="edit-hometown" value={hometown} onChange={(e) => setHometown(e.target.value)} disabled={loading} style={selectStyle}>
                {HOMETOWNS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="edit-title" style={labelStyle}>TRAINER TITLE</label>
              <select id="edit-title" value={trainerTitle} onChange={(e) => setTrainerTitle(e.target.value)} disabled={loading} style={selectStyle}>
                {TRAINER_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="edit-trainer-id" style={labelStyle}>TRAINER ID</label>
              <input id="edit-trainer-id" type="text" className="pk-input" value={trainerId} onChange={(e) => setTrainerId(e.target.value.slice(0, 6))} disabled={loading} placeholder="e.g. 123456" maxLength={6} style={{ width: '100%', fontSize: '16px' }} />
            </div>
          </div>

          {/* Save button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.75rem',
              background: loading ? 'rgba(139,0,0,0.4)' : 'linear-gradient(135deg, #CC0000, #8B0000)',
              border: '1px solid rgba(239,68,68,0.5)', borderRadius: '0.5rem',
              color: loading ? 'rgba(255,255,255,0.5)' : '#fff',
              fontFamily: 'var(--font-pixel)', fontSize: '0.65rem', letterSpacing: '0.12em',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              boxShadow: loading ? 'none' : '0 0 16px rgba(239,68,68,0.3)',
            }}
          >
            {loading && (
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                <path d="M12 2 A10 10 0 0 1 22 12" stroke="white" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            {loading ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Profile page inner (rendered inside AuthGuard) ───────────────────────────
function ProfilePageInner() {
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [battleCount, setBattleCount] = useState<number | null>(null);

  const loadProfile = useCallback(async () => {
    // Optimistic load from localStorage first
    const local = getTrainerProfile();
    if (local) setProfile(local);

    // Then fetch fresh from API
    try {
      const fresh = await api.getMyProfile();
      setProfile(fresh);
      // Persist fresh data back to localStorage
      const stored = getStoredUser();
      if (stored) {
        storeUser({
          ...stored,
          display_name: fresh.display_name,
          trainer_class: fresh.trainer_class,
          trainer_card_color: fresh.trainer_card_color,
          starter_pokemon: fresh.starter_pokemon,
          hometown: fresh.hometown,
          favorite_type: fresh.favorite_type,
          trainer_title: fresh.trainer_title,
          rival_name: fresh.rival_name,
          trainer_id: fresh.trainer_id,
        });
      }
    } catch {
      // If API not yet wired, local profile is sufficient
    }
  }, []);

  const loadBattleHistory = useCallback(async () => {
    try {
      const history = await api.getBattleHistory();
      setBattleCount(history.length);
    } catch {
      // Battle history is optional
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    void loadBattleHistory();
  }, [loadProfile, loadBattleHistory]);

  function handleSave(updated: TrainerProfile) {
    setProfile(updated);
    setEditOpen(false);
  }

  if (!profile) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'var(--pk-bg)' }}>
        <p style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.6rem', color: 'var(--pk-text-muted)', letterSpacing: '0.1em' }}>
          LOADING TRAINER DATA...
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--pk-bg)', padding: 'clamp(1.5rem, 4vw, 3rem)' }}>
      {/* Ambient glow */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(239,68,68,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Page title */}
      <h1 style={{ margin: '0 0 2rem', fontFamily: 'var(--font-pixel)', fontSize: 'clamp(0.65rem, 2vw, 0.85rem)', color: 'var(--pk-red)', letterSpacing: '0.14em', textAlign: 'center' }}>
        TRAINER PROFILE
      </h1>

      {/* Card centered */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
        <TrainerCard profile={profile} size="lg" showStats wins={0} losses={0} winRate={0} />

        {/* Edit button */}
        <button
          onClick={() => setEditOpen(true)}
          style={{
            padding: '0.625rem 1.5rem',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: '0.5rem',
            color: 'var(--pk-red)',
            fontFamily: 'var(--font-pixel)',
            fontSize: '0.55rem',
            letterSpacing: '0.1em',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
        >
          EDIT TRAINER
        </button>

        {/* Stats section */}
        <div style={{ width: '100%', maxWidth: '420px', background: '#0d1120', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.875rem', padding: '1.25rem', marginTop: '0.5rem' }}>
          <p style={{ margin: '0 0 1rem', fontFamily: 'var(--font-pixel)', fontSize: '0.5rem', color: 'var(--pk-text-muted)', letterSpacing: '0.12em' }}>BATTLE STATS</p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <StatBlock label="BATTLES" value={battleCount !== null ? String(battleCount) : '—'} />
            <StatBlock label="SECTION" value={profile.section || '—'} />
            <StatBlock label="CLASS" value={profile.trainer_class ? profile.trainer_class.replace(/-/g, ' ').toUpperCase() : '—'} />
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editOpen && (
        <EditModal profile={profile} onSave={handleSave} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '0.625rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p style={{ margin: '0 0 0.3rem', fontFamily: 'var(--font-pixel)', fontSize: '0.38rem', color: 'var(--pk-text-muted)', letterSpacing: '0.1em' }}>{label}</p>
      <p style={{ margin: 0, fontFamily: 'var(--font-pixel)', fontSize: '0.52rem', color: 'var(--pk-text)', letterSpacing: '0.08em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
    </div>
  );
}

// ── Default export — wrapped in AuthGuard ────────────────────────────────────
export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfilePageInner />
    </AuthGuard>
  );
}
