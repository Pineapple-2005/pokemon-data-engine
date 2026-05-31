'use client';

import React, { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/ui/AuthGuard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { api } from '@/lib/api';
import type { Pokemon } from '@/types';

const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const TEAM_SIZE_LIMIT = 4;

const PLACEHOLDER_MOVES = ['Body Slam', 'Earthquake', 'Ice Beam', 'Thunderbolt'];

function buildShowdownText(names: string[]): string {
  return names
    .map((name) => {
      const cap = name.charAt(0).toUpperCase() + name.slice(1);
      return [cap, ...PLACEHOLDER_MOVES.map((m) => `- ${m}`)].join('\n');
    })
    .join('\n\n');
}

export default function Engine7Page() {
  // Import panel state
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<{ found: Pokemon[]; not_found: string[] } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Export panel state
  const [pool, setPool] = useState<Array<Pokemon & { user_assigned: boolean }>>([]);
  const [poolLoading, setPoolLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exportText, setExportText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void api.getMyPool().then(setPool).catch(() => setPool([])).finally(() => setPoolLoading(false));
  }, []);

  async function handleImport() {
    if (!importText.trim()) return;
    setImportLoading(true);
    setImportError(null);
    try {
      const data = await api.importTeam(importText);
      setImportResult(data);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
    }
  }

  function toggleSelect(pokemonId: number, name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pokemonId)) {
        next.delete(pokemonId);
      } else if (next.size < TEAM_SIZE_LIMIT) {
        next.add(pokemonId);
      }
      return next;
    });
    setExportText('');
  }

  function handleGenerateExport() {
    const names = pool.filter((p) => selected.has(p.pokemon_id)).map((p) => p.name);
    setExportText(buildShowdownText(names));
  }

  async function handleCopy() {
    if (!exportText) return;
    try { await navigator.clipboard.writeText(exportText); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const panelStyle: React.CSSProperties = {
    background: '#0a0e1a',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '0.875rem',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  };

  return (
    <AuthGuard>
      <div className="pk-section">

        {/* Header */}
        <header style={{ marginBottom: 'clamp(1.25rem, 3vw, 1.75rem)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.55rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.12em' }}>
              ENGINE 07 | UTILITY
            </span>
            <span style={{
              fontSize: '0.42rem', fontFamily: 'var(--font-pixel)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.3rem',
              padding: '0.15rem 0.5rem', color: 'var(--pk-text-muted)', letterSpacing: '0.06em',
            }}>
              EXPORT STATION
            </span>
          </div>
          <h1 style={{ margin: '0 0 0.3rem', fontSize: 'clamp(1.3rem,3vw,2rem)', fontWeight: 900, color: 'var(--pk-text)' }}>
            The Exporter
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--pk-text-muted)' }}>
            Import and export Pokemon Showdown teams.
          </p>
        </header>

        {/* Two-panel layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>

          {/* IMPORT panel */}
          <div style={panelStyle}>
            <p style={{ margin: 0, fontSize: '0.52rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.1em' }}>
              ◆ IMPORT FROM SHOWDOWN
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"Pikachu\n- Thunderbolt\n- Quick Attack\n\nCharizard\n- Flamethrower\n..."}
              rows={8}
              className="pk-input"
              style={{ fontSize: '14px', resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.6 }}
            />
            <button
              type="button"
              onClick={() => { void handleImport(); }}
              disabled={!importText.trim() || importLoading}
              style={{
                padding: '0.625rem 1.25rem',
                background: importLoading || !importText.trim() ? 'rgba(255,255,255,0.04)' : 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: '0.5rem',
                color: 'var(--pk-red)',
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.52rem',
                letterSpacing: '0.08em',
                cursor: importLoading || !importText.trim() ? 'not-allowed' : 'pointer',
                opacity: !importText.trim() ? 0.45 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
            >
              {importLoading ? <><LoadingSpinner size="sm" /><span>PARSING...</span></> : 'PARSE TEAM'}
            </button>

            {importError && (
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#EF4444' }}>{importError}</p>
            )}

            {importResult && (
              <div>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.46rem', fontFamily: 'var(--font-pixel)', color: '#78C850', letterSpacing: '0.08em' }}>
                  MATCHED: {importResult.found.length} POKEMON
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {importResult.found.map((p) => (
                    <div key={p.pokemon_id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      background: 'rgba(120,200,80,0.07)', border: '1px solid rgba(120,200,80,0.2)',
                      borderRadius: '0.4rem', padding: '0.3rem 0.6rem',
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${SPRITE_BASE}/${p.pokeapi_id}.png`} alt={p.name} width={24} height={24}
                        style={{ imageRendering: 'pixelated' }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--pk-text)' }}>{p.name}</span>
                    </div>
                  ))}
                </div>
                {importResult.not_found.length > 0 && (
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem', color: '#EF4444' }}>
                    Not found: {importResult.not_found.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* EXPORT panel */}
          <div style={panelStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontSize: '0.52rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-red)', letterSpacing: '0.1em' }}>
                ◆ EXPORT TO SHOWDOWN
              </p>
              <span style={{
                fontSize: '0.42rem', fontFamily: 'var(--font-pixel)',
                color: selected.size === TEAM_SIZE_LIMIT ? '#F8D030' : 'var(--pk-text-muted)',
                letterSpacing: '0.06em',
              }}>
                {selected.size}/{TEAM_SIZE_LIMIT} SELECTED
              </span>
            </div>

            {poolLoading && <LoadingSpinner size="sm" />}

            {!poolLoading && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
                {pool.map((p) => {
                  const isSelected = selected.has(p.pokemon_id);
                  return (
                    <button
                      key={p.pokemon_id}
                      type="button"
                      onClick={() => toggleSelect(p.pokemon_id, p.name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.3rem 0.6rem',
                        background: isSelected ? 'rgba(239,68,68,0.12)' : 'rgba(0,0,0,0.3)',
                        border: isSelected ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '0.4rem',
                        cursor: !isSelected && selected.size >= TEAM_SIZE_LIMIT ? 'not-allowed' : 'pointer',
                        opacity: !isSelected && selected.size >= TEAM_SIZE_LIMIT ? 0.4 : 1,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${SPRITE_BASE}/${p.pokeapi_id}.png`} alt={p.name} width={20} height={20}
                        style={{ imageRendering: 'pixelated' }} />
                      <span style={{ fontSize: '0.72rem', color: isSelected ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                        {p.name}
                      </span>
                    </button>
                  );
                })}
                {pool.length === 0 && (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--pk-text-muted)' }}>
                    No Pokemon in your pool yet. Visit the Pokemon DB to add some.
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerateExport}
              disabled={selected.size === 0}
              style={{
                padding: '0.625rem 1.25rem',
                background: selected.size === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: '0.5rem',
                color: 'var(--pk-red)',
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.52rem',
                letterSpacing: '0.08em',
                cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
                opacity: selected.size === 0 ? 0.45 : 1,
              }}
            >
              GENERATE EXPORT
            </button>

            {exportText && (
              <>
                <textarea
                  readOnly
                  value={exportText}
                  rows={8}
                  className="pk-input"
                  style={{ fontSize: '13px', fontFamily: 'monospace', lineHeight: 1.6, resize: 'vertical', opacity: 0.85 }}
                />
                <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => { void handleCopy(); }}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'rgba(120,200,80,0.1)',
                        border: '1px solid rgba(120,200,80,0.35)',
                        borderRadius: '0.5rem',
                        color: '#78C850',
                        fontFamily: 'var(--font-pixel)',
                        fontSize: '0.46rem',
                        letterSpacing: '0.08em',
                        cursor: 'pointer',
                      }}
                    >
                      📋 COPY TO CLIPBOARD
                    </button>
                    {copied && (
                      <div style={{
                        position: 'absolute', bottom: 'calc(100% + 0.4rem)', left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#0d1120', border: '1px solid rgba(120,200,80,0.4)',
                        borderRadius: '0.3rem', padding: '0.2rem 0.5rem',
                        fontSize: '0.4rem', fontFamily: 'var(--font-pixel)', color: '#78C850',
                        whiteSpace: 'nowrap', pointerEvents: 'none',
                      }}>
                        COPIED!
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => window.open('https://play.pokemonshowdown.com/teambuilder', '_blank', 'noopener,noreferrer')}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '0.5rem',
                      color: 'var(--pk-text-muted)',
                      fontFamily: 'var(--font-pixel)',
                      fontSize: '0.46rem',
                      letterSpacing: '0.08em',
                      cursor: 'pointer',
                    }}
                  >
                    OPEN IN SHOWDOWN ↗
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
