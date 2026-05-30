'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type { Pokemon } from '@/types';

export interface ShowdownImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTeamImported: (teamNames: string[]) => void;
}

export function ShowdownImportModal({ isOpen, onClose, onTeamImported }: ShowdownImportModalProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Pokemon[]>([]);
  const [notFound, setNotFound] = useState<string[]>([]);
  const [hasResult, setHasResult] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Reset state when modal opens */
  useEffect(() => {
    if (isOpen) {
      setText('');
      setError(null);
      setFound([]);
      setNotFound([]);
      setHasResult(false);
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 60);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen]);

  /* Close on Escape */
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  async function handleImport() {
    if (!text.trim()) {
      setError('Paste a Pokémon Showdown team first.');
      return;
    }
    setLoading(true);
    setError(null);
    setHasResult(false);
    try {
      const result = await api.importTeam(text.trim());
      setFound(result.found);
      setNotFound(result.not_found);
      setHasResult(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  function handleUseTeam() {
    onTeamImported(found.map((p) => p.name));
    onClose();
  }

  if (!isOpen) return null;

  return (
    /* Overlay */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import from Showdown"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal card */}
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          background: '#0d1120',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '0.875rem',
          boxShadow: '0 0 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(0,0,0,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }} aria-hidden="true">📥</span>
            <span style={{
              fontSize: '0.5rem',
              fontFamily: 'var(--font-pixel)',
              color: 'var(--pk-text)',
              letterSpacing: '0.1em',
            }}>
              IMPORT FROM SHOWDOWN
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.75rem',
              height: '1.75rem',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '0.35rem',
              color: 'var(--pk-text-muted)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              transition: 'all 0.15s ease',
              fontFamily: 'var(--font-body)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.4)';
              (e.currentTarget as HTMLButtonElement).style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--pk-text-muted)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem' }}>

          {/* Instruction label */}
          <p style={{
            margin: '0 0 0.6rem',
            fontSize: '0.72rem',
            color: 'var(--pk-text-muted)',
            lineHeight: 1.5,
          }}>
            Paste your Pokémon Showdown team below:
          </p>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Pikachu @ Light Ball\nAbility: Static\nEVs: 252 SpA / 4 SpD / 252 Spe\n...'}
            rows={8}
            spellCheck={false}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical',
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              color: 'var(--pk-text)',
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              lineHeight: 1.6,
              outline: 'none',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'rgba(120,200,80,0.45)'; }}
            onBlur={(e) => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
          />

          {/* Error */}
          {error && (
            <div role="alert" style={{
              marginTop: '0.75rem',
              padding: '0.5rem 0.75rem',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: '0.4rem',
              fontSize: '0.7rem',
              color: '#EF4444',
            }}>
              <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '0.45rem', letterSpacing: '0.06em', marginRight: '0.4rem' }}>⚠ ERROR:</span>
              {error}
            </div>
          )}

          {/* Import button */}
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => { void handleImport(); }}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: loading ? 'rgba(255,255,255,0.04)' : 'rgba(120,200,80,0.12)',
                border: '2px solid rgba(120,200,80,0.5)',
                borderRadius: '0.5rem',
                color: '#78C850',
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.5rem',
                letterSpacing: '0.08em',
                padding: '0.625rem 1.25rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.55 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              {loading ? (
                <>
                  <span style={{ display: 'inline-block', width: '0.75rem', height: '0.75rem', border: '2px solid rgba(120,200,80,0.3)', borderTopColor: '#78C850', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} aria-hidden="true" />
                  IMPORTING...
                </>
              ) : (
                <>📥 IMPORT TEAM</>
              )}
            </button>
          </div>

          {/* Results */}
          {hasResult && (
            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

              {/* Found */}
              {found.length > 0 && (
                <div>
                  <p style={{
                    margin: '0 0 0.4rem',
                    fontSize: '0.45rem',
                    fontFamily: 'var(--font-pixel)',
                    color: '#78C850',
                    letterSpacing: '0.08em',
                  }}>
                    ✓ FOUND ({found.length}):
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {found.map((p) => (
                      <span key={p.pokemon_id} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.2rem 0.55rem',
                        background: 'rgba(120,200,80,0.1)',
                        border: '1px solid rgba(120,200,80,0.4)',
                        borderRadius: '0.3rem',
                        fontSize: '0.7rem',
                        color: '#78C850',
                        textTransform: 'capitalize',
                        fontFamily: 'var(--font-body)',
                      }}>
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Not found */}
              {notFound.length > 0 && (
                <div>
                  <p style={{
                    margin: '0 0 0.4rem',
                    fontSize: '0.45rem',
                    fontFamily: 'var(--font-pixel)',
                    color: '#EF4444',
                    letterSpacing: '0.08em',
                  }}>
                    ✗ NOT FOUND:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {notFound.map((name) => (
                      <span key={name} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.2rem 0.55rem',
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.35)',
                        borderRadius: '0.3rem',
                        fontSize: '0.7rem',
                        color: '#EF4444',
                        textTransform: 'capitalize',
                        fontFamily: 'var(--font-body)',
                      }}>
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty result */}
              {found.length === 0 && notFound.length === 0 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--pk-text-muted)' }}>
                  No Pokémon detected in the pasted text.
                </p>
              )}

              {/* Use this team CTA */}
              {found.length > 0 && (
                <button
                  type="button"
                  onClick={handleUseTeam}
                  style={{
                    alignSelf: 'flex-start',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'linear-gradient(135deg, rgba(120,200,80,0.2), rgba(120,200,80,0.12))',
                    border: '2px solid #78C850',
                    borderRadius: '0.5rem',
                    color: '#78C850',
                    fontFamily: 'var(--font-pixel)',
                    fontSize: '0.5rem',
                    letterSpacing: '0.08em',
                    padding: '0.625rem 1.5rem',
                    cursor: 'pointer',
                    boxShadow: '0 0 14px rgba(120,200,80,0.25)',
                    transition: 'all 0.15s ease',
                    marginTop: '0.25rem',
                  }}
                >
                  ✓ USE THIS TEAM
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
