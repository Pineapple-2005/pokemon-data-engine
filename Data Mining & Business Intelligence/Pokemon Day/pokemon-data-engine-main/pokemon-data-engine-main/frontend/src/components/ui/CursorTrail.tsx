'use client';

import React, { useEffect, useRef } from 'react';

const MAX_TRAIL = 20;
const TRAIL_LIFETIME = 800; // ms

interface TrailItem {
  id: number;
  x: number;
  y: number;
  createdAt: number;
  el: HTMLDivElement;
}

/* Tiny pokéball SVG as data URI for custom cursor */
const POKEBALL_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="none" stroke="%23000" stroke-width="1.5"/><path d="M1.5 8h13" stroke="%23000" stroke-width="1.2"/><path d="M1.5 8 A6.5 6.5 0 0 1 14.5 8" fill="%23DC2626"/><path d="M1.5 8 A6.5 6.5 0 0 0 14.5 8" fill="%23F8FAFC"/><circle cx="8" cy="8" r="2.5" fill="%23000"/><circle cx="8" cy="8" r="1.5" fill="%23F8FAFC"/></svg>`;

export function CursorTrail() {
  const trailRef = useRef<TrailItem[]>([]);
  const counterRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Only on desktop
    if (typeof window === 'undefined' || window.innerWidth < 768) return;

    // Set custom cursor on the whole page
    const style = document.createElement('style');
    style.id = 'pk-cursor-style';
    style.textContent = `* { cursor: url("data:image/svg+xml,${POKEBALL_CURSOR_SVG}") 8 8, auto !important; }`;
    document.head.appendChild(style);

    function cleanup() {
      const now = Date.now();
      trailRef.current = trailRef.current.filter((item) => {
        if (now - item.createdAt >= TRAIL_LIFETIME) {
          item.el.remove();
          return false;
        }
        return true;
      });
    }

    function makePokeballSvg(): SVGSVGElement {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('width', '12');
      svg.setAttribute('height', '12');
      svg.setAttribute('viewBox', '0 0 12 12');
      svg.setAttribute('aria-hidden', 'true');

      const outline = document.createElementNS(NS, 'circle');
      outline.setAttribute('cx', '6'); outline.setAttribute('cy', '6');
      outline.setAttribute('r', '5.5');
      outline.setAttribute('fill', 'none');
      outline.setAttribute('stroke', '#DC2626');
      outline.setAttribute('stroke-width', '1');

      const divider = document.createElementNS(NS, 'path');
      divider.setAttribute('d', 'M0.5 6h11');
      divider.setAttribute('stroke', '#000');
      divider.setAttribute('stroke-width', '0.8');

      const topHalf = document.createElementNS(NS, 'path');
      topHalf.setAttribute('d', 'M0.5 6 A5.5 5.5 0 0 1 11.5 6');
      topHalf.setAttribute('fill', '#DC2626');
      topHalf.setAttribute('fill-opacity', '0.75');

      const bottomHalf = document.createElementNS(NS, 'path');
      bottomHalf.setAttribute('d', 'M0.5 6 A5.5 5.5 0 0 0 11.5 6');
      bottomHalf.setAttribute('fill', '#F8FAFC');
      bottomHalf.setAttribute('fill-opacity', '0.75');

      const centre = document.createElementNS(NS, 'circle');
      centre.setAttribute('cx', '6'); centre.setAttribute('cy', '6');
      centre.setAttribute('r', '1.8');
      centre.setAttribute('fill', '#000');

      svg.append(outline, topHalf, bottomHalf, divider, centre);
      return svg;
    }

    function onMouseMove(e: MouseEvent) {
      cleanup();

      // Limit trail length
      if (trailRef.current.length >= MAX_TRAIL) {
        const oldest = trailRef.current.shift();
        if (oldest) oldest.el.remove();
      }

      const el = document.createElement('div');
      el.className = 'cursor-trail-dot';
      el.style.left = `${e.clientX - 6}px`;
      el.style.top = `${e.clientY - 6}px`;
      el.appendChild(makePokeballSvg());
      document.body.appendChild(el);

      trailRef.current.push({
        id: ++counterRef.current,
        x: e.clientX,
        y: e.clientY,
        createdAt: Date.now(),
        el,
      });
    }

    // Periodic cleanup via rAF
    function tick() {
      cleanup();
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    document.addEventListener('mousemove', onMouseMove, { passive: true });

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      // Remove all trail elements
      trailRef.current.forEach((item) => item.el.remove());
      trailRef.current = [];
      // Remove cursor style
      document.getElementById('pk-cursor-style')?.remove();
    };
  }, []);

  // This component renders nothing — it only attaches DOM listeners
  return null;
}
