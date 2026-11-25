/**
 * Request and response shapes of the REST API. Each one is built on the entities of
 * `entities.ts`; extra fields are values the API computes for the interface (counts, KPIs, status)
 * and are documented in frontend/README.md ("API contract").
 */
import type {
  Algorithm,
  Destination,
  FleetConfig,
  Order,
  OrderLine,
  Product,
  Route,
  Run,
  Scenario,
  Stop,
} from './entities';

/** GET /scenarios: the scenario plus summary counts. */
export interface ScenarioSummary extends Scenario {
  n_orders: number;
  n_lines: number;
  total_units: number;
}

/** POST /scenarios/generate (RF-05). */
export interface GenerateScenarioRequest {
  name: string;
  n_orders: number;
  mean_lines: number;
  max_units: number;
  seed: number;
}

/** Datasets that can be imported (RF-01 to RF-03). */
export type DatasetKind = 'products' | 'destinations' | 'orders' | 'order_lines';

/** One validation error, always tied to the row and field of the source file (RF-04). */
export interface RowError {
  row: number;
  field: string;
  code:
    | 'missing_column'
    | 'empty'
    | 'invalid_number'
    | 'not_positive'
    | 'invalid_date'
    | 'duplicate'
    | 'unknown_id';
  value?: string;
}

/** POST /products/import, /destinations/import, /orders/import. */
export interface ImportResult {
  dataset: DatasetKind;
  imported: number;
  errors: RowError[];
}

/** POST /orders/import body: orders and their lines go to a scenario. */
export interface OrdersImportRequest {
  scenario: Pick<Scenario, 'name' | 'type'>;
  orders: Omit<Order, 'scenario_id'>[];
  order_lines: OrderLine[];
}

/** POST /optimize (CU-05). */
export interface OptimizeRequest {
  scenario_id: string;
  fleet_id: string;
  algorithm: Algorithm;
  time_limit_s: number;
}

export type RunStatus = 'queued' | 'running' | 'done' | 'failed';

/** POST /optimize returns at once; the client polls GET /results/{run_id} until status is done. */
export interface OptimizeResponse {
  run_id: string;
  status: RunStatus;
}

export type InfeasibleReason = 'does_not_fit' | 'would_expire';

export interface InfeasibleOrder {
  order_id: string;
  destination_id: string;
  units: number;
  reason: InfeasibleReason;
}

/** Global indicators of section 7.1 not already stored on the run row. */
export interface RunKpis {
  total_hours: number;
  avg_load_factor: number;
  avg_expiry_margin_h: number;
  orders_served: number;
  orders_infeasible: number;
  lower_bound: number;
}

/** Route plus the times the simulator needs and an optional road geometry from OSRM. */
export interface RouteDetail extends Route {
  departure_at: string;
  return_at: string;
  /** [lat, lon] points of the road path. When absent, the map draws straight lines between stops. */
  geometry?: [number, number][];
}

/** GET /results/{run_id}. While running, only status, progress and run are filled. */
export interface RunDetail {
  run: Run;
  status: RunStatus;
  /** 0 to 1. */
  progress: number;
  /**
   * fallback_reference: the solver hit the time limit with no solution (ERR-07);
   * approximate_distances: OSRM was unavailable (ERR-06);
   * mock_ortools: mock mode only, OR-Tools is simulated with the in-browser metaheuristic.
   */
  message?: 'fallback_reference' | 'approximate_distances' | 'mock_ortools';
  scenario_name: string;
  fleet: FleetConfig;
  kpis: RunKpis | null;
  routes: RouteDetail[];
  stops: Stop[];
  infeasible: InfeasibleOrder[];
  /** Result of the independent validator (RNF-04). Empty means no constraint is violated. */
  validation_errors?: string[];
}

export type { Algorithm, Destination, FleetConfig, Order, OrderLine, Product, Route, Run, Scenario, Stop };
