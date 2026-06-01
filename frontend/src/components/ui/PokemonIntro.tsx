'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Pokeball SVG helper ───────────────────────────────────────────────────────
function PokeballSVG({ size, opacity }: { size: number; opacity?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      style={{ opacity: opacity ?? 1, display: 'block' }}
    >
      <circle cx="20" cy="20" r="18" fill="none" stroke="#333" strokeWidth="2" />
      <path d="M2 20 A18 18 0 0 1 38 20" fill="#DC2626" />
      <path d="M38 20 A18 18 0 0 1 2 20" fill="#F8FAFC" />
      <line x1="2" y1="20" x2="38" y2="20" stroke="#111" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="5" fill="#111" />
      <circle cx="20" cy="20" r="2.8" fill="#F8FAFC" />
    </svg>
  );
}

// ── Static starfield ──────────────────────────────────────────────────────────
const STARS = [
  { left: '7%',  top: '12%', opacity: 0.25 },
  { left: '18%', top: '28%', opacity: 0.15 },
  { left: '31%', top: '8%',  opacity: 0.35 },
  { left: '44%', top: '19%', opacity: 0.20 },
  { left: '56%', top: '35%', opacity: 0.28 },
  { left: '63%', top: '11%', opacity: 0.18 },
  { left: '74%', top: '22%', opacity: 0.30 },
  { left: '83%', top: '5%',  opacity: 0.22 },
  { left: '91%', top: '31%', opacity: 0.16 },
  { left: '4%',  top: '48%', opacity: 0.20 },
  { left: '22%', top: '54%', opacity: 0.14 },
  { left: '37%', top: '61%', opacity: 0.26 },
  { left: '49%', top: '47%', opacity: 0.18 },
  { left: '58%', top: '67%', opacity: 0.22 },
  { left: '69%', top: '51%', opacity: 0.30 },
  { left: '78%', top: '73%', opacity: 0.16 },
  { left: '87%', top: '58%', opacity: 0.24 },
  { left: '14%', top: '79%', opacity: 0.19 },
  { left: '52%', top: '82%', opacity: 0.21 },
  { left: '95%', top: '77%', opacity: 0.17 },
];

// ── Falling pokeballs ─────────────────────────────────────────────────────────
const FALLING_BALLS = [
  { left: '5%',  delay: '0s',    duration: '3.8s' },
  { left: '15%', delay: '0.6s',  duration: '4.2s' },
  { left: '28%', delay: '1.1s',  duration: '3.5s' },
  { left: '40%', delay: '0.3s',  duration: '4.6s' },
  { left: '55%', delay: '1.7s',  duration: '3.9s' },
  { left: '68%', delay: '0.9s',  duration: '4.1s' },
  { left: '80%', delay: '0.4s',  duration: '3.7s' },
  { left: '92%', delay: '1.4s',  duration: '4.4s' },
];

const OAK_TEXT = "Hello there! Welcome to the world of Pokemon Data!";

type Phase = 0 | 1 | 2 | 3 | 4;

