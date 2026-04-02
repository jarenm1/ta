import type { CanvasApiBridge } from './lib/canvasApi';

declare global {
  interface Window {
    canvasApi?: CanvasApiBridge;
  }
}

export {};
