'use client';

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Image from 'next/image';
import { createCoinRenderer, type CoinInteraction, type CoinRenderer } from '@finapp/ui/coin';
import {
  advanceCoinSpin,
  applyCoinDrag,
  createCoinFloat,
  releaseCoinMomentum,
  stopCoinMomentum,
  type CoinAngularVelocity,
} from '@finapp/ui/coin/motion';
import appIcon from '../../../mobile/assets/icon.png';

export function CoinLogo({
  className = '',
  paused = false,
  interactive = false,
}: {
  className?: string;
  paused?: boolean;
  interactive?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement>(null);
  const [rendererMode, setRendererMode] = useState<'pending' | 'webgpu' | 'webgl' | 'fallback'>(
    'pending',
  );
  const interaction = useRef<CoinInteraction>({
    rotationX: 0,
    rotationY: 0,
    lightX: 0,
    lightY: 0,
  });
  const angularVelocity = useRef<CoinAngularVelocity>({ x: 0, y: 0 });
  const hoverRotation = useRef({ x: 0, y: 0 });
  const drag = useRef<{ pointerId: number; x: number; y: number; time: number } | null>(null);
  const syncRef = useRef<() => void>(() => {});

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const lightX = Math.max(
      -1,
      Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1),
    );
    const lightY = Math.max(
      -1,
      Math.min(1, 1 - ((event.clientY - bounds.top) / bounds.height) * 2),
    );
    interaction.current.lightX = lightX;
    interaction.current.lightY = lightY;
    if (drag.current?.pointerId === event.pointerId) {
      const deltaX = event.clientX - drag.current.x;
      const deltaY = event.clientY - drag.current.y;
      applyCoinDrag(
        interaction.current,
        angularVelocity.current,
        deltaX,
        deltaY,
        (event.timeStamp - drag.current.time) / 1000,
      );
      drag.current = { ...drag.current, x: event.clientX, y: event.clientY, time: event.timeStamp };
      hoverRotation.current.x = 0;
      hoverRotation.current.y = 0;
      syncRef.current();
      return;
    }
    hoverRotation.current.x = -lightY * 0.16;
    hoverRotation.current.y = lightX * 0.2;
    syncRef.current();
  };
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || event.button !== 0) return;
    stopCoinMomentum(angularVelocity.current);
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = 'true';
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
    };
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointerDrag = drag.current;
    if (pointerDrag?.pointerId !== event.pointerId) return;
    releaseCoinMomentum(angularVelocity.current, (event.timeStamp - pointerDrag.time) / 1000);
    drag.current = null;
    delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    syncRef.current();
  };
  const handlePointerLeave = () => {
    if (!interactive || drag.current) return;
    interaction.current.lightX = 0;
    interaction.current.lightY = 0;
    hoverRotation.current.x = 0;
    hoverRotation.current.y = 0;
    syncRef.current();
  };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const step = event.shiftKey ? 0.25 : 0.1;
    if (event.key === 'ArrowLeft') interaction.current.rotationY -= step;
    else if (event.key === 'ArrowRight') interaction.current.rotationY += step;
    else if (event.key === 'ArrowUp') interaction.current.rotationX -= step;
    else if (event.key === 'ArrowDown') interaction.current.rotationX += step;
    else return;
    event.preventDefault();
    syncRef.current();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const fallbackCanvas = fallbackCanvasRef.current;
    if (!canvas || !fallbackCanvas) return;
    let renderer: CoinRenderer | null = null;
    let renderCanvas: HTMLCanvasElement = canvas;
    let frame = 0;
    let initializationFrame = 0;
    let visible = true;
    let disposed = false;
    let elapsed = 0;
    let previous = 0;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const float = createCoinFloat();
    const draw = () => {
      const bounds = renderCanvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(bounds.width * ratio);
      const height = Math.round(bounds.height * ratio);
      if (renderCanvas.width !== width || renderCanvas.height !== height) {
        renderCanvas.width = width;
        renderCanvas.height = height;
      }
      const pose = interaction.current;
      const tilt = hoverRotation.current;
      renderer?.render(paused || motion.matches ? 0 : float.sample(elapsed), width, height, {
        ...pose,
        rotationX: pose.rotationX + tilt.x,
        rotationY: pose.rotationY + tilt.y,
      });
    };
    const tick = (timestamp: number) => {
      frame = 0;
      if (!renderer || !visible || document.hidden) return;
      const deltaSeconds = previous ? Math.min((timestamp - previous) / 1000, 0.1) : 0;
      elapsed += deltaSeconds;
      previous = timestamp;
      if (!paused && !motion.matches && interactive && !drag.current)
        advanceCoinSpin(interaction.current, angularVelocity.current, deltaSeconds);
      draw();
      if (!paused && !motion.matches) frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      if (paused || motion.matches) stopCoinMomentum(angularVelocity.current);
      if (!renderer || !visible || document.hidden) return;
      draw();
      if (!paused && !motion.matches) frame = requestAnimationFrame(tick);
    };
    syncRef.current = sync;
    const initialiseWebGL = () => {
      if (disposed) return;
      try {
        const gl = fallbackCanvas.getContext('webgl', {
          alpha: true,
          antialias: true,
          powerPreference: 'low-power',
        });
        if (!gl) throw new Error('WebGL is unavailable.');
        renderer = createCoinRenderer(gl);
        renderCanvas = fallbackCanvas;
        setRendererMode('webgl');
        sync();
      } catch {
        setRendererMode('fallback');
      }
    };
    const initialise = async () => {
      try {
        // The WebGPU renderer is browser-only; keep it out of Next's server render.
        const { createVgpuCoinRenderer } = await import('./createVgpuCoinRenderer');
        const nextRenderer = await createVgpuCoinRenderer(canvas);
        if (disposed) {
          nextRenderer.dispose();
          return;
        }
        renderer = nextRenderer;
        renderCanvas = canvas;
        setRendererMode('webgpu');
        sync();
      } catch {
        initialiseWebGL();
      }
    };
    const resize = new ResizeObserver(sync);
    resize.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      sync();
    });
    intersection.observe(canvas);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    initializationFrame = requestAnimationFrame(() => void initialise());
    return () => {
      disposed = true;
      cancelAnimationFrame(initializationFrame);
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
      renderer?.dispose();
      syncRef.current = () => {};
    };
  }, [paused]);

  return (
    <div
      className={`finapp-coin${interactive ? ' finapp-coin-interactive' : ''}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={
        interactive
          ? 'Interactive Finapp volt coin. Drag to spin or use the arrow keys.'
          : 'Finapp volt coin with a black F'
      }
      tabIndex={interactive ? 0 : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`finapp-coin-canvas${rendererMode === 'webgpu' ? '' : ' finapp-coin-hidden'}`}
      />
      <canvas
        ref={fallbackCanvasRef}
        aria-hidden="true"
        className={`finapp-coin-canvas${rendererMode === 'webgl' ? '' : ' finapp-coin-hidden'}`}
      />
      {rendererMode !== 'webgpu' && rendererMode !== 'webgl' && (
        <Image className="finapp-coin-fallback" src={appIcon} alt="" width={512} height={512} />
      )}
    </div>
  );
}
