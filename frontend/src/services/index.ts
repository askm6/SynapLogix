/**
 * Entry point of the service layer. VITE_USE_MOCKS=true (the default) runs everything in the
 * browser; VITE_USE_MOCKS=false sends every call to the FastAPI backend at VITE_API_URL.
 */
import type { Api } from './types';
import { httpApi } from './api';
import { mockApi, resetMockState } from './mocks';

export const USE_MOCKS = (import.meta.env.VITE_USE_MOCKS ?? 'true') !== 'false';

export const api: Api = USE_MOCKS ? mockApi : httpApi;

/** Demo mode: delete everything saved in the browser and go back to the fixtures. No effect with the real API. */
export function resetDemoData(): void {
  if (USE_MOCKS) resetMockState();
}

export type { Api } from './types';
export { ApiError } from './api/client';
