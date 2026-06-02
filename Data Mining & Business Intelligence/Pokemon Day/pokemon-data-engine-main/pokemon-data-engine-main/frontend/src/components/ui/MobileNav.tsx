'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredUser, clearUser } from '@/lib/auth';

const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

// ── Primary bar — 5 items + MORE button ──────────────────────────────────────
const NAV_PRIMARY = [
  { href: '/',         label: 'HOME',    spriteId: 25  },
  { href: '/engine1',  label: 'GYM',     spriteId: 6   },
  { href: '/engine2',  label: 'COUNTER', spriteId: 131 },
  { href: '/engine3',  label: 'BATTLE',  spriteId: 150 },
  { href: '/pokemon',  label: 'POKÉDEX', spriteId: 1   },
] as const;

// ── Full sheet — all 13 pages ─────────────────────────────────────────────────
const NAV_ALL = [
  { href: '/',          label: 'DASHBOARD',   spriteId: 25  },
  { href: '/pokemon',   label: 'POKÉMON DB',  spriteId: 1   },
  { href: '/engine1',   label: 'GYM TEAM',    spriteId: 6   },
  { href: '/engine2',   label: 'COUNTER',     spriteId: 131 },
  { href: '/engine3',   label: 'BATTLE',      spriteId: 150 },
  { href: '/history',   label: 'HISTORY',     spriteId: 143 },
  { href: '/metrics',   label: 'METRICS',     spriteId: 137 },
  { href: '/archive',   label: 'ARCHIVE',     spriteId: 52  },
  { href: '/engine5',   label: 'COMMENTATOR', spriteId: 54  },
  { href: '/engine6',   label: 'POKÉDEX AI',  spriteId: 10  },
  { href: '/engine7',   label: 'EXPORTER',    spriteId: 132 },
  { href: '/engine9',   label: 'SCANNER',     spriteId: 81  },
  { href: '/engine10',  label: 'REPLAY',      spriteId: 54  },
] as const;

// ── Shared tab styles ─────────────────────────────────────────────────────────
function tabStyle(isActive: boolean): React.CSSProperties {
  return {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    textDecoration: 'none',
    border: 'none',
    borderTop: isActive ? '2px solid var(--pk-red)' : '2px solid transparent',
    background: isActive ? 'rgba(239,68,68,0.1)' : 'transparent',
    marginTop: '-2px',
    padding: '4px 0 6px',
    transition: 'background 0.15s ease',
    cursor: 'pointer',
  };
}

function spriteStyle(isActive: boolean): React.CSSProperties {
  return {
    imageRendering: 'pixelated',
    filter: isActive
      ? 'drop-shadow(0 0 4px rgba(239,68,68,0.8))'
      : 'brightness(0.5)',
    transition: 'filter 0.15s ease',
    flexShrink: 0,
  };
}

function labelStyle(isActive: boolean): React.CSSProperties {
  return {
    fontFamily: 'var(--font-pixel)',
    fontSize: '0.3rem',
    letterSpacing: '0.03em',
    color: isActive ? 'var(--pk-red)' : 'rgba(255,255,255,0.3)',
    transition: 'color 0.15s ease',
    lineHeight: 1,
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
  };
}

