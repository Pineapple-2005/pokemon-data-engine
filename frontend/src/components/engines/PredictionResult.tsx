'use client';

import React from 'react';
import { ConfidenceBar } from '@/components/ui/ConfidenceBar';
import type { Engine3Response } from '@/types';

interface PredictionResultProps {
  readonly result: Engine3Response;
  readonly battlerA: string;
}

export function PredictionResult({ result, battlerA }: PredictionResultProps) {
  const confidencePct = result.confidence > 1 ? result.confidence : result.confidence * 100;
  const isA = result.predicted_winner === battlerA;
  const isLegendary = confidencePct >= 80;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Winner banner */}
      <div
        className={isLegendary ? 'holo-card' : ''}
        style={{
          borderRadius: '1rem',
          border: `2px solid ${isA ? 'rgba(239,68,68,0.6)' : 'rgba(104,144,240,0.6)'}`,
          background: isA
            ? 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(185,28,28,0.08))'
            : 'linear-gradient(135deg, rgba(104,144,240,0.15), rgba(59,130,246,0.08))',
          padding: 'clamp(1.25rem, 3vw, 2rem)',
          textAlign: 'center',
          boxShadow: `0 0 32px ${isA ? 'rgba(239,68,68,0.25)' : 'rgba(104,144,240,0.25)'}`,
          position: 'relative',
        }}
      >
        {isLegendary && (
          <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', fontSize: '0.6rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-gold)', textShadow: '0 0 8px var(--pk-gold-glow)', letterSpacing: '0.05em' }}>
            LEGENDARY
          </div>
        )}
        <p style={{ fontSize: '0.6rem', fontFamily: 'var(--font-pixel)', letterSpacing: '0.1em', color: 'var(--pk-text-muted)', marginBottom: '0.5rem' }}>
          PREDICTED WINNER
        </p>
        <h2
          style={{
            fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
            fontWeight: 900,
            fontFamily: 'var(--font-body)',
            color: isA ? '#FCA5A5' : '#93C5FD',
            textShadow: `0 0 20px ${isA ? 'rgba(239,68,68,0.6)' : 'rgba(104,144,240,0.6)'}`,
            margin: '0 0 1rem',
            textTransform: 'capitalize',
          }}
        >
          {result.predicted_winner}
        </h2>
        <div style={{ maxWidth: '300px', margin: '0 auto 1rem' }}>
          <ConfidenceBar
            value={result.confidence}
            label="Confidence"
            height="lg"
            color={isA ? 'red' : 'blue'}
          />
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--pk-text-muted)', maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>
          {result.reason}
        </p>
      </div>

    </div>
  );
}
