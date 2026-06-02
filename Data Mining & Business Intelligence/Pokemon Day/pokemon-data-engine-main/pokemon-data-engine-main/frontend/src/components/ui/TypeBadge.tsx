'use client';

import React from 'react';

/* Exact Pokémon game type colours */
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  normal:   { bg: '#A8A878', text: '#111' },
  fire:     { bg: '#F08030', text: '#fff' },
  water:    { bg: '#6890F0', text: '#fff' },
  grass:    { bg: '#78C850', text: '#111' },
  electric: { bg: '#F8D030', text: '#111' },
  ice:      { bg: '#98D8D8', text: '#111' },
  fighting: { bg: '#C03028', text: '#fff' },
  poison:   { bg: '#A040A0', text: '#fff' },
  ground:   { bg: '#E0C068', text: '#111' },
  flying:   { bg: '#A890F0', text: '#fff' },
  psychic:  { bg: '#F85888', text: '#fff' },
  bug:      { bg: '#A8B820', text: '#fff' },
  rock:     { bg: '#B8A038', text: '#fff' },
  ghost:    { bg: '#705898', text: '#fff' },
  dragon:   { bg: '#7038F8', text: '#fff' },
  dark:     { bg: '#705848', text: '#fff' },
  steel:    { bg: '#B8B8D0', text: '#111' },
  fairy:    { bg: '#EE99AC', text: '#111' },
};

interface TypeBadgeProps {
  type: string;
  size?: 'sm' | 'md';
}

export function TypeBadge({ type, size = 'sm' }: TypeBadgeProps) {
  const normalized = type.toLowerCase();
  const colors = TYPE_COLORS[normalized] ?? { bg: '#A8A878', text: '#111' };
  const padClass = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`type-badge-shimmer inline-block rounded-full font-bold uppercase tracking-wider ${padClass}`}
      style={{
        background: colors.bg,
        color: colors.text,
        boxShadow: `0 0 8px ${colors.bg}55`,
        fontSize: size === 'md' ? '0.72rem' : '0.62rem',
        letterSpacing: '0.05em',
        fontFamily: 'var(--font-body)',
      }}
    >
      {type}
    </span>
  );
}
