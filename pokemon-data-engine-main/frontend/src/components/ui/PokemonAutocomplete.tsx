'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePokemonSearch } from '@/hooks/usePokemonSearch';
import { TypeBadge } from '@/components/ui/TypeBadge';
import type { Pokemon } from '@/types';

const SPRITE_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

export interface PokemonAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (pokemon: Pokemon) => void;
  placeholder?: string;
  label?: string;
  id?: string;
  disabled?: boolean;
}

export function PokemonAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'e.g. pikachu',
  label,
  id,
  disabled = false,
}: PokemonAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, loading } = usePokemonSearch(value);

  const showDropdown = open && (results.length > 0 || (value.trim().length >= 2 && !loading));
  const showNoResults = open && !loading && results.length === 0 && value.trim().length >= 2;

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  // Click-outside close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
    setOpen(true);
  }

  function handleFocus() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setOpen(true);
  }

  function handleBlur() {
    // Delay close so mousedown on a row fires first
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      setHighlightedIndex(-1);
    }, 150);
  }

  const handleSelect = useCallback(
    (pokemon: Pokemon) => {
      onChange(pokemon.name);
      onSelect?.(pokemon);
      setOpen(false);
      setHighlightedIndex(-1);
    },
    [onChange, onSelect],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown && !showNoResults) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && results[highlightedIndex]) {
        e.preventDefault();
        handleSelect(results[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlightedIndex(-1);
    }
  }

  const inputId = id ?? `pk-autocomplete-${Math.random().toString(36).slice(2, 7)}`;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            display: 'block',
            marginBottom: '0.3rem',
            fontSize: '0.4rem',
            fontFamily: 'var(--font-pixel)',
            color: 'var(--pk-text-muted)',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </label>
      )}

      {/* Input wrapper — allows trailing spinner */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="pk-input"
          style={{ fontSize: '16px', width: '100%', paddingRight: loading ? '2.25rem' : undefined }}
          aria-autocomplete="list"
          aria-expanded={showDropdown || showNoResults}
          aria-haspopup="listbox"
          role="combobox"
          aria-controls={`${inputId}-listbox`}
          aria-activedescendant={
            highlightedIndex >= 0 ? `${inputId}-option-${highlightedIndex}` : undefined
          }
        />

        {/* Loading spinner */}
        {loading && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: '0.625rem',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.12)',
              borderTopColor: 'var(--pk-red)',
              animation: 'pk-spin 0.65s linear infinite',
            }}
          />
        )}
      </div>

      {/* Dropdown */}
      {(showDropdown || showNoResults) && (
        <div
          id={`${inputId}-listbox`}
          role="listbox"
          aria-label={label ? `${label} suggestions` : 'Pokemon suggestions'}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            marginTop: '2px',
            background: '#0d1120',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '0.5rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            maxHeight: '280px',
            overflowY: 'auto',
          }}
        >
          {showNoResults && (
            <div
              style={{
                padding: '0.6rem 0.75rem',
                fontSize: '0.75rem',
                color: 'var(--pk-text-muted)',
                fontFamily: 'var(--font-body)',
              }}
            >
              No Pokemon found
            </div>
          )}

          {results.map((pokemon, idx) => {
            const isHighlighted = idx === highlightedIndex;
            return (
              <div
                key={pokemon.pokemon_id}
                id={`${inputId}-option-${idx}`}
                role="option"
                aria-selected={isHighlighted}
                onMouseDown={() => {
                  // Cancel the blur-close timer so blur doesn't win
                  if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
                  handleSelect(pokemon);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.4rem 0.75rem',
                  cursor: 'pointer',
                  background: isHighlighted ? 'rgba(255,255,255,0.06)' : 'transparent',
                  transition: 'background 0.1s ease',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${SPRITE_BASE}/${pokemon.pokeapi_id}.png`}
                  alt=""
                  aria-hidden="true"
                  width={32}
                  height={32}
                  style={{ imageRendering: 'pixelated', flexShrink: 0 }}
                />
                <span
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--pk-text)',
                    textTransform: 'capitalize',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {pokemon.name}
                </span>
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  <TypeBadge type={pokemon.type_1} size="sm" />
                  {pokemon.type_2 && <TypeBadge type={pokemon.type_2} size="sm" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
