'use client';

import React from 'react';
import { PokemonCard } from './PokemonCard';
import type { TeamSlot } from '@/types';

interface TeamGridProps {
  readonly team: TeamSlot[];
  readonly title?: string;
}

export function TeamGrid({ team, title }: TeamGridProps) {
  return (
    <div>
      {title && (
        <h3 style={{ fontSize: '0.65rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
          {title}
        </h3>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'clamp(0.75rem, 2vw, 1rem)' }}>
        {team.map((slot) => (
          <PokemonCard
            key={slot.slot}
            slot={slot.slot}
            name={slot.name}
            pokeapi_id={slot.pokeapi_id}
            type_1={slot.type_1}
            type_2={slot.type_2}
            role={slot.role}
            total_base_stats={slot.total_base_stats}
            usefulness_score={slot.usefulness_score}
            reason={slot.reason}
            loadout={slot.loadout}
          />
        ))}
      </div>
    </div>
  );
}
