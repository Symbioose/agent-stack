import { useEffect, useRef } from 'react';

interface VantaEffect {
  destroy: () => void;
}

// Vanta FOG background, loaded lazily so three.js never lands in the main bundle.
export default function VantaBackground({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let effect: VantaEffect | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const [{ default: FOG }, THREE] = await Promise.all([
          import('vanta/dist/vanta.fog.min'),
          import('three'),
        ]);
        if (cancelled) return;
        effect = FOG({
          el: host,
          THREE,
          mouseControls: true,
          touchControls: false,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          highlightColor: 0x2b3a67,
          midtoneColor: 0x1a2038,
          lowlightColor: 0x0d1020,
          baseColor: 0x090a0c,
          blurFactor: 0.55,
          speed: 1.1,
          zoom: 0.7,
        }) as VantaEffect;
      } catch {
        // WebGL unavailable — plain background is fine.
      }
    })();

    return () => {
      cancelled = true;
      effect?.destroy();
    };
  }, []);

  return <div ref={hostRef} aria-hidden="true" className={className} />;
}