// ── Sheet item style ──────────────────────────────────────────────────────────
function sheetItemStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '5px',
    padding: '0.625rem 0.25rem',
    borderRadius: '0.5rem',
    background: isActive ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
    border: isActive ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.07)',
    textDecoration: 'none',
    transition: 'background 0.15s ease',
    cursor: 'pointer',
  };
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [trainerName, setTrainerName] = useState<string | null>(null);

  // Close sheet on navigation
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  // Sync auth state — re-read on every pathname change so login/logout reflects immediately
  useEffect(() => {
    const user = getStoredUser();
    setTrainerName(user ? (user.display_name ?? user.username) : null);
  }, [pathname]);

  function handleLogout() {
    clearUser();
    setTrainerName(null);
    setSheetOpen(false);
    router.replace('/login');
  }

  if (pathname === '/login') return null;

  return (
    <>
      {/* ── Bottom fixed bar ─────────────────────────────────────── */}
      <nav
        className="mobile-nav-bar"
        aria-label="Mobile navigation"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '64px',
          zIndex: 9000,
          background: 'linear-gradient(180deg, #0a0e1a, #060810)',
          borderTop: '2px solid #B71C1C',
          display: 'none', /* overridden to flex by CSS media query */
          alignItems: 'stretch',
        }}
      >
        {NAV_PRIMARY.map(({ href, label, spriteId }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              style={tabStyle(isActive)}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Pokemon sprite */}
              <img
                src={`${SPRITE_BASE}/${spriteId}.png`}
                alt=""
                loading="lazy"
                width={20}
                height={20}
                style={spriteStyle(isActive)}
              />
              <span style={labelStyle(isActive)}>{label}</span>
            </Link>
          );
        })}

        {/* MORE button */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="Show all navigation pages"
          aria-expanded={sheetOpen}
          aria-haspopup="dialog"
          style={{
            ...tabStyle(false),
            background: 'transparent',
            outline: 'none',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: '0.7rem',
              color: 'rgba(255,255,255,0.4)',
              lineHeight: 1,
              letterSpacing: '0.05em',
            }}
          >
            ···
          </span>
          <span
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: '0.3rem',
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.03em',
              lineHeight: 1,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            MORE
          </span>
        </button>
      </nav>

      {/* ── Full-screen sheet overlay ─────────────────────────────── */}
      {/*
        S6819: Use <dialog> instead of role="dialog" div.
        The CSS classes (pk-nav-sheet / pk-nav-sheet.open) are kept on the
        wrapper so the existing open/close transition still works — <dialog>
        itself is unstyled and positioned absolute inside the wrapper.
      */}
      <div
        className={`pk-nav-sheet${sheetOpen ? ' open' : ''}`}
        aria-hidden={sheetOpen ? undefined : true}
      >
        {/* Backdrop */}
        <div
          className="pk-nav-sheet-backdrop"
          onClick={() => setSheetOpen(false)}
          aria-hidden="true"
        />

        {/* Sheet panel — semantic <dialog> element */}
        <dialog
          open={sheetOpen}
          aria-label="All navigation pages"
          className="pk-nav-sheet-panel"
          style={{ position: 'relative', zIndex: 1, border: 'none', padding: 0, background: 'none', width: '100%', maxWidth: '100%', margin: 0 }}
        >
          {/* ── Auth row ──────────────────────────────────────── */}
          <div className="pk-nav-sheet-auth-row">
            {trainerName !== null ? (
              <>
                <span className="pk-nav-sheet-trainer-name">
                  ▶ {trainerName.toUpperCase().slice(0, 14)}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="pk-nav-sheet-auth-btn pk-nav-sheet-auth-btn--logout"
                >
                  LOG OUT
                </button>
              </>
            ) : (
              <>
                <span className="pk-nav-sheet-trainer-name pk-nav-sheet-trainer-name--guest">
                  ○ NOT LOGGED IN
                </span>
                <Link
                  href="/login"
                  className="pk-nav-sheet-auth-btn pk-nav-sheet-auth-btn--login"
                  onClick={() => setSheetOpen(false)}
                >
                  LOG IN
                </Link>
              </>
            )}
          </div>

          {/* Title row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.875rem',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.45rem',
                color: 'var(--pk-red)',
                letterSpacing: '0.1em',
              }}
            >
              ALL PAGES
            </span>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="Close navigation sheet"
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '0.375rem',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.45rem',
                padding: '0.3rem 0.5rem',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              X
            </button>
          </div>

          {/* 3-column grid of all pages */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.5rem',
            }}
          >
            {NAV_ALL.map(({ href, label, spriteId }) => {
              const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  key={`${href}-${label}`}
                  href={href}
                  style={sheetItemStyle(isActive)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <img
                    src={`${SPRITE_BASE}/${spriteId}.png`}
                    alt=""
                    loading="lazy"
                    width={24}
                    height={24}
                    style={{
                      imageRendering: 'pixelated',
                      filter: isActive
                        ? 'drop-shadow(0 0 4px rgba(239,68,68,0.8))'
                        : 'brightness(0.6)',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-pixel)',
                      fontSize: '0.3rem',
                      color: isActive ? 'var(--pk-red)' : 'rgba(255,255,255,0.4)',
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.2,
                      textAlign: 'center',
                    }}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </dialog>
      </div>
    </>
  );
}
