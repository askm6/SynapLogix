/** HTTP implementation of the service contract: one call per FastAPI endpoint. */
import type { Api } from '../types';
import type {
  Destination,
  FleetConfig,
  GenerateScenarioRequest,
  ImportResult,
  Order,
  OrderLine,
  OrdersImportRequest,
  OptimizeRequest,
  OptimizeResponse,
  Product,
  Run,
  RunDetail,
  ScenarioSummary,
} from '@/types/api';
import { http } from './client';

export const httpApi: Api = {
  products: {
    list: () => http.get<Product[]>('/products'),
    import: (rows) => http.post<ImportResult>('/products/import', rows),
  },
  destinations: {
    list: () => http.get<Destination[]>('/destinations'),
    import: (rows) => http.post<ImportResult>('/destinations/import', rows),
  },
  orders: {
    list: (scenarioId) => http.get<Order[]>('/orders', { scenario_id: scenarioId }),
    lines: (scenarioId) => http.get<OrderLine[]>('/orders/lines', { scenario_id: scenarioId }),
    import: (request: OrdersImportRequest) =>
      http.post<ImportResult & { scenario: ScenarioSummary | null }>('/orders/import', request),
  },
  scenarios: {
    list: () => http.get<ScenarioSummary[]>('/scenarios'),
    generate: (request: GenerateScenarioRequest) =>
      http.post<ScenarioSummary>('/scenarios/generate', request),
    remove: (scenarioId) => http.delete<void>(`/scenarios/${encodeURIComponent(scenarioId)}`),
  },
  fleet: {
    list: () => http.get<FleetConfig[]>('/fleet'),
    current: () => http.get<FleetConfig>('/fleet/current'),
    save: (config) => http.post<FleetConfig>('/fleet', config),
  },
  optimize: {
    start: (request: OptimizeRequest) => http.post<OptimizeResponse>('/optimize', request),
  },
  results: {
    list: () => http.get<Run[]>('/results'),
    get: (runId) => http.get<RunDetail>(`/results/${encodeURIComponent(runId)}`),
    remove: (runId) => http.delete<void>(`/results/${encodeURIComponent(runId)}`),
  },
};
