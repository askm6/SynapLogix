/**
 * Entry point of the service layer. VITE_USE_MOCKS=true (the default) runs everything in the
 * browser; VITE_USE_MOCKS=false sends every call to the FastAPI backend at VITE_API_URL.
 */
import type { Api } from './types';
import { httpApi } from './api';
import { mockApi } from './mocks';

export const USE_MOCKS = (import.meta.env.VITE_USE_MOCKS ?? 'true') !== 'false';

export const api: Api = USE_MOCKS ? mockApi : httpApi;

export type { Api } from './types';
export { ApiError } from './api/client';
