import {
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { motion } from 'motion/react';

interface RippleItem {
  id: number;
  x: number;
  y: number;
  size: number;
}

export function SonarButton({
  children,
  className = '',
  onClick,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const [ripples, setRipples] = useState<RippleItem[]>([]);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX ? e.clientX - rect.left : rect.width / 2;
    const y = e.clientY ? e.clientY - rect.top : rect.height / 2;
    const id = Date.now() + Math.random();

    setRipples((prev) => [...prev.slice(-3), { id, x, y, size }]);
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((item) => item.id !== id));
    }, 540);

    onClick?.(e);
  };

  return (
    <button
      type={type}
      onClick={handleClick}
      className={`relative overflow-hidden transition-[transform,box-shadow,background-color,border-color,opacity] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_22px_-6px_rgba(111,214,224,0.35)] active:translate-y-0 active:scale-[0.98] ${className}`}
      {...rest}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden="true"
          className="sonar-ripple-wave"
          style={{
            left: r.x,
            top: r.y,
            width: r.size,
            height: r.size,
          }}
        />
      ))}
      {children}
    </button>
  );
}

interface Tilt3DCardProps {
  children: ReactNode;
  className?: string;
  intensity?: number;
}

export function Tilt3DCard({
  children,
  className = '',
  intensity = 8,
}: Tilt3DCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [transformStyle, setTransformStyle] = useState(
    'perspective(950px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
  );
  const [spotPos, setSpotPos] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotY = (px - 0.5) * intensity * 2;
    const rotX = (0.5 - py) * intensity * 2;

    setTransformStyle(
      `perspective(950px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`
    );
    setSpotPos({ x: px * 100, y: py * 100, active: true });
  };

  const handleLeave = () => {
    setTransformStyle('perspective(950px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    setSpotPos((prev) => ({ ...prev, active: false }));
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ transform: transformStyle }}
      className={`relative transition-transform duration-200 ease-out will-change-transform ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] transition-opacity duration-200"
        style={{
          opacity: spotPos.active ? 1 : 0,
          background: `radial-gradient(280px circle at ${spotPos.x}% ${spotPos.y}%, rgba(151, 205, 239, 0.16), rgba(111, 214, 224, 0.05) 45%, transparent 72%)`,
        }}
      />
      {children}
    </div>
  );
}

export function LikeCatchButton({
  liked,
  count,
  onToggle,
}: {
  liked: boolean;
  count: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={liked}
      aria-label={liked ? 'Batalkan apresiasi tangkapan' : 'Sukai tangkapan'}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border font-mono text-mono-sm tabular-nums transition-colors cursor-pointer ${
        liked
          ? 'bg-dark-tertiary-container/60 border-dark-tertiary text-dark-tertiary'
          : 'bg-dark-surface-container border-dark-outline-variant text-dark-on-surface-variant hover:text-dark-on-surface hover:border-dark-primary/50'
      }`}
    >
      <motion.span
        key={liked ? 'liked' : 'unliked'}
        initial={{ scale: 0.75 }}
        animate={liked ? { scale: [1, 1.42, 0.92, 1] } : { scale: 1 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="material-symbols-outlined text-[15px]"
        style={{ fontVariationSettings: liked ? "'FILL' 1" : "'FILL' 0" }}
        aria-hidden="true"
      >
        favorite
      </motion.span>
      <span>{count}</span>
    </button>
  );
}

export function SonarSpinner({ label }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="relative inline-flex w-4 h-4 rounded-full border-2 border-dark-primary/25 border-t-dark-secondary animate-spin"
      />
      {label && <span className="font-label text-label-sm text-dark-on-surface-variant">{label}</span>}
    </div>
  );
}

export function SonarRadarLoader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center p-gutter-xl">
      <div className="relative w-24 h-24 flex items-center justify-center" aria-hidden="true">
        <div className="absolute inset-0 rounded-full border border-dark-primary/30 sonar-orbit-3d" />
        <div className="absolute inset-2 rounded-full border border-dark-secondary/40" />
        <div className="absolute inset-5 rounded-full border border-dark-primary/25" />
        <div
          className="absolute inset-1 rounded-full sonar-radar-sweep"
          style={{
            background:
              'conic-gradient(from 0deg, rgba(111, 214, 224, 0.42) 0deg, rgba(111, 214, 224, 0.05) 55deg, transparent 85deg)',
          }}
        />
        <span className="relative z-10 w-3 h-3 rounded-full bg-dark-secondary shadow-[0_0_12px_rgba(111,214,224,0.9)]" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-title text-title-md text-dark-on-surface">{title}</p>
        <p className="text-body-sm text-dark-on-surface-variant max-w-sm">{subtitle}</p>
      </div>
    </div>
  );
}

export function AdminQueueSkeleton() {
  return (
    <div className="divide-y divide-dark-outline-variant" aria-label="Memuat antrean verifikasi">
      {[0, 1, 2, 3].map((idx) => (
        <div key={idx} className="p-gutter-md flex items-center justify-between gap-gutter-md">
          <div className="flex items-center gap-gutter-md flex-1">
            <div className="w-12 h-12 rounded-lg sonar-skeleton shrink-0" />
            <div className="flex flex-col gap-2 flex-1 max-w-xs">
              <div className="h-4 w-3/4 rounded sonar-skeleton" />
              <div className="h-3 w-1/2 rounded sonar-skeleton" />
            </div>
          </div>
          <div className="h-3.5 w-28 rounded sonar-skeleton hidden sm:block" />
        </div>
      ))}
    </div>
  );
}
