'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { GuideModal } from './GuideModal';
import { getStoredUser, clearUser, getTrainerProfile } from '@/lib/auth';
import type { TrainerProfile } from '@/types';

/* Each entry gets a Pokédex number and Pokémon sprite for visual authenticity */
const NAV_ITEMS = [
  { href: '/',          label: 'Dashboard',       number: '01', spriteId: 25  }, // Pikachu
  { href: '/pokemon',   label: 'Pokémon DB',       number: '02', spriteId: 1   }, // Bulbasaur
  { href: '/engine1',   label: 'Gym Team Builder', number: '03', spriteId: 6   }, // Charizard
  { href: '/engine2',   label: 'Counter Pick',     number: '04', spriteId: 131 }, // Lapras
  { href: '/engine3',   label: 'Battle Predictor', number: '05', spriteId: 150 }, // Mewtwo
  { href: '/history',   label: 'Battle History',   number: '06', spriteId: 143 }, // Snorlax
  { href: '/metrics',   label: 'Model Metrics',    number: '07', spriteId: 137 }, // Porygon
  { href: '/archive',   label: 'The Archive',      number: '08', spriteId: 52  }, // Meowth
  { href: '/engine5',   label: 'Commentator',      number: '09', spriteId: 54  }, // Psyduck
  { href: '/engine6',   label: 'Pokedex AI',       number: '10', spriteId: 10  }, // Caterpie (Oak's lab)
  { href: '/engine7',   label: 'Exporter',         number: '11', spriteId: 132 }, // Ditto
  { href: '/engine9',   label: 'Team Scanner',     number: '12', spriteId: 81  }, // Magnemite
  { href: '/engine10',  label: 'Replay Viewer',    number: '13', spriteId: 54  }, // Psyduck
];

