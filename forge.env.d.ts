/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

import type { CanvasApiBridge } from './src/lib/canvasApi';

declare global {
  interface Window {
    canvasApi?: CanvasApiBridge;
  }
}