export function PokemonIntro() {
  const [show] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !sessionStorage.getItem('pk_intro_seen');
  });

  const [phase, setPhase] = useState<Phase>(0);
  const [overlayOpacity, setOverlayOpacity] = useState(1);
  const [creditVisible, setCreditVisible] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);
  const [pokemonTextVisible, setPokemonTextVisible] = useState(false);
  const [engineTextVisible, setEngineTextVisible] = useState(false);
  const [dotsVisible, setDotsVisible] = useState(false);
  const [dialogueVisible, setDialogueVisible] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const [cursorBlink, setCursorBlink] = useState(false);
  const [skipVisible, setSkipVisible] = useState(false);

  // Stroke animation state for pokeball logo
  const [strokeDash, setStrokeDash] = useState(200);

  const phaseRef = useRef<Phase>(0);
  const doneRef = useRef(false);
  const typeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    // Clear all pending timers
    phaseTimersRef.current.forEach((t) => clearTimeout(t));
    if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
    // Fade out
    setOverlayOpacity(0);
    const t = setTimeout(() => {
      sessionStorage.setItem('pk_intro_seen', '1');
    }, 650);
    phaseTimersRef.current.push(t);
  }, []);

  // Skip on keydown or click (phase > 0)
  useEffect(() => {
    if (!show) return;
    function onKey() {
      if (phaseRef.current > 0) finish();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, finish]);

  // Main sequence
  useEffect(() => {
    if (!show) return;

    function addTimer(fn: () => void, delay: number) {
      const t = setTimeout(fn, delay);
      phaseTimersRef.current.push(t);
      return t;
    }

    // Phase 1 — 500ms: credit appears
    addTimer(() => {
      phaseRef.current = 1;
      setPhase(1);
      setCreditVisible(true);
    }, 500);

    // Hide credit at 1800ms
    addTimer(() => {
      setCreditVisible(false);
    }, 1800);

    // Phase 2 — 2000ms: title sequence
    addTimer(() => {
      phaseRef.current = 2;
      setPhase(2);
      setLogoVisible(true);
      // Animate stroke dash from 200 to 0 over 600ms
      const start = performance.now();
      function animateDash(now: number) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / 600, 1);
        setStrokeDash(200 * (1 - progress));
        if (progress < 1) requestAnimationFrame(animateDash);
      }
      requestAnimationFrame(animateDash);
    }, 2000);

    // "POKEMON" slides up
    addTimer(() => setPokemonTextVisible(true), 2400);
    // "DATA ENGINE" slides up
    addTimer(() => setEngineTextVisible(true), 2600);
    // Dots appear
    addTimer(() => setDotsVisible(true), 2800);

    // Phase 3 — 4000ms: professor oak dialogue
    addTimer(() => {
      phaseRef.current = 3;
      setPhase(3);
      setDialogueVisible(true);
    }, 4000);

    // Skip hint at 1500ms
    addTimer(() => setSkipVisible(true), 1500);

    return () => {
      phaseTimersRef.current.forEach((t) => clearTimeout(t));
      if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // Typewriter effect — starts when dialogueVisible
  useEffect(() => {
    if (!dialogueVisible) return;
    let index = 0;
    setDisplayedText('');
    setTypingDone(false);
    setCursorBlink(false);

    function typeNext() {
      index += 1;
      setDisplayedText(OAK_TEXT.slice(0, index));
      if (index < OAK_TEXT.length) {
        typeTimerRef.current = setTimeout(typeNext, 30);
      } else {
        setTypingDone(true);
        setCursorBlink(true);
        // Hold 1000ms then finish
        typeTimerRef.current = setTimeout(() => {
          setPhase(4);
          phaseRef.current = 4;
          finish();
        }, 1000);
      }
    }

    typeTimerRef.current = setTimeout(typeNext, 30);
    return () => {
      if (typeTimerRef.current) clearTimeout(typeTimerRef.current);
    };
  }, [dialogueVisible, finish]);

  // Once overlay opacity hits 0 (CSS transition), unmount by setting sessionStorage
  // The `show` state is read-only from useState initializer — we control visibility via opacity + pointer-events
  if (!show) return null;

  const isGone = overlayOpacity === 0;

  return (
    <>
      {/* ── Keyframe injections ─────────────────────────────────────── */}
      <style>{`
        .intro-credit-box {
          animation: intro-fade-in 0.3s ease-out forwards;
        }
        .intro-pokemon-text {
          animation: intro-slide-up 0.35s ease-out forwards;
        }
        .intro-engine-text {
          animation: intro-slide-up 0.35s ease-out forwards;
        }
        .intro-dot {
          animation: intro-blink-dot 0.9s step-start infinite;
        }
        .intro-dot:nth-child(2) { animation-delay: 0.3s; }
        .intro-dot:nth-child(3) { animation-delay: 0.6s; }
        .intro-oak-cursor {
          animation: intro-blink-dot 0.7s step-start infinite;
        }
      `}</style>

      {/* ── Full-screen overlay ─────────────────────────────────────── */}
      <div
        role="presentation"
        onClick={() => { if (phaseRef.current > 0) finish(); }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: '#000',
          overflow: 'hidden',
          opacity: overlayOpacity,
          transition: overlayOpacity === 0 ? 'opacity 0.6s ease' : 'none',
          pointerEvents: isGone ? 'none' : 'all',
        }}
        aria-label="Pokemon intro sequence"
      >
        {/* Starfield */}
        {STARS.map((s) => (
          <div
            key={`star-${s.left}-${s.top}`}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: s.left,
              top: s.top,
              width: '2px',
              height: '2px',
              background: '#fff',
              opacity: s.opacity,
            }}
          />
        ))}

        {/* Falling pokeballs */}
        {FALLING_BALLS.map((b) => (
          <div
            key={`ball-${b.left}`}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: b.left,
              top: '-60px',
              animation: `intro-pokeball-fall ${b.duration} ease-in infinite`,
              animationDelay: b.delay,
            }}
          >
            <PokeballSVG size={20} opacity={0.15} />
          </div>
        ))}

        {/* ── Phase 1: GAME FREAK-style credit ──────────────────────── */}
        {phase >= 1 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: creditVisible ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          >
            <div
              className={creditVisible ? 'intro-credit-box' : ''}
              style={{
                border: '3px solid #fff',
                width: '160px',
                height: '60px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
              }}
            >
              {/* 3x3 pixel star */}
              <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
                <rect x="3" y="0" width="3" height="3" fill="#fff" />
                <rect x="0" y="3" width="3" height="3" fill="#fff" />
                <rect x="3" y="3" width="3" height="3" fill="#fff" />
                <rect x="6" y="3" width="3" height="3" fill="#fff" />
                <rect x="3" y="6" width="3" height="3" fill="#fff" />
              </svg>
              <span
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '0.55rem',
                  color: '#fff',
                  letterSpacing: '0.05em',
                  lineHeight: 1.2,
                  textAlign: 'center',
                }}
              >
                DATA LAB
              </span>
            </div>
          </div>
        )}

        {/* ── Phase 2: Title sequence ────────────────────────────────── */}
        {phase >= 2 && logoVisible && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
            }}
          >
            {/* Pokeball logo with stroke-dashoffset draw-in */}
            <svg
              width="100"
              height="100"
              viewBox="0 0 40 40"
              aria-hidden="true"
              style={{ filter: 'drop-shadow(0 0 12px rgba(220,38,38,0.6))' }}
            >
              <circle
                cx="20" cy="20" r="18"
                fill="none"
                stroke="#333"
                strokeWidth="2"
              />
              {/* Top half (red) — animated draw */}
              <path
                d="M2 20 A18 18 0 0 1 38 20"
                fill="none"
                stroke="#DC2626"
                strokeWidth="18"
                strokeDasharray="200"
                strokeDashoffset={strokeDash}
                style={{ transition: 'none' }}
              />
              {/* Bottom half (white) — animated draw */}
              <path
                d="M38 20 A18 18 0 0 1 2 20"
                fill="none"
                stroke="#F8FAFC"
                strokeWidth="18"
                strokeDasharray="200"
                strokeDashoffset={strokeDash}
                style={{ transition: 'none' }}
              />
              {/* Overlaid clean halves once draw is near done */}
              {strokeDash < 10 && (
                <>
                  <path d="M2 20 A18 18 0 0 1 38 20" fill="#DC2626" />
                  <path d="M38 20 A18 18 0 0 1 2 20" fill="#F8FAFC" />
                </>
              )}
              <line x1="2" y1="20" x2="38" y2="20" stroke="#111" strokeWidth="2.5" />
              <circle cx="20" cy="20" r="5" fill="#111" />
              <circle cx="20" cy="20" r="2.8" fill="#F8FAFC" />
            </svg>

            {/* "POKEMON" label */}
            {pokemonTextVisible && (
              <div
                className="intro-pokemon-text"
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '1.8rem',
                  color: '#EF4444',
                  letterSpacing: '0.3em',
                  textShadow: '0 0 20px rgba(239,68,68,0.6), 2px 2px 0 #000',
                }}
              >
                POKEMON
              </div>
            )}

            {/* "DATA ENGINE" label */}
            {engineTextVisible && (
              <div
                className="intro-engine-text"
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '0.7rem',
                  color: '#F8D030',
                  letterSpacing: '0.4em',
                  textShadow: '0 0 12px rgba(248,208,48,0.5)',
                }}
              >
                DATA ENGINE
              </div>
            )}

            {/* Blinking dots */}
            {dotsVisible && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '0.25rem' }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="intro-dot"
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#F8D030',
                      animationDelay: `${i * 0.3}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Phase 3: Professor Oak dialogue ───────────────────────── */}
        {phase >= 3 && dialogueVisible && (
          <div
            aria-live="polite"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '120px',
              border: '3px solid rgba(255,255,255,0.9)',
              background: '#0a0e1a',
              padding: '1rem 1.5rem',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
            }}
          >
            <div style={{ width: '100%', position: 'relative' }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '0.52rem',
                  color: '#fff',
                  lineHeight: 2,
                  letterSpacing: '0.04em',
                  maxWidth: '90%',
                }}
              >
                {displayedText}
                {!typingDone && (
                  <span style={{ display: 'inline-block', width: '6px', height: '0.52rem', background: '#fff', marginLeft: '2px', verticalAlign: 'middle', animation: 'intro-blink-dot 0.5s step-start infinite' }} />
                )}
              </p>
              {/* Done cursor ▼ */}
              {typingDone && cursorBlink && (
                <span
                  className="intro-oak-cursor"
                  style={{
                    position: 'absolute',
                    bottom: '-0.25rem',
                    right: 0,
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '0.45rem',
                    color: '#fff',
                  }}
                >
                  ▼
                </span>
              )}
            </div>
          </div>
        )}

        {/* Skip hint */}
        {skipVisible && phase < 3 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: '1rem',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '0.35rem',
              color: 'rgba(255,255,255,0.35)',
              letterSpacing: '0.06em',
              animation: 'intro-fade-in 0.5s ease forwards',
            }}
          >
            PRESS ANY BUTTON TO SKIP
          </div>
        )}
      </div>
    </>
  );
}