const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [trainerProfile, setTrainerProfile] = useState<TrainerProfile | null>(null);

  useEffect(() => {
    setUsername(getStoredUser()?.username ?? null);
    setTrainerProfile(getTrainerProfile());
  }, [pathname]);

  function handleLogout() {
    clearUser();
    router.replace('/login');
  }

  if (pathname === '/login') return null;

  return (
    <nav
      className="pokedex-sidebar"
      style={{
        width: collapsed ? '64px' : '230px',
        minWidth: collapsed ? '64px' : '230px',
        height: '100dvh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        /* Red Pokédex outer frame gradient */
        background: 'linear-gradient(180deg, #8B0000 0%, #6B0000 4%, #0f1420 8%, #0a0e1a 100%)',
        transition: 'width 0.25s ease, min-width 0.25s ease',
        zIndex: 40,
        flexShrink: 0,
        overflow: 'hidden',
      }}
      aria-label="Main navigation"
    >
      {/* Pokédex top red bar with lights */}
      <div
        aria-hidden="true"
        style={{
          flexShrink: 0,
          height: '36px',
          background: 'linear-gradient(180deg, #CC0000, #8B0000)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 0.75rem',
          borderBottom: '2px solid #4a0000',
        }}
      >
        {/* Big blue indicator light */}
        <div style={{
          width: '16px', height: '16px', borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #88ccff, #2266cc)',
          boxShadow: '0 0 6px #4488ff, 0 0 12px rgba(68,136,255,0.5)',
          flexShrink: 0,
          border: '1px solid #1144aa',
        }} />
        {/* Small indicator lights */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: '2px' }}>
          {['#ff4444', '#ffcc00', '#44ff44'].map((c) => (
            <div key={c} style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: c,
              boxShadow: `0 0 4px ${c}88`,
            }} />
          ))}
        </div>
        {!collapsed && (
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-pixel)',
            fontSize: '0.38rem',
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
          }}>
            POKÉDEX
          </span>
        )}
      </div>

      {/* Logo / title area — the "inner screen" bezel */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.875rem 0.875rem 0.75rem',
        borderBottom: '1px solid rgba(239,68,68,0.15)',
        flexShrink: 0,
        background: 'rgba(0,0,0,0.3)',
      }}>
        {/* Mini Pokéball SVG */}
        <svg width="26" height="26" viewBox="0 0 40 40" style={{ flexShrink: 0 }} aria-hidden="true">
          <circle cx="20" cy="20" r="18" fill="none" stroke="#333" strokeWidth="2" />
          <path d="M2 20 A18 18 0 0 1 38 20" fill="#DC2626" />
          <path d="M38 20 A18 18 0 0 1 2 20" fill="#F8FAFC" />
          <line x1="2" y1="20" x2="38" y2="20" stroke="#111" strokeWidth="2.5" />
          <circle cx="20" cy="20" r="5" fill="#111" />
          <circle cx="20" cy="20" r="2.8" fill="#F8FAFC" />
        </svg>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <p style={{ margin: 0, fontSize: '0.58rem', fontFamily: 'var(--font-pixel)', color: '#fff', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
              Pokémon
            </p>
            <p style={{ margin: 0, fontSize: '0.46rem', fontFamily: 'var(--font-pixel)', color: 'var(--pk-text-muted)', lineHeight: 1.3, whiteSpace: 'nowrap' }}>
              Data Engine
            </p>
          </div>
        )}
      </div>

      {/* ── Pokédex list entries ─────────────────────────── */}
      <ul style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
        padding: '0.5rem 0.375rem',
        margin: 0,
        listStyle: 'none',
        overflowY: 'auto',
      }}>
        {NAV_ITEMS.map(({ href, label, number, spriteId }) => {
          const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? label : undefined}
                className={active ? 'nav-link-item nav-item-active' : 'nav-link-item'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 0.5rem',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  transition: 'background 0.15s ease, box-shadow 0.15s ease',
                  background: active ? '#2a0f0f' : 'transparent',
                  border: active ? '1px solid rgba(239,68,68,0.4)' : '1px solid transparent',
                  boxShadow: active ? '0 0 16px rgba(239,68,68,0.25)' : 'none',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Blinking ▶ cursor on active item (Pokédex selection indicator) */}
                {active && !collapsed && (
                  <span className="nav-entry-cursor" aria-hidden="true">▶</span>
                )}

                {/* Pokédex entry number — #01, #02 */}
                {!collapsed && !active && (
                  <span className="nav-entry-number">#{number}</span>
                )}

                {/* Pokémon sprite */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${SPRITE_BASE}/${spriteId}.png`}
                  alt=""
                  width={active ? 28 : 24}
                  height={active ? 28 : 24}
                  style={{
                    imageRendering: 'pixelated',
                    flexShrink: 0,
                    filter: active
                      ? 'drop-shadow(0 0 4px rgba(239,68,68,0.8))'
                      : 'brightness(0.65)',
                    transition: 'all 0.2s ease',
                  }}
                  loading="lazy"
                />

                {!collapsed && (
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontFamily: 'var(--font-body)',
                    transition: 'color 0.15s ease',
                    flex: 1,
                  }}>
                    {label}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* ── Pokédex hinge / collapse toggle ─────────────────── */}
      <div style={{
        padding: '0.625rem 0.375rem',
        borderTop: '2px solid #4a0000',
        background: 'linear-gradient(180deg, #0a0e1a, #060810)',
        flexShrink: 0,
      }}>
        {/* Hinge decoration */}
        {!collapsed && (
          <div
            aria-hidden="true"
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                width: '20px', height: '4px',
                background: '#1a2235',
                borderRadius: '2px',
                border: '1px solid rgba(255,255,255,0.06)',
              }} />
            ))}
          </div>
        )}

        {/* ── Trainer info + logout / login ───────────────── */}
        {username ? (
          <div style={{ marginBottom: '0.5rem' }}>
            {collapsed ? (
              /* Collapsed: just a logout icon */
              <button
                onClick={handleLogout}
                aria-label="Log out"
                title={`Log out (${username})`}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.45rem',
                  borderRadius: '0.375rem',
                  background: 'rgba(139,0,0,0.2)',
                  border: '1px solid rgba(185,0,0,0.3)',
                  color: 'rgba(239,68,68,0.7)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                className="nav-collapse-btn"
              >
                <span aria-hidden="true">⏏</span>
              </button>
            ) : (
              /* Expanded: mini trainer card row + LOG OUT */
              <div style={{
                padding: '0.5rem 0.625rem',
                borderRadius: '0.375rem',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                {/* Profile button — mini trainer card row */}
                <button
                  onClick={() => router.push('/profile')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0 0 0.375rem',
                    textAlign: 'left',
                  }}
                  aria-label={`View profile for ${username}`}
                >
                  {trainerProfile?.trainer_class ? (
                    /* Trainer sprite when profile is loaded */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://play.pokemonshowdown.com/sprites/trainers/${trainerProfile.trainer_class}.png`}
                      alt=""
                      width={28}
                      height={28}
                      style={{ imageRendering: 'pixelated', objectFit: 'contain', flexShrink: 0 }}
                    />
                  ) : (
                    /* Fallback icon for old sessions */
                    <span style={{ fontSize: '0.65rem', flexShrink: 0 }} aria-hidden="true">👤</span>
                  )}

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{
                      margin: 0,
                      fontFamily: 'var(--font-pixel)',
                      fontSize: '0.46rem',
                      color: 'var(--pk-gold)',
                      letterSpacing: '0.06em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {trainerProfile?.display_name ?? username}
                    </p>

                    {/* Title badge */}
                    {trainerProfile?.trainer_title && (
                      <span style={{
                        display: 'inline-block',
                        marginTop: '0.2rem',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '999px',
                        background: `${trainerProfile.trainer_card_color ?? '#EF4444'}22`,
                        border: `1px solid ${trainerProfile.trainer_card_color ?? '#EF4444'}55`,
                        fontFamily: 'var(--font-pixel)',
                        fontSize: '0.32rem',
                        color: trainerProfile.trainer_card_color ?? '#EF4444',
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                      }}>
                        {trainerProfile.trainer_title.toUpperCase()}
                      </span>
                    )}
                  </div>
                </button>

                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    background: 'rgba(139,0,0,0.25)',
                    border: '1px solid rgba(185,0,0,0.4)',
                    borderRadius: '0.25rem',
                    color: 'rgba(239,68,68,0.8)',
                    fontFamily: 'var(--font-pixel)',
                    fontSize: '0.4rem',
                    letterSpacing: '0.1em',
                    cursor: 'pointer',
                    padding: '0.3rem 0.5rem',
                    transition: 'background 0.15s ease, color 0.15s ease',
                    textAlign: 'center',
                  }}
                  className="nav-collapse-btn"
                >
                  ⏏ LOG OUT
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Not logged in — show LOGIN / SIGN UP button */
          <div style={{ marginBottom: '0.5rem' }}>
            {collapsed ? (
              <Link
                href="/login"
                aria-label="Login or Sign Up"
                title="Login / Sign Up"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.45rem',
                  borderRadius: '0.375rem',
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: 'var(--pk-red)',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                  transition: 'background 0.15s ease',
                }}
              >
                <span aria-hidden="true">▶</span>
              </Link>
            ) : (
              <Link
                href="/login"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(185,0,0,0.15))',
                  border: '1px solid rgba(239,68,68,0.45)',
                  boxShadow: '0 0 12px rgba(239,68,68,0.15)',
                  color: '#fff',
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '0.44rem',
                  letterSpacing: '0.08em',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: '0.7rem' }}>▶</span>
                LOGIN / SIGN UP
              </Link>
            )}
          </div>
        )}

        {/* ── System Guide trigger ─────────────────────────── */}
        <GuideModal collapsed={collapsed} />

        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.45rem',
            borderRadius: '0.375rem',
            background: 'rgba(139,0,0,0.3)',
            border: '1px solid rgba(185,0,0,0.4)',
            color: 'var(--pk-text-muted)',
            fontSize: '0.72rem',
            cursor: 'pointer',
            transition: 'background 0.15s ease, color 0.15s ease',
            fontFamily: 'var(--font-body)',
          }}
          className="nav-collapse-btn"
        >
          <span aria-hidden="true" style={{ fontSize: '0.8rem' }}>
            {collapsed ? '→' : '←'}
          </span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </nav>
  );
}
