'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

// ---------------------------------------------------------------------------
// Pokémon Gen 1–3 battle transition
//
// Phase 1 — ENTERING (covers screen so route change is invisible):
//   1. Pokéball iris CLOSE — clip-path circle grows 0% → 150% over ~420ms
//   2. Brief pause at full black — new page renders underneath
//
// Phase 2 — EXITING (reveals new page):
//   1. Pokéball iris OPEN  — clip-path circle shrinks 150% → 0% over ~380ms
//   2. CRT scan-line sweep — thin bright line top→bottom
//
// Key fix: iris element mounts one rAF tick BEFORE irisOpen flips to false,
// so the CSS transition actually has a starting keyframe to animate FROM.
// ---------------------------------------------------------------------------

type Phase = 'idle' | 'closing' | 'opening';

const IRIS_CLOSE_MS = 420;
const PAUSE_MS      = 80;
const IRIS_OPEN_MS  = 380;
const SCAN_MS       = 320;

export function BattleTransition({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname    = usePathname();
  const prevPathRef = useRef(pathname);

  const [phase, setPhase]       = useState<Phase>('idle');
  const [irisOpen, setIrisOpen] = useState(true);
  const [showScan, setShowScan] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef    = useRef<number | null>(null);

  function clearAll() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }

  function later(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  }

  useEffect(() => {
    if (pathname === prevPathRef.current) return;
    prevPathRef.current = pathname;

    clearAll();
    setIrisOpen(true);
    setShowScan(false);
    setPhase('idle');

    // ── Iris close — mount at circle(0%) invisible, then animate closed ─
    later(() => {
      setPhase('closing');
      // irisOpen stays TRUE here — element mounts at circle(0%) invisible
      // Step B: ONE animation frame later, flip to false → triggers CSS transition
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          setIrisOpen(false); // now circle(0%) → circle(150%) animates
        });
      });
    }, 10);

    // ── PAUSE at full black then reveal ───────────────────────────────
    const openAt = 10 + IRIS_CLOSE_MS + PAUSE_MS;

    // ── PHASE 3: Iris open (reveal) ────────────────────────────────────
    later(() => {
      setPhase('opening');
      setIrisOpen(true);   // circle(150%) → circle(0%) animates
      setShowScan(true);
    }, openAt);

    // ── Back to idle ───────────────────────────────────────────────────
    const idleAt = openAt + Math.max(IRIS_OPEN_MS, SCAN_MS) + 80;
    later(() => {
      setPhase('idle');
      setShowScan(false);
    }, idleAt);

    return clearAll;
  }, [pathname]);

  const overlayVisible = phase !== 'idle';

  return (
    <>
      {overlayVisible && (
        <div className="pk-transition-overlay" aria-hidden="true">

          {/* ── Pokéball iris (closing + opening) ───────────────── */}
          {(phase === 'closing' || phase === 'opening') && (
            <div
              className="pk-iris"
              style={{
                clipPath: irisOpen ? 'circle(0% at 50% 50%)' : 'circle(150% at 50% 50%)',
                transition: irisOpen
                  ? `clip-path ${IRIS_OPEN_MS}ms cubic-bezier(0.0, 0.0, 0.2, 1)`
                  : `clip-path ${IRIS_CLOSE_MS}ms cubic-bezier(0.4, 0.0, 1.0, 1)`,
              }}
            >
              {/* Pokéball equator stripe */}
              <div className="pk-iris-equator" />
            </div>
          )}

          {/* ── CRT scan-line sweep on reveal ───────────────────── */}
          {showScan && phase === 'opening' && (
            <div
              className="pk-scanline-sweep"
              style={{ animationDuration: `${SCAN_MS}ms` }}
            />
          )}
        </div>
      )}
      {children}
    </>
  );
}
