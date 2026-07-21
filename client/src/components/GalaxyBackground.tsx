import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { Mesh, Program, Renderer, Triangle } from 'ogl';

const VERTEX = /* glsl */ `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uMotion;
uniform vec2 uResolution;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  local = local * local * (3.0 - 2.0 * local);
  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

float starLayer(vec2 uv, float scale, float drift, float seed) {
  float time = uTime * uMotion;
  vec2 grid = uv * scale + vec2(time * drift, time * drift * 0.37);
  vec2 cell = floor(grid);
  vec2 local = fract(grid) - 0.5;
  float presence = step(0.982, hash21(cell + seed));
  vec2 offset = vec2(
    hash21(cell + seed + 1.7),
    hash21(cell + seed + 5.3)
  ) - 0.5;
  float variation = hash21(cell + seed + 9.1);
  float radius = mix(0.018, 0.07, pow(variation, 9.0));
  float point = 1.0 - smoothstep(0.0, radius, length(local - offset * 0.65));
  float twinkle = 0.72 + 0.28 * sin(time * (0.45 + variation * 0.8) + variation * 6.28318);
  return presence * point * twinkle;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
  float time = uTime * uMotion;
  float cloud = valueNoise(uv * 1.65 + vec2(time * 0.006, -time * 0.004));
  vec2 nebulaUv = uv - vec2(0.2, 0.08);
  float nebula = exp(-dot(nebulaUv * vec2(0.85, 2.15), nebulaUv * vec2(0.85, 2.15)) * 2.35);
  nebula *= smoothstep(0.28, 0.82, cloud);

  vec3 color = vec3(0.0353, 0.0392, 0.0471);
  vec3 nebulaColor = mix(vec3(0.09, 0.12, 0.3), vec3(0.29, 0.11, 0.4), cloud);
  color += nebulaColor * nebula * 0.16;

  float farStars = starLayer(uv, 24.0, 0.004, 3.0);
  float midStars = starLayer(uv, 42.0, -0.007, 17.0);
  float nearStars = starLayer(uv, 68.0, 0.011, 41.0);
  color += vec3(0.5, 0.58, 0.9) * farStars * 0.35;
  color += vec3(0.68, 0.72, 1.0) * midStars * 0.55;
  color += vec3(0.88, 0.82, 1.0) * nearStars * 0.72;

  float vignette = 1.0 - smoothstep(0.38, 1.28, length(uv));
  color *= mix(0.64, 1.0, vignette);
  gl_FragColor = vec4(color, 1.0);
}
`;

export default function GalaxyBackground({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let elapsed = 0;
    let previousTime = performance.now();
    let observer: ResizeObserver | undefined;
    let renderer: Renderer | undefined;
    let listening = false;
    let stopped = false;
    let hasSize = false;
    let visibility: (() => void) | undefined;

    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      if (listening && visibility) {
        document.removeEventListener('visibilitychange', visibility);
        listening = false;
      }
      const canvas = renderer?.gl.canvas;
      try {
        renderer?.gl.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        // The static fallback remains usable even when context loss is unavailable.
      } finally {
        canvas?.remove();
      }
    };

    try {
      renderer = new Renderer({ alpha: true, antialias: false, dpr: Math.min(window.devicePixelRatio, 1.5) });
      const gl = renderer.gl;
      const geometry = new Triangle(gl);
      const program = new Program(gl, {
        vertex: VERTEX,
        fragment: FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uMotion: { value: host.offsetWidth < 768 ? 0.65 : 1 },
          uResolution: { value: [1, 1] },
        },
      });
      const mesh = new Mesh(gl, { geometry, program });
      host.appendChild(gl.canvas);

      const resize = () => {
        if (stopped) return;
        const width = host.offsetWidth;
        const height = host.offsetHeight;
        program.uniforms.uMotion.value = width < 768 ? 0.65 : 1;
        if (width <= 0 || height <= 0) {
          hasSize = false;
          return;
        }
        renderer?.setSize(width, height);
        program.uniforms.uResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
        hasSize = true;
      };
      const loop = (time: number) => {
        if (stopped) return;
        elapsed += Math.min(Math.max(time - previousTime, 0), 32) / 1000;
        previousTime = time;
        program.uniforms.uTime.value = elapsed;
        try {
          if (hasSize) renderer?.render({ scene: mesh });
          frame = requestAnimationFrame(loop);
        } catch {
          stop();
        }
      };
      visibility = () => {
        if (stopped) return;
        cancelAnimationFrame(frame);
        if (!document.hidden) {
          previousTime = performance.now();
          frame = requestAnimationFrame(loop);
        }
      };

      resize();
      observer = new ResizeObserver(() => {
        try {
          resize();
        } catch {
          stop();
        }
      });
      observer.observe(host);
      document.addEventListener('visibilitychange', visibility);
      listening = true;
      if (!document.hidden) frame = requestAnimationFrame(loop);

      return stop;
    } catch {
      stop();
    }
  }, []);

  return <div ref={hostRef} data-testid="galaxy-background" aria-hidden="true" className={clsx('galaxy-background', className)} />;
}
