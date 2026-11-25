import { useEffect, useState } from 'react';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackIcon?: string;
  zoomOnHover?: boolean;
}

export function SmartImage({
  src,
  alt,
  className = '',
  fallbackIcon = 'phishing',
  zoomOnHover = false,
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  if (failed || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-dark-primary-container/60 via-dark-surface-container to-dark-secondary-container/50 text-dark-on-surface-variant ${className}`}
      >
        <span className="material-symbols-outlined text-headline-md text-dark-secondary" aria-hidden="true">
          {fallbackIcon}
        </span>
        <span className="font-label text-label-sm text-center px-2 truncate max-w-full">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 sonar-skeleton"
        />
      )}
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`w-full h-full object-cover transition-[opacity,transform] duration-300 ease-out ${
          loaded ? 'opacity-100' : 'opacity-0'
        } ${zoomOnHover ? 'group-hover:scale-105' : ''}`}
      />
    </div>
  );
}
