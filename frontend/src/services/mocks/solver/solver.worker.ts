/// <reference lib="webworker" />
/** Web Worker that runs the mock solver off the main thread so the interface stays responsive. */
import { solve, type SolveRequest, type SolveResult } from './solve';

export type WorkerMessage =
  | { type: 'progress'; progress: number }
  | { type: 'done'; result: SolveResult }
  | { type: 'error'; message: string };

self.onmessage = (event: MessageEvent<SolveRequest>) => {
  let last = 0;
  try {
    const result = solve(event.data, (progress) => {
      const now = performance.now();
      if (now - last > 200 || progress >= 1) {
        last = now;
        self.postMessage({ type: 'progress', progress } satisfies WorkerMessage);
      }
    });
    self.postMessage({ type: 'done', result } satisfies WorkerMessage);
  } catch (error) {
    self.postMessage({ type: 'error', message: String(error) } satisfies WorkerMessage);
  }
};
