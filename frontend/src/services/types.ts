/**
 * The service contract shared by the HTTP client and the mock implementation.
 * Pages and hooks only depend on this interface, never on how it is fulfilled.
 */
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

export interface ProductsService {
  /** GET /products */
  list(): Promise<Product[]>;
  /** POST /products/import */
  import(rows: Product[]): Promise<ImportResult>;
}

export interface DestinationsService {
  /** GET /destinations (includes the depot, D000). */
  list(): Promise<Destination[]>;
  /** POST /destinations/import */
  import(rows: Destination[]): Promise<ImportResult>;
}

export interface OrdersService {
  /** GET /orders?scenario_id= */
  list(scenarioId: string): Promise<Order[]>;
  /** GET /orders/lines?scenario_id= */
  lines(scenarioId: string): Promise<OrderLine[]>;
  /** POST /orders/import: creates a "real" scenario with the imported orders and lines. */
  import(request: OrdersImportRequest): Promise<ImportResult & { scenario: ScenarioSummary | null }>;
}

export interface ScenariosService {
  /** GET /scenarios */
  list(): Promise<ScenarioSummary[]>;
  /** POST /scenarios/generate */
  generate(request: GenerateScenarioRequest): Promise<ScenarioSummary>;
  /** DELETE /scenarios/{scenario_id} */
  remove(scenarioId: string): Promise<void>;
}

export interface FleetService {
  /** GET /fleet: every saved configuration, newest first. */
  list(): Promise<FleetConfig[]>;
  /** GET /fleet/current: the configuration used by default for new runs. */
  current(): Promise<FleetConfig>;
  /** POST /fleet: saves a new configuration and makes it current. */
  save(config: Omit<FleetConfig, 'fleet_id'>): Promise<FleetConfig>;
}

export interface OptimizeService {
  /** POST /optimize: returns at once with a run_id to poll. */
  start(request: OptimizeRequest): Promise<OptimizeResponse>;
}

export interface ResultsService {
  /** GET /results: saved runs (finished ones), newest first. */
  list(): Promise<Run[]>;
  /** GET /results/{run_id}: status, progress and, when done, the full solution. */
  get(runId: string): Promise<RunDetail>;
  /** DELETE /results/{run_id} */
  remove(runId: string): Promise<void>;
}

export interface Api {
  products: ProductsService;
  destinations: DestinationsService;
  orders: OrdersService;
  scenarios: ScenariosService;
  fleet: FleetService;
  optimize: OptimizeService;
  results: ResultsService;
}
