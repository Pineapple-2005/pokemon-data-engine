'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

const NAV_ITEMS = [
  { href: '/',        icon: '⚡', label: 'HOME',    spriteId: 25  },
  { href: '/engine1', icon: '🏟', label: 'GYM',     spriteId: 6   },
  { href: '/engine2', icon: '🎯', label: 'COUNTER', spriteId: 131 },
  { href: '/engine3', icon: '⚔',  label: 'BATTLE',  spriteId: 150 },
  { href: '/pokemon', icon: '🔴', label: 'POKÉDEX', spriteId: 1   },
] as const;

export function MobileNav() {
  const pathname = usePathname();

  return (
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
      {NAV_ITEMS.map(({ href, label, spriteId }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              textDecoration: 'none',
              background: isActive ? 'rgba(239,68,68,0.1)' : 'transparent',
              borderTop: isActive ? '2px solid var(--pk-red)' : '2px solid transparent',
              marginTop: '-2px',
              padding: '4px 0 6px',
              transition: 'background 0.15s ease',
            }}
            aria-current={isActive ? 'page' : undefined}
          >
            {/* Pokemon sprite */}
            <img
              src={`${SPRITE_BASE}/${spriteId}.png`}
              alt=""
              loading="lazy"
              width={20}
              height={20}
              style={{
                imageRendering: 'pixelated',
                filter: isActive
                  ? 'drop-shadow(0 0 4px rgba(239,68,68,0.8))'
                  : 'brightness(0.5)',
                transition: 'filter 0.15s ease',
                flexShrink: 0,
              }}
            />
            {/* Pixel label */}
            <span
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: '0.3rem',
                letterSpacing: '0.03em',
                color: isActive ? 'var(--pk-red)' : 'rgba(255,255,255,0.3)',
                transition: 'color 0.15s ease',
                lineHeight: 1,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
