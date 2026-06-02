'use client';

import React from 'react';
import type { TrainerProfile } from '@/types';
import { getPokeapiId } from '@/lib/pokemon-ids';

export interface TrainerCardProps {
  profile: TrainerProfile;
  size?: 'sm' | 'md' | 'lg';
  showStats?: boolean;
  wins?: number;
  losses?: number;
  winRate?: number;
}

const SIZE_CONFIG = {
  sm: { width: 240, spriteSize: 48,  cardTitleSize: '0.55rem', bodySize: '0.6rem',  tagSize: '0.38rem', padding: '0.75rem' },
  md: { width: 320, spriteSize: 80,  cardTitleSize: '0.7rem',  bodySize: '0.72rem', tagSize: '0.42rem', padding: '1rem'    },
  lg: { width: 420, spriteSize: 110, cardTitleSize: '0.85rem', bodySize: '0.82rem', tagSize: '0.46rem', padding: '1.25rem' },
};

function formatTrainerClass(key: string): string {
  return key.replace(/-/g, ' ').toUpperCase();
}

export function TrainerCard({ profile, size = 'md', showStats = false, wins, losses, winRate }: TrainerCardProps) {
  const cfg = SIZE_CONFIG[size];

  const starterKey = profile.starter_pokemon?.toLowerCase() ?? '';
  const starterId = getPokeapiId(starterKey);

  const trainerSpriteUrl = `https://play.pokemonshowdown.com/sprites/trainers/${profile.trainer_class}.png`;
  const starterSpriteUrl = starterId
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${starterId}.png`
    : null;

  return (
    <div
      style={{
        width: cfg.width,
        background: '#0d1120',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '0.875rem',
        overflow: 'hidden',
        fontFamily: 'var(--font-body)',
        flexShrink: 0,
      }}
    >
      {/* Top color band */}
      <div style={{ height: '8px', background: profile.trainer_card_color }} />

      {/* Main content */}
      <div style={{ padding: cfg.padding }}>
        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
          {/* Left column: trainer sprite + starter */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {/* Trainer sprite */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trainerSpriteUrl}
              alt={formatTrainerClass(profile.trainer_class)}
              width={cfg.spriteSize}
              height={cfg.spriteSize}
              style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
            />
            {/* Starter sprite — only render if ID is known */}
            {starterSpriteUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={starterSpriteUrl}
                alt={starterKey}
                width={48}
                height={48}
                style={{ objectFit: 'contain' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
          </div>

          {/* Right column: info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Display name */}
            <p style={{
              margin: '0 0 0.2rem',
              fontFamily: 'var(--font-pixel)',
              fontSize: cfg.cardTitleSize,
              color: 'var(--pk-text)',
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {profile.display_name || profile.username}
            </p>

            {/* Trainer ID */}
            {profile.trainer_id && (
              <p style={{
                margin: '0 0 0.375rem',
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.38rem',
                color: 'var(--pk-text-muted)',
                letterSpacing: '0.1em',
              }}>
                #{profile.trainer_id}
              </p>
            )}

            {/* Title badge */}
            {profile.trainer_title && (
              <span style={{
                display: 'inline-block',
                padding: '0.2rem 0.5rem',
                borderRadius: '999px',
                background: `${profile.trainer_card_color}22`,
                border: `1px solid ${profile.trainer_card_color}66`,
                fontFamily: 'var(--font-pixel)',
                fontSize: cfg.tagSize,
                color: profile.trainer_card_color,
                letterSpacing: '0.08em',
                marginBottom: '0.5rem',
                whiteSpace: 'nowrap',
              }}>
                {profile.trainer_title.toUpperCase()}
              </span>
            )}

            {/* Hometown + type */}
            <p style={{
              margin: 0,
              fontSize: '0.68rem',
              color: 'var(--pk-text-muted)',
              lineHeight: 1.5,
            }}>
              {[profile.hometown, profile.favorite_type].filter(Boolean).join(' • ')}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {showStats && (
        <>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '0' }} />
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            padding: `0.625rem ${cfg.padding}`,
          }}>
            <StatCell label="WINS" value={wins ?? 0} color="#78C850" />
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.07)' }} />
            <StatCell label="LOSSES" value={losses ?? 0} color="#EF4444" />
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.07)' }} />
            <StatCell label="WIN%" value={winRate !== undefined ? `${winRate.toFixed(1)}%` : '—'} color="#F8D030" />
          </div>
        </>
      )}
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <p style={{ margin: '0 0 0.2rem', fontFamily: 'var(--font-pixel)', fontSize: '0.35rem', color: 'var(--pk-text-muted)', letterSpacing: '0.1em' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontFamily: 'var(--font-pixel)', fontSize: '0.6rem', color, letterSpacing: '0.06em' }}>
        {value}
      </p>
    </div>
  );
}
