'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { RoleBadge } from '@/components/ui/RoleBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ProfessorOak } from '@/components/ui/ProfessorOak';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import type { Pokemon } from '@/types';

const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

const POKEMON_TYPES = [
  'All', 'Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice',
  'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
  'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
];

const ROLES = ['All', 'Sweeper', 'Tank', 'Wall', 'Support', 'Balanced'];

const REGIONS = ['All', 'Kanto', 'Johto', 'Kalos', 'Alola'] as const;
type Region = typeof REGIONS[number];

/* ── Type colour map (for filter pill backgrounds) ─────────── */
const TYPE_COLORS: Record<string, string> = {
  Normal: '#A8A878', Fire: '#F08030', Water: '#6890F0', Grass: '#78C850',
  Electric: '#F8D030', Ice: '#98D8D8', Fighting: '#C03028', Poison: '#A040A0',
  Ground: '#E0C068', Flying: '#A890F0', Psychic: '#F85888', Bug: '#A8B820',
  Rock: '#B8A038', Ghost: '#705898', Dragon: '#7038F8', Dark: '#705848',
  Steel: '#B8B8D0', Fairy: '#EE99AC',
};

/* ── Region to native_region field mapping ─────────────────── */
const REGION_FIELD_MAP: Record<Region, string | null> = {
  All: null,
  Kanto: 'kanto',
  Johto: 'johto',
  Kalos: 'kalos',
  Alola: 'alola',
};

/* ── Type weakness chart (simplified Gen 1–7) ──────────────── */
const TYPE_WEAKNESSES: Record<string, string[]> = {
  Normal: ['Fighting'],
  Fire: ['Water', 'Ground', 'Rock'],
  Water: ['Grass', 'Electric'],
  Grass: ['Fire', 'Ice', 'Poison', 'Flying', 'Bug'],
  Electric: ['Ground'],
  Ice: ['Fire', 'Fighting', 'Rock', 'Steel'],
  Fighting: ['Flying', 'Psychic', 'Fairy'],
  Poison: ['Ground', 'Psychic'],
  Ground: ['Water', 'Grass', 'Ice'],
  Flying: ['Electric', 'Ice', 'Rock'],
  Psychic: ['Bug', 'Ghost', 'Dark'],
  Bug: ['Fire', 'Flying', 'Rock'],
  Rock: ['Water', 'Grass', 'Fighting', 'Ground', 'Steel'],
  Ghost: ['Ghost', 'Dark'],
  Dragon: ['Ice', 'Dragon', 'Fairy'],
  Dark: ['Fighting', 'Bug', 'Fairy'],
  Steel: ['Fire', 'Fighting', 'Ground'],
  Fairy: ['Poison', 'Steel'],
};

function getWeaknesses(type1: string, type2?: string): string[] {
  const t1 = type1 ? (type1.charAt(0).toUpperCase() + type1.slice(1).toLowerCase()) : '';
  const t2 = type2 ? (type2.charAt(0).toUpperCase() + type2.slice(1).toLowerCase()) : '';
  const weak1 = TYPE_WEAKNESSES[t1] ?? [];
  const weak2 = t2 ? (TYPE_WEAKNESSES[t2] ?? []) : [];
  return Array.from(new Set([...weak1, ...weak2]));
}

/* ── Stat mini-bar (GBA HP style) ─────────────────────────── */
function StatMiniBar({ value, max = 255 }: { readonly value: number; readonly max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 70 ? '#58C84A' : pct >= 40 ? '#E0C030' : '#E82828';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
      <span style={{ width: '2rem', textAlign: 'right', fontSize: '0.72rem', fontWeight: 600, color: 'var(--pk-text)' }}>{value}</span>
      <div style={{ width: '56px', height: '5px', background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, boxShadow: `0 0 4px ${color}88` }} />
      </div>
    </div>
  );
}

/* ── Pokédex entry popup ─────────────────────────────────── */
interface PokedexEntryPopupProps {
  readonly pokemon: Pokemon;
  readonly userAssigned?: boolean;
  readonly isLoggedIn?: boolean;
}

