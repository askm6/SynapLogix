/** TanStack Query hooks over the service layer. Query keys follow the REST resources. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services';
import type {
  Destination,
  FleetConfig,
  GenerateScenarioRequest,
  OrdersImportRequest,
  OptimizeRequest,
  Product,
} from '@/types/api';

export const keys = {
  products: ['products'] as const,
  destinations: ['destinations'] as const,
  scenarios: ['scenarios'] as const,
  orders: (id: string) => ['orders', id] as const,
  lines: (id: string) => ['orders', id, 'lines'] as const,
  fleets: ['fleet'] as const,
  currentFleet: ['fleet', 'current'] as const,
  runs: ['results'] as const,
  run: (id: string) => ['results', id] as const,
};

export const useProducts = () => useQuery({ queryKey: keys.products, queryFn: api.products.list });
export const useDestinations = () =>
  useQuery({ queryKey: keys.destinations, queryFn: api.destinations.list, staleTime: Infinity });
export const useScenarios = () => useQuery({ queryKey: keys.scenarios, queryFn: api.scenarios.list });
export const useOrders = (scenarioId: string | null) =>
  useQuery({
    queryKey: keys.orders(scenarioId ?? ''),
    queryFn: () => api.orders.list(scenarioId!),
    enabled: !!scenarioId,
  });
export const useOrderLines = (scenarioId: string | null) =>
  useQuery({
    queryKey: keys.lines(scenarioId ?? ''),
    queryFn: () => api.orders.lines(scenarioId!),
    enabled: !!scenarioId,
  });
export const useFleets = () => useQuery({ queryKey: keys.fleets, queryFn: api.fleet.list });
export const useCurrentFleet = () => useQuery({ queryKey: keys.currentFleet, queryFn: api.fleet.current });
export const useRuns = () => useQuery({ queryKey: keys.runs, queryFn: api.results.list });

/** Polls GET /results/{run_id} every second while the run is queued or running (CU-05 progress bar). */
export const useRun = (runId: string | null) =>
  useQuery({
    queryKey: keys.run(runId ?? ''),
    queryFn: () => api.results.get(runId!),
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'done' || status === 'failed' ? false : 1000;
    },
  });

export function useGenerateScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: GenerateScenarioRequest) => api.scenarios.generate(request),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.scenarios }),
  });
}

export function useRemoveScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.scenarios.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.scenarios }),
  });
}

export function useImportProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Product[]) => api.products.import(rows),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.products }),
  });
}

export function useImportDestinations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Destination[]) => api.destinations.import(rows),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.destinations }),
  });
}

export function useImportOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: OrdersImportRequest) => api.orders.import(request),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.scenarios }),
  });
}

export function useSaveFleet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: Omit<FleetConfig, 'fleet_id'>) => api.fleet.save(config),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.fleets }),
  });
}

export function useStartOptimization() {
  return useMutation({ mutationFn: (request: OptimizeRequest) => api.optimize.start(request) });
}

export function useRemoveRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.results.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.runs }),
  });
}
