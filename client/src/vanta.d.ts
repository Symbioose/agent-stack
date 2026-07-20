declare module 'three';

declare module 'vanta/dist/vanta.fog.min' {
  interface VantaFogOptions {
    el: HTMLElement;
    THREE: unknown;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    highlightColor?: number;
    midtoneColor?: number;
    lowlightColor?: number;
    baseColor?: number;
    blurFactor?: number;
    speed?: number;
    zoom?: number;
  }
  export default function FOG(options: VantaFogOptions): { destroy: () => void };
}
