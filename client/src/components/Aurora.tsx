import { useEffect, useRef } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';

// react-bits-style aurora background rendered with a tiny WebGL shader (ogl).
// Falls back to nothing when WebGL is unavailable (tests, old devices).
const VERTEX = /* glsl */ `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision mediump float;
uniform float uTime;
uniform vec2 uResolution;

float wave(vec2 uv, float offset, float speed, float freq) {
  return sin(uv.x * freq + uTime * speed + offset) * 0.5 + 0.5;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float band1 = wave(uv, 0.0, 0.28, 2.4);
  float band2 = wave(uv, 2.1, -0.22, 3.1);
  float band3 = wave(uv, 4.4, 0.16, 1.7);

  float y1 = smoothstep(0.32, 0.0, abs(uv.y - (0.62 + band1 * 0.16)));
  float y2 = smoothstep(0.28, 0.0, abs(uv.y - (0.44 + band2 * 0.2)));
  float y3 = smoothstep(0.36, 0.0, abs(uv.y - (0.55 + band3 * 0.14)));

  vec3 c1 = vec3(0.29, 0.36, 0.71) * y1;   // indigo
  vec3 c2 = vec3(0.18, 0.46, 0.54) * y2;   // teal
  vec3 c3 = vec3(0.42, 0.30, 0.62) * y3;   // violet

  vec3 color = (c1 + c2 + c3) * 0.34;
  float fade = smoothstep(1.0, 0.25, uv.y) * smoothstep(-0.15, 0.35, uv.y);
  gl_FragColor = vec4(color * fade, 1.0);
}
`;

export default function Aurora({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let renderer: Renderer;
    try {
      renderer = new Renderer({ alpha: true, antialias: false, dpr: Math.min(window.devicePixelRatio, 2) });
    } catch {
      return; // WebGL unavailable
    }
    const gl = renderer.gl;
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    host.appendChild(gl.canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [1, 1] },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      renderer.setSize(host.offsetWidth, host.offsetHeight);
      program.uniforms.uResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const start = performance.now();
    const loop = () => {
      program.uniforms.uTime.value = (performance.now() - start) / 1000;
      renderer.render({ scene: mesh });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      gl.canvas.remove();
    };
  }, []);

  return <div ref={hostRef} aria-hidden="true" className={className} />;
}
