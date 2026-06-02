'use client';

import React, { useEffect, useState } from 'react';

interface ProfessorOakProps {
  readonly message: string;
}

/* Typewriter effect — each character appears one at a time */
function useTypewriter(text: string, speed = 38): string {
  const [displayed, setDisplayed] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setDisplayed('');
    setIndex(0);
  }, [text]);

  useEffect(() => {
    if (index >= text.length) return;
    const id = setTimeout(() => {
      setDisplayed((d) => d + text[index]);
      setIndex((i) => i + 1);
    }, speed);
    return () => clearTimeout(id);
  }, [index, text, speed]);

  return displayed;
}

/**
 * SVG fallback portrait — recognisable Professor Oak:
 * silver-white swept-back hair with spiky top, kind older face,
 * white lab coat with lapels, pocket with pens sticking out.
 */
function OakSVGFallback() {
  return (
    <svg
      width="80"
      height="96"
      viewBox="0 0 80 96"
      aria-hidden="true"
      style={{ display: 'block', imageRendering: 'pixelated' }}
    >
      {/* ── Hair back layer (silver-white, swept wide) ── */}
      <ellipse cx="40" cy="16" rx="24" ry="18" fill="#C8C8C8" />
      {/* hair sweep right — sweeps back */}
      <ellipse cx="60" cy="13" rx="10" ry="12" fill="#B8B8B8" />
      {/* hair sweep left */}
      <ellipse cx="20" cy="13" rx="10" ry="12" fill="#B8B8B8" />
      {/* spiky top tuft */}
      <polygon points="36,4 40,0 44,4 41,8 39,8" fill="#D8D8D8" />
      <polygon points="30,7 34,2 37,7 34,10 31,10" fill="#C8C8C8" />
      <polygon points="43,7 46,2 50,7 47,10 44,10" fill="#C8C8C8" />
      {/* silver highlights on hair */}
      <ellipse cx="38" cy="8" rx="7" ry="3.5" fill="#E8E8E8" opacity="0.7" />
      <ellipse cx="52" cy="10" rx="5" ry="3" fill="#E8E8E8" opacity="0.5" />

      {/* ── Face ── */}
      <ellipse cx="40" cy="35" rx="17" ry="18" fill="#F2C89A" />

      {/* ── Forehead wrinkles (older face) ── */}
      <path d="M31 24 Q35 22 39 24" stroke="#d4a870" strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d="M41 24 Q45 22 49 24" stroke="#d4a870" strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d="M35 21 Q40 19 45 21" stroke="#d4a870" strokeWidth="0.7" fill="none" strokeLinecap="round" opacity="0.4" />

      {/* ── Eyebrows (fuller, slightly bushy for age) ── */}
      <rect x="26" y="26" width="12" height="2.8" rx="1.4" fill="#888880" />
      <rect x="42" y="26" width="12" height="2.8" rx="1.4" fill="#888880" />
      {/* light brow hairs */}
      <rect x="27" y="25.5" width="10" height="1.2" rx="0.6" fill="#AAAAAA" opacity="0.6" />
      <rect x="43" y="25.5" width="10" height="1.2" rx="0.6" fill="#AAAAAA" opacity="0.6" />

      {/* ── Eyes (friendly, small squint lines at corners) ── */}
      <ellipse cx="33" cy="32" rx="3.8" ry="3.2" fill="#fff" />
      <ellipse cx="47" cy="32" rx="3.8" ry="3.2" fill="#fff" />
      {/* pupils */}
      <ellipse cx="33.8" cy="32.5" rx="2.2" ry="2.4" fill="#2a1a0a" />
      <ellipse cx="47.8" cy="32.5" rx="2.2" ry="2.4" fill="#2a1a0a" />
      {/* eye shine */}
      <circle cx="34.8" cy="31.5" r="0.8" fill="#fff" />
      <circle cx="48.8" cy="31.5" r="0.8" fill="#fff" />
      {/* crow's feet wrinkles */}
      <line x1="37.5" y1="31" x2="39" y2="30" stroke="#d4a870" strokeWidth="0.6" strokeLinecap="round" opacity="0.5" />
      <line x1="37.8" y1="33" x2="39.5" y2="33.5" stroke="#d4a870" strokeWidth="0.6" strokeLinecap="round" opacity="0.5" />

      {/* ── Nose (broad, friendly) ── */}
      <ellipse cx="40" cy="38" rx="3" ry="2" fill="#E0A870" opacity="0.65" />
      <circle cx="37.5" cy="39" r="1.2" fill="#D8A060" opacity="0.45" />
      <circle cx="42.5" cy="39" r="1.2" fill="#D8A060" opacity="0.45" />

      {/* ── Kind smile ── */}
      <path d="M31 44 Q40 51 49 44" stroke="#B07048" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M31.5 44.5 Q40 50 48.5 44.5" stroke="#C88060" strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.5" />
      {/* cheek blush */}
      <ellipse cx="28" cy="42" rx="4" ry="2.5" fill="#F0A8A8" opacity="0.25" />
      <ellipse cx="52" cy="42" rx="4" ry="2.5" fill="#F0A8A8" opacity="0.25" />

      {/* ── Ears ── */}
      <ellipse cx="23" cy="35" rx="3.5" ry="4.5" fill="#F2C89A" />
      <ellipse cx="57" cy="35" rx="3.5" ry="4.5" fill="#F2C89A" />
      <ellipse cx="23" cy="35" rx="1.8" ry="2.5" fill="#E0A870" opacity="0.45" />
      <ellipse cx="57" cy="35" rx="1.8" ry="2.5" fill="#E0A870" opacity="0.45" />

      {/* ── Neck ── */}
      <rect x="35" y="51" width="10" height="8" fill="#F2C89A" />

      {/* ── Shirt collar (blue-grey under coat) ── */}
      <path d="M28 57 L40 62 L52 57 L52 65 L40 69 L28 65 Z" fill="#6B8FA8" />
      <line x1="40" y1="62" x2="40" y2="69" stroke="#5A7A90" strokeWidth="1.2" />
      {/* collar notch */}
      <path d="M36 60 L40 62 L44 60" stroke="#4A6A80" strokeWidth="0.8" fill="none" />

      {/* ── White lab coat body ── */}
      <path d="M8 59 L28 55 L40 59 L52 55 L72 59 L74 96 L6 96 Z" fill="#EEEEEE" />
      {/* coat shading */}
      <path d="M8 59 L28 55 L40 59 L52 55 L72 59 L74 96 L6 96 Z" fill="url(#coatGrad)" opacity="0.4" />
      <defs>
        <linearGradient id="coatGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#999" />
          <stop offset="30%" stopColor="transparent" />
          <stop offset="70%" stopColor="transparent" />
          <stop offset="100%" stopColor="#999" />
        </linearGradient>
      </defs>

      {/* ── Left lapel ── */}
      <path d="M28 55 L36 60 L27 75 L12 67 Z" fill="#DDDDDD" />
      <line x1="28" y1="55" x2="36" y2="60" stroke="#CCCCCC" strokeWidth="1" />

      {/* ── Right lapel ── */}
      <path d="M52 55 L44 60 L53 75 L68 67 Z" fill="#DDDDDD" />
      <line x1="52" y1="55" x2="44" y2="60" stroke="#CCCCCC" strokeWidth="1" />

      {/* ── Shoulders ── */}
      <ellipse cx="13" cy="65" rx="9" ry="5.5" fill="#E6E6E6" />
      <ellipse cx="67" cy="65" rx="9" ry="5.5" fill="#E6E6E6" />

      {/* ── Coat pocket (right chest) ── */}
      <rect x="43" y="73" width="16" height="12" rx="1.5" fill="#DDDDDD" stroke="#CCCCCC" strokeWidth="0.8" />
      {/* pocket top fold */}
      <path d="M43 73 Q51 71 59 73" stroke="#CCCCCC" strokeWidth="1" fill="none" />
      {/* pens sticking out */}
      <rect x="46" y="70" width="2" height="8" rx="1" fill="#1155CC" />
      <circle cx="47" cy="70" r="1.2" fill="#2266DD" />
      <rect x="50" y="70" width="2" height="7" rx="1" fill="#CC2222" />
      <circle cx="51" cy="70" r="1.2" fill="#DD3333" />
      <rect x="54" y="70" width="1.5" height="6" rx="0.75" fill="#111111" />

      {/* ── Coat buttons ── */}
      <circle cx="40" cy="80" r="2.2" fill="#DDDDDD" stroke="#BBBBBB" strokeWidth="0.8" />
      <circle cx="40" cy="88" r="2.2" fill="#DDDDDD" stroke="#BBBBBB" strokeWidth="0.8" />
      {/* button holes */}
      <line x1="39" y1="80" x2="41" y2="80" stroke="#AAAAAA" strokeWidth="0.8" />
      <line x1="39" y1="88" x2="41" y2="88" stroke="#AAAAAA" strokeWidth="0.8" />
    </svg>
  );
}

