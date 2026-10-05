/// <reference types="vite/client" />

// The plain-JS React wrapper has the same API as the TSX one; the demo imports one component from it.
declare module '*.jsx' {
  import type { ComponentType } from 'react';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const DonutChart: ComponentType<any>;
}
