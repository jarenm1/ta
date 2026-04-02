import type { CanvasApiBridge } from './lib/canvasApi';

declare global {
  interface Window {
    canvasApi?: CanvasApiBridge;
    electron?: {
      ipcRenderer: {
        on: (channel: string, callback: (event: unknown, ...args: unknown[]) => void) => void;
        removeListener: (channel: string, callback: (event: unknown, ...args: unknown[]) => void) => void;
        send: (channel: string, ...args: unknown[]) => void;
      };
    };
  }
}

export {};