/** Professor Oak portrait — tries the Gen 5 sprite first, falls back to SVG */
function OakPortrait() {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return <OakSVGFallback />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="https://play.pokemonshowdown.com/sprites/trainers/oak.png"
      alt="Professor Oak"
      width={80}
      height={80}
      onError={() => setImgFailed(true)}
      style={{
        imageRendering: 'pixelated',
        display: 'block',
        objectFit: 'contain',
      }}
    />
  );
}

export function ProfessorOak({ message }: ProfessorOakProps) {
  const typed = useTypewriter(message);
  const done = typed.length >= message.length;

  return (
    <div
      role="status"
      aria-label={`Professor Oak says: ${message}`}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '0',
        padding: '1.5rem 1.25rem',
        justifyContent: 'center',
      }}
    >
      {/* Portrait container — teal background like GBA games */}
      <div
        aria-hidden="true"
        style={{
          flexShrink: 0,
          background: 'linear-gradient(135deg, #1a6060 0%, #0d4040 100%)',
          border: '3px solid #ffffff',
          borderRight: 'none',
          borderRadius: '4px 0 0 4px',
          padding: '6px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          width: '96px',
          height: '108px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Subtle scanline overlay on portrait */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 3px)',
          pointerEvents: 'none',
          zIndex: 1,
        }} />
        <OakPortrait />
      </div>

      {/* Dialogue box — dark navy with white border, like GBA UI */}
      <div className="oak-dialogue" role="presentation">
        <p className="oak-dialogue-text">
          {typed}
          {!done && <span className="oak-dialogue-cursor" aria-hidden="true" />}
          {done && <span className="oak-dialogue-cursor-done" aria-hidden="true">▼</span>}
        </p>
      </div>
    </div>
  );
}
