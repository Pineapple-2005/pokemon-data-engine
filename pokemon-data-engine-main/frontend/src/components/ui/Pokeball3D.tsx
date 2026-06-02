'use client';

/**
 * True 3D Pokéball sphere — raw Three.js, no React wrapper.
 *
 * Uses THREE.SphereGeometry (64×64 segments) with a canvas texture
 * equirectangularly mapped onto it. MeshPhongMaterial gives real
 * specular highlights and lighting. Three.js itself is unaffected
 * by the @react-three/fiber / React 18.3 incompatibility.
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Pokeball3DProps {
  size?: number;
  loading?: boolean;
  className?: string;
}

/**
 * Builds a 1024×512 equirectangular canvas texture of the Pokéball pattern.
 *
 * UV mapping on THREE.SphereGeometry (with default flipY=true on CanvasTexture):
 *   canvas top    → north pole  (top of sphere)
 *   canvas middle → equator
 *   canvas bottom → south pole  (bottom of sphere)
 *   canvas left   → seam
 *   canvas centre → 180° opposite the seam (front-ish after rotation)
 */
function buildPokeballTexture(): THREE.CanvasTexture {
  const W = 1024, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  /* ── Red north hemisphere — richer gradient with dark edges ─── */
  const gRed = ctx.createRadialGradient(W * 0.30, H * 0.20, 0, W * 0.5, H * 0.25, W * 0.58);
  gRed.addColorStop(0,    '#FF8080');   // top highlight
  gRed.addColorStop(0.35, '#DC2626');   // mid red
  gRed.addColorStop(0.75, '#991111');   // darkening toward edges
  gRed.addColorStop(1,    '#6B0000');   // very dark at poles/edges
  ctx.fillStyle = gRed;
  ctx.fillRect(0, 0, W, H * 0.46);

  /* ── White south hemisphere — warm off-white, grey at edges ─── */
  const gWhite = ctx.createRadialGradient(W * 0.33, H * 0.58, 0, W * 0.5, H * 0.75, W * 0.56);
  gWhite.addColorStop(0,    '#FFFFFF');   // bright centre
  gWhite.addColorStop(0.5,  '#EEF2F5');   // slight warmth
  gWhite.addColorStop(1,    '#C8D4DC');   // grey at edges
  ctx.fillStyle = gWhite;
  ctx.fillRect(0, H * 0.54, W, H * 0.46);

  /* ── Black equator band — slightly wider (H*0.16) ────────────── */
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, H * 0.42, W, H * 0.16);

  /* ── Seam hinge line at exact centre of band ─────────────────── */
  ctx.strokeStyle = '#1a2840';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.5);
  ctx.lineTo(W, H * 0.5);
  ctx.stroke();

  /* ── Centre button — outer ring (slightly lighter than band) ─── */
  const bx = W * 0.5, by = H * 0.5;
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(bx, by, H * 0.11, 0, Math.PI * 2);
  ctx.fill();

  /* ── Centre button — inner dark ring ─────────────────────────── */
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(bx, by, H * 0.095, 0, Math.PI * 2);
  ctx.fill();

  /* ── Centre button — white disc with radial gradient ─────────── */
  const gBtn = ctx.createRadialGradient(
    bx - H * 0.020, by - H * 0.020, 0,
    bx,             by,             H * 0.065,
  );
  gBtn.addColorStop(0,   '#FFFFFF');
  gBtn.addColorStop(0.5, '#EEF2F5');
  gBtn.addColorStop(1,   '#B8C8D4');
  ctx.fillStyle = gBtn;
  ctx.beginPath();
  ctx.arc(bx, by, H * 0.065, 0, Math.PI * 2);
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

export function Pokeball3D({ size = 120, loading = false, className = '' }: Pokeball3DProps) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(loading);

  /* Keep loadingRef current without restarting the render loop */
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    /* ── Scene ────────────────────────────────────────── */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.z = 3.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);

    /* ── Sphere ───────────────────────────────────────── */
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const texture  = buildPokeballTexture();
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.MeshPhongMaterial({
      map:       texture,
      shininess: 110,
      specular:  new THREE.Color(0x334466),
    });

    const sphere = new THREE.Mesh(geometry, material);
    /* Tilt slightly on X so you see red top + equator from the front */
    sphere.rotation.x = 0.28;
    scene.add(sphere);

    /* ── Lighting ─────────────────────────────────────── */
    /* Ambient: lifts shadows so dark side isn't pitch black */
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    /* Key light: top-left-front, creates the primary specular blob */
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 6, 5);
    scene.add(key);

    /* Fill light: blue-tinted, opposite side */
    const fill = new THREE.DirectionalLight(0x6890F0, 0.28);
    fill.position.set(-4, -2, -3);
    scene.add(fill);

    /* Rim light: catches the bottom edge */
    const rim = new THREE.DirectionalLight(0xffffff, 0.32);
    rim.position.set(0, -4, -2);
    scene.add(rim);

    /* Frontal fill: subtle point light at camera position */
    const front = new THREE.PointLight(0xffffff, 0.15);
    front.position.set(0, 0, 4);
    scene.add(front);

    /* ── Render loop ──────────────────────────────────── */
    let lastMs = 0;
    let rafId  = 0;

    function tick(ms: number) {
      rafId = requestAnimationFrame(tick);
      const dt = Math.min((ms - lastMs) / 1000, 0.05);
      lastMs = ms;
      sphere.rotation.y += dt * (loadingRef.current ? 4.2 : 0.88);
      renderer.render(scene, camera);
    }

    rafId = requestAnimationFrame(tick);

    /* ── Cleanup ──────────────────────────────────────── */
    return () => {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className={className}
      style={{ width: size, height: size, flexShrink: 0, position: 'relative' }}
    />
  );
}
