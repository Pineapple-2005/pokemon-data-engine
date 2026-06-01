'use client';

import React from 'react';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { RoleBadge } from '@/components/ui/RoleBadge';
import type { TournamentLoadout } from '@/types';

interface PokemonCardProps {
  readonly name: string;
  readonly type_1: string;
  readonly type_2?: string;
  readonly role?: string;
  readonly total_base_stats?: number;
  readonly usefulness_score?: number;
  readonly reason?: string;
  readonly slot?: number;
  readonly compact?: boolean;
  readonly pokeapi_id?: number;
  readonly loadout?: TournamentLoadout;
}

const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

function getStatColor(pct: number): string {
  if (pct >= 70) return '#4ADE80';
  if (pct >= 45) return '#FBBF24';
  return '#F87171';
}

function getStatGlow(pct: number): string {
  if (pct >= 70) return '#4ADE8066';
  if (pct >= 45) return '#FBBF2466';
  return '#F8717166';
}

export function PokemonCard({
  name,
  type_1,
  type_2,
  role,
  total_base_stats,
  usefulness_score,
  reason,
  slot,
  compact = false,
  pokeapi_id,
  loadout,
}: PokemonCardProps) {
  const statPct = total_base_stats ? Math.min((total_base_stats / 720) * 100, 100) : 0;
  const spriteUrl = pokeapi_id ? `${SPRITE_BASE}/${pokeapi_id}.png` : null;

  return (
    <div className="pokedex-card pk-corners pokemon-card-hover" style={{ padding: 'clamp(0.75rem, 2vw, 1.1rem)', display: 'flex', flexDirection: 'column', gap: '0.6rem', height: '100%' }}>
      {spriteUrl && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={spriteUrl}
            alt={name}
            width={64}
            height={64}
            style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 0 6px var(--pk-red-glow))' }}
            loading="lazy"
          />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div>
          {slot !== undefined && (
            <span style={{ fontSize: '0.6rem', color: 'var(--pk-text-dim)', fontFamily: 'var(--font-pixel)', display: 'block', marginBottom: '0.15rem' }}>
              SLOT {slot}
            </span>
          )}
          <h3 style={{ fontWeight: 700, color: 'var(--pk-text)', textTransform: 'capitalize', fontSize: 'clamp(0.85rem, 1.4vw, 1rem)', margin: 0, lineHeight: 1.2, fontFamily: 'var(--font-body)' }}>
            {name}
          </h3>
        </div>
        {role && <RoleBadge role={role} />}
      </div>

      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
        <TypeBadge type={type_1} />
        {type_2 && <TypeBadge type={type_2} />}
      </div>

      {total_base_stats !== undefined && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--pk-text-muted)', fontFamily: 'var(--font-pixel)' }}>BST</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--pk-text)' }}>{total_base_stats}</span>
          </div>
          <div className="pk-stat-bar">
            <div
              className="pk-stat-bar-fill"
              style={{
                width: `${statPct}%`,
                background: getStatColor(statPct),
                boxShadow: `0 0 6px ${getStatGlow(statPct)}`,
              }}
            />
          </div>
        </div>
      )}

      {usefulness_score !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.62rem', color: 'var(--pk-text-muted)', fontFamily: 'var(--font-pixel)' }}>USEFUL</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--pk-gold)' }}>{usefulness_score.toFixed(2)}</span>
        </div>
      )}

      {reason && !compact && (
        <p style={{ fontSize: '0.72rem', color: 'var(--pk-text-muted)', lineHeight: 1.5, borderTop: '1px solid var(--pk-glass-border)', paddingTop: '0.5rem', margin: 0 }}>
          {reason}
        </p>
      )}

      {loadout && !compact && (
        <div style={{ borderTop: '1px solid var(--pk-glass-border)', paddingTop: '0.55rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--pk-gold)', fontWeight: 700 }}>{loadout.item}</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--pk-text-muted)' }}>Ability: {loadout.ability}</div>
          <div style={{ fontSize: '0.56rem', color: 'var(--pk-text-dim)' }}>{loadout.evs}</div>
          <div style={{ fontSize: '0.56rem', color: 'var(--pk-text-dim)' }}>{loadout.nature} Nature</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.18rem', marginTop: '0.15rem' }}>
            {loadout.moves.map((move) => (
              <span key={move} style={{ fontSize: '0.58rem', color: 'var(--pk-text-muted)' }}>- {move}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
