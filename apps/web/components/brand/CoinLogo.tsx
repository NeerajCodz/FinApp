'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { createCoinRenderer, type CoinRenderer } from '@finapp/ui/coin';
import appIcon from '../../../mobile/assets/icon.png';

export function CoinLogo({ className = '', paused = false }: { className?: string; paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' });
    if (!gl) return;
    let renderer: CoinRenderer | null = null;
    let frame = 0;
    let visible = true;
    let elapsed = 0;
    let previous = 0;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(bounds.width * ratio), height = Math.round(bounds.height * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      renderer?.render(paused || motion.matches ? 0 : elapsed, width, height);
    };
    const tick = (timestamp: number) => {
      frame = 0;
      if (!renderer || !visible || document.hidden) return;
      if (previous) elapsed += Math.min((timestamp - previous) / 1000, 0.1);
      previous = timestamp;
      draw();
      if (!paused && !motion.matches) frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      if (!renderer || !visible || document.hidden) return;
      draw();
      if (!paused && !motion.matches) frame = requestAnimationFrame(tick);
    };
    const initialise = () => {
      try {
        renderer = createCoinRenderer(gl);
        setAvailable(true);
        sync();
      } catch {
        setAvailable(false);
      }
    };
    const lost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      frame = 0;
      renderer?.dispose();
      renderer = null;
      setAvailable(false);
    };
    const restored = () => initialise();
    const resize = new ResizeObserver(sync);
    resize.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      sync();
    });
    intersection.observe(canvas);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    initialise();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      renderer?.dispose();
    };
  }, [paused]);

  return (
    <div className={`finapp-coin ${className}`} role="img" aria-label="Finapp volt coin with a black F">
      <canvas ref={canvasRef} aria-hidden="true" className={available ? 'finapp-coin-canvas' : 'finapp-coin-canvas finapp-coin-pending'} />
      {!available && <Image className="finapp-coin-fallback" src={appIcon} alt="" width={512} height={512} />}
    </div>
  );
}
