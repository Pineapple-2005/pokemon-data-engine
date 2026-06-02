'use client';

import React, { useRef } from 'react';

/* Pure CSS particle field — zero JS lib dependency, respects prefers-reduced-motion */

const PARTICLE_COUNT = 20;

interface Particle {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
}

const COLORS = ['#EF4444', '#F8D030', '#6890F0', '#A890F0', '#78C850'];

function makeParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 3 + Math.random() * 5,
    duration: 12 + Math.random() * 18,
    delay: Math.random() * 20,
    color: COLORS[i % COLORS.length],
  }));
}

export function ParticleField() {
  const particlesRef = useRef<Particle[]>(makeParticles());
  const particles = particlesRef.current;

  return (
    <>
      <style>{`
        .pk-particle {
          position: fixed;
          border-radius: 50%;
          opacity: 0;
          pointer-events: none;
          z-index: 0;
          animation: falling-pokeball linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .pk-particle { animation: none !important; opacity: 0 !important; }
        }
      `}</style>
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {particles.map((p) => (
          <span
            key={p.id}
            className="pk-particle"
            style={{
              left: `${p.left}%`,
              top: '-10px',
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: p.color,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}66`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}