function PokedexEntryPopup({ pokemon, userAssigned = false, isLoggedIn = false }: PokedexEntryPopupProps) {
  const stats: Array<{ label: string; value: number; max: number }> = [
    { label: 'HP',    value: pokemon.hp,              max: 255 },
    { label: 'Atk',   value: pokemon.attack,          max: 190 },
    { label: 'Def',   value: pokemon.defense,         max: 230 },
    { label: 'SpAtk', value: pokemon.special_attack,  max: 194 },
    { label: 'SpDef', value: pokemon.special_defense, max: 230 },
    { label: 'Spd',   value: pokemon.speed,           max: 180 },
  ];

  const weaknesses = getWeaknesses(pokemon.type_1, pokemon.type_2 ?? undefined);
  const nativeRegion = pokemon.native_region;
  const restrictedStatus = pokemon.restricted_status;
  const isRestricted = restrictedStatus && restrictedStatus !== 'none';

  return (
    <tr>
      <td colSpan={13} style={{ padding: 0 }}>
        <div className="pokedex-entry-popup open" style={{ padding: 'clamp(0.75rem, 2vw, 1.25rem)', overflowX: 'auto' }}>
          {/* Pokédex scan strip at top */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.42rem', color: 'var(--pk-red)', letterSpacing: '0.1em' }}>
              ◆ POKÉDEX DATA
            </span>
            <div style={{ height: '1px', flex: 1, background: 'linear-gradient(90deg, rgba(239,68,68,0.4), transparent)' }} />
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.4rem', color: 'var(--pk-text-dim)' }}>
              #{String(pokemon.pokeapi_id).padStart(3, '0')}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Sprite — with GBA frame */}
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ background: '#0d1a0d', border: '2px solid #1a2a1a', borderRadius: '4px', padding: '8px', display: 'inline-block', position: 'relative' }}>
                <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,60,0.02) 3px, rgba(0,255,60,0.02) 4px)', pointerEvents: 'none', zIndex: 1, borderRadius: '2px' }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${SPRITE_BASE}/${pokemon.pokeapi_id}.png`}
                  alt={pokemon.name}
                  width={96}
                  height={96}
                  style={{ imageRendering: 'pixelated', display: 'block', filter: 'drop-shadow(0 0 8px var(--pk-red-glow))', position: 'relative', zIndex: 2 }}
                  loading="lazy"
                />
              </div>
              <p style={{ margin: '0.25rem 0 0', fontFamily: 'var(--font-pixel)', fontSize: '0.4rem', color: 'var(--pk-text-dim)' }}>
                #{String(pokemon.pokeapi_id).padStart(3, '0')}
              </p>
            </div>

            {/* Info */}
            <div style={{ flex: '1 1 160px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontWeight: 800, color: 'var(--pk-text)', textTransform: 'capitalize', fontSize: 'clamp(0.9rem, 1.8vw, 1.1rem)' }}>
                  {pokemon.name}
                </h3>
                <TypeBadge type={pokemon.type_1} />
                {pokemon.type_2 && <TypeBadge type={pokemon.type_2} />}
                <RoleBadge role={pokemon.role_label} />
              </div>

              {/* Native region + restricted */}
              <div className="pk-popup-region-row">
                {nativeRegion && (
                  <span className="pk-region-badge">
                    🗺 NATIVE: {nativeRegion.toUpperCase()}
                  </span>
                )}
                {isRestricted && (
                  <span className="pk-restricted-badge">
                    ⛔ RESTRICTED ({restrictedStatus?.toUpperCase()})
                  </span>
                )}
              </div>

              {/* Stat bars — GBA HP-style */}
              <p style={{ margin: '0.5rem 0 0.35rem', fontFamily: 'var(--font-pixel)', fontSize: '0.42rem', color: 'var(--pk-text-muted)', letterSpacing: '0.06em' }}>▶ BASE STATS</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.25rem 1rem' }}>
                {stats.map(({ label, value, max }) => {
                  const pct = Math.min((value / max) * 100, 100);
                  const color = pct >= 60 ? '#58C84A' : pct >= 35 ? '#E0C030' : '#E82828';
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.4rem', color: 'var(--pk-text-muted)', width: '2.5rem', textAlign: 'right', flexShrink: 0 }}>{label}</span>
                      <div style={{ height: '6px', flex: 1, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, boxShadow: `0 0 4px ${color}`, transition: 'width 0.6s ease-out' }} />
                      </div>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--pk-text)', width: '1.75rem', flexShrink: 0 }}>{value}</span>
                    </div>
                  );
                })}
              </div>

              {/* Weaknesses */}
              {weaknesses.length > 0 && (
                <>
                  <p style={{ margin: '0.625rem 0 0.25rem', fontFamily: 'var(--font-pixel)', fontSize: '0.42rem', color: 'var(--pk-text-muted)', letterSpacing: '0.06em' }}>▶ WEAK TO (2×)</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {weaknesses.map((w) => (
                      <span key={w} className="pk-weakness-badge">
                        {w.toUpperCase()} 2×
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Extra info panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--pk-text-muted)', background: '#0d1120', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.5rem', padding: '0.75rem', flexShrink: 0, minWidth: '100px' }}>
              <div>
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.38rem', color: 'var(--pk-text-dim)', display: 'block', marginBottom: '0.1rem', letterSpacing: '0.06em' }}>BST</span>
                <span style={{ fontWeight: 800, color: 'var(--pk-gold)', fontSize: '1.1rem', textShadow: '0 0 8px var(--pk-gold-glow)' }}>{pokemon.total_base_stats}</span>
              </div>
              <hr className="pk-pixel-hr" style={{ margin: '0.25rem 0' }} />
              <div>
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.38rem', display: 'block', marginBottom: '0.1rem', letterSpacing: '0.06em' }}>SPEED TIER</span>
                <span style={{ textTransform: 'capitalize', fontSize: '0.75rem', color: 'var(--pk-text)' }}>{pokemon.speed_tier}</span>
              </div>
              <hr className="pk-pixel-hr" style={{ margin: '0.25rem 0' }} />
              <div>
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.38rem', display: 'block', marginBottom: '0.1rem', letterSpacing: '0.06em' }}>POOL</span>
                {isLoggedIn ? (
                  userAssigned
                    ? <span style={{ color: '#4ADE80', fontSize: '0.75rem' }}>✓ In My Pool</span>
                    : <span style={{ color: 'var(--pk-text-dim)', fontSize: '0.75rem' }}>Not in pool</span>
                ) : (
                  pokemon.is_assigned === 1
                    ? <span style={{ color: '#4ADE80', fontSize: '0.75rem' }}>✓ Assigned</span>
                    : <span style={{ color: 'var(--pk-text-dim)', fontSize: '0.75rem' }}>Available</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function PokemonPage() {
  const [pokemon, setPokemon] = useState<Pokemon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState<Region>('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<keyof Pokemon>('total_base_stats');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [myPool, setMyPool] = useState<Set<number>>(new Set());
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [assignLoading, setAssignLoading] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const data = await api.getPokemon();
        if (!cancelled) setPokemon(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Pokémon');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) return;
    setIsLoggedIn(true);
    api.getMyPool()
      .then((rows) => {
        setMyPool(new Set(rows.filter((r) => r.user_assigned).map((r) => r.pokemon_id)));
      })
      .catch(() => { /* pool load failure is non-fatal */ });
  }, []);

  function toggleSort(key: keyof Pokemon) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  function toggleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  async function handleToggleAssign(e: React.MouseEvent, pokemonId: number) {
    e.stopPropagation(); // prevent row expand
    if (assignLoading.has(pokemonId)) return;
    setAssignLoading((prev) => new Set(prev).add(pokemonId));
    const isAssigned = myPool.has(pokemonId);
    try {
      if (isAssigned) {
        await api.unassignPokemon(pokemonId);
        setMyPool((prev) => { const n = new Set(prev); n.delete(pokemonId); return n; });
      } else {
        await api.assignPokemon(pokemonId);
        setMyPool((prev) => new Set(prev).add(pokemonId));
      }
    } catch {
      // silently ignore — pool state unchanged on error
    } finally {
      setAssignLoading((prev) => { const n = new Set(prev); n.delete(pokemonId); return n; });
    }
  }

  const filtered = useMemo(() => {
    let result = [...pokemon];
    if (search.trim()) { const q = search.toLowerCase(); result = result.filter((p) => p.name.toLowerCase().includes(q)); }
    if (typeFilter !== 'All') { const t = typeFilter.toLowerCase(); result = result.filter((p) => p.type_1.toLowerCase() === t || (p.type_2 ?? '').toLowerCase() === t); }
    if (roleFilter !== 'All') { const r = roleFilter.toLowerCase(); result = result.filter((p) => p.role_label.toLowerCase() === r); }
    if (assignedOnly) {
      result = isLoggedIn
        ? result.filter((p) => myPool.has(p.pokemon_id))
        : result.filter((p) => p.is_assigned === 1);
    }
    if (regionFilter !== 'All') {
      const regionVal = REGION_FIELD_MAP[regionFilter];
      result = result.filter((p) => p.native_region?.toLowerCase() === regionVal);
    }
    result.sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return result;
  }, [pokemon, search, typeFilter, roleFilter, assignedOnly, regionFilter, sortKey, sortDir, myPool, isLoggedIn]);

  function SortBtn({ col, label }: { readonly col: keyof Pokemon; readonly label: string }) {
    const active = sortKey === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: active ? 'var(--pk-red)' : 'var(--pk-text-muted)', padding: 0, whiteSpace: 'nowrap', fontFamily: 'var(--font-body)' }}
      >
        {label}
        <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.5rem' }}>{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    );
  }

  return (
    <div className="pk-section">
      <div className="pk-page-glow" aria-hidden="true" />

      {/* ── Pokédex Device Header ──────────────────────────── */}
      <header style={{ marginBottom: 'clamp(1.25rem, 3vw, 2rem)' }}>
        {/* Red Pokédex device header bar */}
        <div className="pk-dex-header-bar" style={{ marginBottom: '0.875rem' }}>
          <div className="pk-dex-header-light" aria-hidden="true" />
          {/* Mini RGB dots */}
          {(['#FF4444', '#FFCC00', '#44CC44'] as const).map((color, i) => (
            <div key={i} aria-hidden="true" style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}99`, border: '1px solid rgba(0,0,0,0.3)', flexShrink: 0 }} />
          ))}
          {/* Pokéball SVG icon */}
          <svg width="14" height="14" viewBox="0 0 40 40" aria-hidden="true" style={{ flexShrink: 0, marginLeft: '0.25rem' }}>
            <path d="M4 20 A16 16 0 0 1 36 20" fill="#fff" opacity="0.9" />
            <path d="M36 20 A16 16 0 0 1 4 20" fill="#fff" opacity="0.6" />
            <line x1="4" y1="20" x2="36" y2="20" stroke="rgba(0,0,0,0.3)" strokeWidth="3" />
            <circle cx="20" cy="20" r="4" fill="rgba(0,0,0,0.3)" />
            <circle cx="20" cy="20" r="2" fill="#fff" opacity="0.8" />
          </svg>
          <span className="pk-dex-title">POKÉDEX</span>
          <span className="pk-dex-count">● {pokemon.length} REGISTERED</span>
        </div>

        <h1 style={{ margin: '0 0 0.375rem', fontSize: 'clamp(1.3rem, 3vw, 2rem)', fontWeight: 900, color: 'var(--pk-text)' }}>
          Pokémon Database
        </h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--pk-text-muted)' }}>
          Browse and filter the full Pokémon pool. Click any row to open its Pokédex entry.
        </p>
      </header>

      {/* ── Filters ────────────────────────────────────────── */}
      <div className="pk-filter-bar">
        {/* Search */}
        <div style={{ flex: '1 1 200px' }}>
          <label htmlFor="poke-search" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', marginBottom: '0.375rem', letterSpacing: '0.06em' }}>
            <span aria-hidden="true">◆</span> SEARCH
          </label>
          <input id="poke-search" type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" className="pk-input" style={{ fontSize: '16px' }} />
        </div>

        {/* Type filter — pill buttons with type colours */}
        <div style={{ flex: '2 1 280px' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', marginBottom: '0.375rem', letterSpacing: '0.06em', margin: '0 0 0.375rem' }}>
            <span aria-hidden="true">◆</span> TYPE
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {POKEMON_TYPES.map((t) => {
              const active = typeFilter === t;
              const bg = t === 'All' ? (active ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)') : (active ? `${TYPE_COLORS[t]}cc` : `${TYPE_COLORS[t]}22`);
              const border = t === 'All' ? (active ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.1)') : (active ? `${TYPE_COLORS[t]}cc` : `${TYPE_COLORS[t]}55`);
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  style={{ background: bg, border: `1px solid ${border}`, borderRadius: '999px', padding: '0.15rem 0.5rem', fontFamily: 'var(--font-pixel)', fontSize: '0.32rem', color: active ? '#fff' : 'var(--pk-text-muted)', cursor: 'pointer', letterSpacing: '0.04em', transition: 'all 0.15s ease', textTransform: 'uppercase' }}
                  aria-pressed={active}
                >
                  {t === 'All' ? 'ALL' : t.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Role + Region row */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label htmlFor="role-filter" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', marginBottom: '0.375rem', letterSpacing: '0.06em' }}>
              <span aria-hidden="true">◆</span> ROLE
            </label>
            <select id="role-filter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={`pk-select ${roleFilter !== 'All' ? 'pk-filter-active' : ''}`}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="region-filter" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', marginBottom: '0.375rem', letterSpacing: '0.06em' }}>
              <span aria-hidden="true">◆</span> REGION
            </label>
            <select id="region-filter" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value as Region)} className={`pk-select ${regionFilter !== 'All' ? 'pk-filter-active' : ''}`}>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', paddingBottom: '0.25rem' }}>
            <input type="checkbox" checked={assignedOnly} onChange={(e) => setAssignedOnly(e.target.checked)} style={{ accentColor: 'var(--pk-red)', width: '16px', height: '16px', cursor: 'pointer' }} />
            <span style={{ fontSize: '0.5rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', letterSpacing: '0.04em' }}>
              {isLoggedIn ? 'MY POOL' : 'ASSIGNED'}
            </span>
          </label>
        </div>

        {/* Count badge */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>
          <span className="pk-count-badge">
            <span aria-hidden="true">◆</span>
            {filtered.length} / {pokemon.length}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="pk-error" role="alert" style={{ marginBottom: '1rem' }}>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.52rem', letterSpacing: '0.06em' }}>⚠ ERROR: </span>{error}
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="pokedex-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div className="pk-loading-msg">
            <LoadingSpinner size="lg" />
            <p className="pk-loading-title">SEARCHING POKÉDEX...</p>
            <p className="pk-loading-sub">Loading Pokémon database</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="pk-table" style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Pokémon database">
              <thead>
                <tr>
                  <th style={{ width: '32px', fontFamily: 'var(--font-pixel)', fontSize: '0.38rem' }}>#</th>
                  <th style={{ width: '48px', fontFamily: 'var(--font-pixel)', fontSize: '0.4rem' }}>SPR</th>
                  <th><SortBtn col="name" label="Name" /></th>
                  <th style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.42rem' }}>TYPE</th>
                  <th style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.42rem' }}>ROLE</th>
                  <th><SortBtn col="hp" label="HP" /></th>
                  <th><SortBtn col="attack" label="Atk" /></th>
                  <th><SortBtn col="defense" label="Def" /></th>
                  <th><SortBtn col="special_attack" label="SpA" /></th>
                  <th><SortBtn col="special_defense" label="SpD" /></th>
                  <th><SortBtn col="speed" label="Spd" /></th>
                  <th><SortBtn col="total_base_stats" label="BST" /></th>
                  <th style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.42rem' }}>POOL</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ padding: 0 }}>
                      <div className="pk-empty-state">
                        <span className="pk-empty-icon">🔍</span>
                        <p className="pk-empty-title">NO POKÉMON FOUND</p>
                        <ProfessorOak message="No Pokémon match your filters." />
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((p) => {
                  const restrictedStatus = p.restricted_status;
                  const isRestricted = restrictedStatus && restrictedStatus !== 'none';
                  const nativeRegion = p.native_region;
                  return (
                    <React.Fragment key={p.pokemon_id}>
                      <tr
                        onClick={() => toggleExpand(p.pokemon_id)}
                        style={{ cursor: 'pointer' }}
                        aria-expanded={expandedId === p.pokemon_id}
                      >
                        {/* Pokédex number */}
                        <td className="pk-dex-num">
                          #{String(p.pokeapi_id).padStart(3, '0')}
                        </td>
                        {/* Sprite */}
                        <td className="pk-sprite-cell">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`${SPRITE_BASE}/${p.pokeapi_id}.png`}
                            alt={p.name}
                            width={32}
                            height={32}
                            style={{ imageRendering: 'pixelated', display: 'block', transition: 'transform 0.2s ease' }}
                            loading="lazy"
                            className="pokemon-sprite-row"
                          />
                        </td>
                        {/* Name */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {expandedId === p.pokemon_id && (
                              <span aria-hidden="true" style={{ color: 'var(--pk-red)', fontFamily: 'var(--font-pixel)', fontSize: '0.55rem' }}>▶</span>
                            )}
                            <span style={{ fontWeight: 700, textTransform: 'capitalize', whiteSpace: 'nowrap', color: expandedId === p.pokemon_id ? 'var(--pk-red)' : 'var(--pk-text)' }}>
                              {p.name}
                            </span>
                            {nativeRegion && (
                              <span className="pk-region-badge">{nativeRegion.toUpperCase()}</span>
                            )}
                          </div>
                        </td>
                        {/* Type */}
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            <TypeBadge type={p.type_1} />
                            {p.type_2 && <TypeBadge type={p.type_2} />}
                          </div>
                        </td>
                        {/* Role */}
                        <td><RoleBadge role={p.role_label} /></td>
                        {/* Stats */}
                        <td><StatMiniBar value={p.hp} /></td>
                        <td><StatMiniBar value={p.attack} /></td>
                        <td><StatMiniBar value={p.defense} /></td>
                        <td><StatMiniBar value={p.special_attack} /></td>
                        <td><StatMiniBar value={p.special_defense} /></td>
                        <td><StatMiniBar value={p.speed} /></td>
                        {/* BST */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.52rem', fontWeight: 800, color: 'var(--pk-gold)', textShadow: '0 0 8px var(--pk-gold-glow)' }}>
                              {p.total_base_stats}
                            </span>
                            {isRestricted && (
                              <span className="pk-restricted-badge">⚠ REST.</span>
                            )}
                          </div>
                        </td>
                        {/* Pool */}
                        <td onClick={(e) => e.stopPropagation()}>
                          {isLoggedIn ? (
                            <button
                              onClick={(e) => handleToggleAssign(e, p.pokemon_id)}
                              disabled={assignLoading.has(p.pokemon_id)}
                              title={myPool.has(p.pokemon_id) ? 'Remove from my pool' : 'Add to my pool'}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                borderRadius: '999px',
                                padding: '0.15rem 0.55rem',
                                fontSize: '0.55rem',
                                fontFamily: 'var(--font-pixel)',
                                fontWeight: 700,
                                border: myPool.has(p.pokemon_id)
                                  ? '1px solid rgba(74,222,128,0.45)'
                                  : '1px solid rgba(255,255,255,0.12)',
                                background: myPool.has(p.pokemon_id)
                                  ? 'rgba(74,222,128,0.12)'
                                  : 'rgba(255,255,255,0.04)',
                                color: myPool.has(p.pokemon_id) ? '#4ADE80' : 'var(--pk-text-dim)',
                                cursor: assignLoading.has(p.pokemon_id) ? 'not-allowed' : 'pointer',
                                opacity: assignLoading.has(p.pokemon_id) ? 0.6 : 1,
                                transition: 'all 0.15s ease',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {assignLoading.has(p.pokemon_id) ? '…' : myPool.has(p.pokemon_id) ? '✓' : '+'}
                            </button>
                          ) : (
                            p.is_assigned === 1 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', fontWeight: 700, background: 'rgba(74,222,128,0.12)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.3)', letterSpacing: '0.04em' }}>✓</span>
                            ) : (
                              <span style={{ display: 'inline-block', borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', fontWeight: 700, background: 'rgba(255,255,255,0.04)', color: 'var(--pk-text-dim)', border: '1px solid rgba(255,255,255,0.07)', letterSpacing: '0.04em' }}>—</span>
                            )
                          )}
                        </td>
                      </tr>
                      {expandedId === p.pokemon_id && (
                        <PokedexEntryPopup
                          pokemon={p}
                          userAssigned={myPool.has(p.pokemon_id)}
                          isLoggedIn={isLoggedIn}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            <div className="pk-table-scroll-hint">◆ {filtered.length} POKÉMON DISPLAYED — CLICK ROW TO OPEN POKÉDEX ENTRY</div>
          </div>
        )}
      </div>
    </div>
  );
}
