import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  hue: 'cyan' | 'teal' | 'amber';
}

interface TapWave {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

export function SonarParticleField({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let rafId = 0;

    const pointer = { x: -9999, y: -9999, active: false };
    const waves: TapWave[] = [];
    const particles: Particle[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (particles.length === 0 && width > 0 && height > 0) {
        const count = Math.min(48, Math.max(22, Math.floor((width * height) / 24000)));
        const hues: Particle['hue'][] = ['cyan', 'teal', 'amber'];
        for (let i = 0; i < count; i += 1) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.36,
            vy: (Math.random() - 0.5) * 0.36,
            radius: 1.2 + Math.random() * 1.8,
            alpha: 0.2 + Math.random() * 0.45,
            hue: hues[i % 10 === 0 ? 2 : i % 2],
          });
        }
      }
    };

    const toLocalCoords = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
        inside:
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom,
      };
    };

    const handlePointerMove = (e: PointerEvent) => {
      const pos = toLocalCoords(e.clientX, e.clientY);
      if (pos.inside) {
        pointer.x = pos.x;
        pointer.y = pos.y;
        pointer.active = true;
      } else {
        pointer.active = false;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      const pos = toLocalCoords(e.clientX, e.clientY);
      if (pos.inside && !reducedMotion) {
        waves.push({ x: pos.x, y: pos.y, radius: 6, alpha: 0.45 });
      }
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });

    const colorMap: Record<Particle['hue'], string> = {
      cyan: '151, 205, 239',
      teal: '111, 214, 224',
      amber: '255, 183, 125',
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (pointer.active) {
        const glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 190);
        glow.addColorStop(0, 'rgba(111, 214, 224, 0.14)');
        glow.addColorStop(0.5, 'rgba(151, 205, 239, 0.05)');
        glow.addColorStop(1, 'rgba(12, 15, 16, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      }

      for (let i = waves.length - 1; i >= 0; i -= 1) {
        const w = waves[i];
        w.radius += 3.2;
        w.alpha *= 0.94;
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(111, 214, 224, ${w.alpha.toFixed(3)})`;
        ctx.lineWidth = 1.25;
        ctx.stroke();
        if (w.alpha < 0.02) {
          waves.splice(i, 1);
        }
      }

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        if (!reducedMotion) {
          if (pointer.active) {
            const dx = pointer.x - p.x;
            const dy = pointer.y - p.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 12 && dist < 140) {
              const force = (1 - dist / 140) * 0.028;
              p.vx += (dx / dist) * force;
              p.vy += (dy / dist) * force;
            }
          }
          p.vx *= 0.985;
          p.vy *= 0.985;
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        }

        const rgb = colorMap[p.hue];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${p.alpha})`;
        ctx.fill();

        if (pointer.active) {
          const dist = Math.hypot(pointer.x - p.x, pointer.y - p.y);
          if (dist < 115) {
            const lineAlpha = (1 - dist / 115) * 0.24;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.strokeStyle = `rgba(151, 205, 239, ${lineAlpha.toFixed(3)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 w-full h-full ${className}`}
    />
  );
}

export function CustomSonarCursor() {
  const ringRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reducedMotion) return;

    let targetX = -200;
    let targetY = -200;
    let currentX = -200;
    let currentY = -200;
    let visible = false;
    let pressed = false;
    let interactiveHover = false;
    let rafId = 0;

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      visible = true;
      const targetEl = e.target as HTMLElement | null;
      interactiveHover = Boolean(
        targetEl?.closest('button, a, input, select, [role="button"]')
      );
    };

    const onDown = () => {
      pressed = true;
    };

    const onUp = () => {
      pressed = false;
    };

    const onLeave = () => {
      visible = false;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    const tick = () => {
      currentX += (targetX - currentX) * 0.22;
      currentY += (targetY - currentY) * 0.22;

      if (ringRef.current && dotRef.current && glowRef.current) {
        const opacity = visible ? '1' : '0';
        const scale = pressed ? 0.78 : interactiveHover ? 1.45 : 1;

        ringRef.current.style.opacity = opacity;
        ringRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%) scale(${scale})`;

        dotRef.current.style.opacity = opacity;
        dotRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%) scale(${pressed ? 1.4 : 1})`;

        glowRef.current.style.opacity = visible ? '1' : '0';
        glowRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[65] hidden md:block overflow-hidden">
      <div
        ref={glowRef}
        className="fixed top-0 left-0 w-72 h-72 rounded-full opacity-0 transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(circle, rgba(111, 214, 224, 0.08) 0%, rgba(151, 205, 239, 0.03) 45%, transparent 72%)',
        }}
      />
      <div
        ref={ringRef}
        className="fixed top-0 left-0 w-7 h-7 rounded-full border border-dark-secondary/70 opacity-0 transition-[opacity,border-color] duration-150"
      />
      <div
        ref={dotRef}
        className="fixed top-0 left-0 w-1.5 h-1.5 rounded-full bg-dark-primary opacity-0 transition-opacity duration-150"
      />
    </div>
  );
}
