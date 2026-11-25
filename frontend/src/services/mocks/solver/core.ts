/**
 * In-browser port of the Python calculation core (backend/synaplogix/routing.py and models.py),
 * used ONLY by the mock service layer so the interface can be demonstrated without the backend.
 * Clarke-Wright is a line-by-line port and reproduces the Python results exactly; the simulated
 * annealing follows the same moves but uses its own random generator, so it can differ in detail.
 *
 * Times are UTC epoch milliseconds that represent the naive local times of the Python core.
 */
import type { Destination, FleetConfig, Order, OrderLine, Product } from '@/types/entities';
import type { InfeasibleReason } from '@/types/api';

export const DEPOT = 'D000';
export const ROAD_FACTOR = 1.25; // ERR-06 fallback: Haversine x road factor
const EARTH_RADIUS_KM = 6371.0088;
const TRUCK_WEIGHT = 100_000; // fixed cost per truck: fewer trucks always beats fewer km
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface SolverInput {
  orders: Order[];
  lines: OrderLine[];
  products: Product[];
  destinations: Destination[];
  fleet: FleetConfig;
}

/** Orders prepared for optimization (Python: Instance). */
export interface Instance {
  fleet: FleetConfig;
  orderIds: string[];
  units: Map<string, number>;
  departure: Map<string, number>;
  deadline: Map<string, number>;
  destination: Map<string, string>;
  dist: (a: string, b: string) => number;
}

export interface Evaluation {
  ok: boolean;
  km: number;
  arrivals: number[];
}

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const [p1, l1, p2, l2] = [lat1 * r, lon1 * r, lat2 * r, lon2 * r];
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Estimated road km between every pair of points (Haversine x 1.25). */
export function distanceMatrix(destinations: Destination[]): (a: string, b: string) => number {
  const ids = destinations.map((d) => d.destination_id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const m = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = destinations[i];
      const b = destinations[j];
      m[i * n + j] =
        i === j || a.latitude == null || b.latitude == null || a.longitude == null || b.longitude == null
          ? 0
          : haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) * ROAD_FACTOR;
    }
  }
  return (a, b) => m[index.get(a)! * n + index.get(b)!];
}

function parseDate(iso: string): number {
  const [y, mo, d] = iso.split('-').map(Number);
  return Date.UTC(y, mo - 1, d);
}

/** Build the instance: units, earliest departure (08:00 on the ready date) and deadline (23:59 on expiry). */
export function buildInstance(input: SolverInput): Instance {
  const products = new Map(input.products.map((p) => [p.product_id, p]));
  const linesByOrder = new Map<string, OrderLine[]>();
  for (const line of input.lines) {
    const list = linesByOrder.get(line.order_id);
    if (list) list.push(line);
    else linesByOrder.set(line.order_id, [line]);
  }
  const inst: Instance = {
    fleet: input.fleet,
    orderIds: input.orders.map((o) => o.order_id),
    units: new Map(),
    departure: new Map(),
    deadline: new Map(),
    destination: new Map(),
    dist: distanceMatrix(input.destinations),
  };
  for (const order of input.orders) {
    const lines = linesByOrder.get(order.order_id) ?? [];
    const f = parseDate(order.order_date);
    let units = 0;
    let maxManufacturing = 0;
    let expiry = Infinity;
    for (const line of lines) {
      const p = products.get(line.product_id)!;
      units += line.quantity;
      maxManufacturing = Math.max(maxManufacturing, p.manufacturing_days);
      expiry = Math.min(expiry, f + (p.manufacturing_days + p.shelf_life_days) * DAY);
    }
    inst.units.set(order.order_id, units);
    inst.departure.set(order.order_id, f + (1 + maxManufacturing) * DAY + 8 * HOUR);
    inst.deadline.set(order.order_id, expiry + 23 * HOUR + 59 * 60_000);
    inst.destination.set(order.order_id, order.destination_id);
  }
  return inst;
}

/** Elapsed hours to drive `drivingHours` with one driver (Regulation (EC) 561/2006), or the same hours without a limit. */
export function withRestBreaks(fleet: FleetConfig, drivingHours: number): number {
  const max = fleet.max_driving_hours;
  if (max == null) return drivingHours;
  const days = Math.floor(drivingHours / max);
  const remainder = drivingHours - days * max;
  const breaks = days + Math.floor(remainder / 4.5);
  return drivingHours + days * 11 + breaks * 0.75;
}

/** Feasibility, round-trip km and arrival time at each stop of a route (Python: Instance.evaluate). */
export function evaluate(inst: Instance, route: string[]): Evaluation {
  if (route.length === 0) return { ok: true, km: 0, arrivals: [] };
  let load = 0;
  for (const o of route) load += inst.units.get(o)!;
  if (load > inst.fleet.capacity_units) return { ok: false, km: Infinity, arrivals: [] };
  let departure = -Infinity;
  for (const o of route) departure = Math.max(departure, inst.departure.get(o)!);
  let previous = DEPOT;
  let km = 0;
  const arrivals: number[] = [];
  for (const o of route) {
    km += inst.dist(previous, inst.destination.get(o)!);
    const arrival = departure + withRestBreaks(inst.fleet, km / inst.fleet.speed_kmh) * HOUR;
    if (arrival > inst.deadline.get(o)!) return { ok: false, km: Infinity, arrivals: [] };
    arrivals.push(arrival);
    previous = inst.destination.get(o)!;
  }
  km += inst.dist(previous, DEPOT);
  return { ok: true, km, arrivals };
}

/** ERR-04 (does not fit in a truck) and ERR-05 (would expire even on a direct route). */
export function infeasibleOrders(inst: Instance): Map<string, InfeasibleReason> {
  const result = new Map<string, InfeasibleReason>();
  for (const o of inst.orderIds) {
    if (inst.units.get(o)! > inst.fleet.capacity_units) result.set(o, 'does_not_fit');
    else if (!evaluate(inst, [o]).ok) result.set(o, 'would_expire');
  }
  return result;
}

export function truckLowerBound(inst: Instance, feasible: string[]): number {
  let units = 0;
  for (const o of feasible) units += inst.units.get(o)!;
  return Math.ceil(units / inst.fleet.capacity_units);
}

/** Savings algorithm (reference solution). */
export function clarkeWright(inst: Instance, feasible: string[]): string[][] {
  const d = inst.dist;
  const dest = inst.destination;
  const routeOf = new Map<string, string[]>(feasible.map((o) => [o, [o]]));
  const savings: [number, string, string][] = [];
  for (let a = 0; a < feasible.length; a++) {
    const i = feasible[a];
    for (let b = a + 1; b < feasible.length; b++) {
      const j = feasible[b];
      const s = d(DEPOT, dest.get(i)!) + d(DEPOT, dest.get(j)!) - d(dest.get(i)!, dest.get(j)!);
      if (s > 0) savings.push([s, i, j]);
    }
  }
  savings.sort((x, y) => y[0] - x[0]);
  for (const [, i, j] of savings) {
    const ri = routeOf.get(i)!;
    const rj = routeOf.get(j)!;
    if (ri === rj) continue;
    const candidates: string[][] = [];
    if (ri[ri.length - 1] === i && rj[0] === j) candidates.push([...ri, ...rj]);
    if (rj[rj.length - 1] === j && ri[0] === i) candidates.push([...rj, ...ri]);
    if (ri[0] === i && rj[0] === j) candidates.push([...ri].reverse().concat(rj));
    if (ri[ri.length - 1] === i && rj[rj.length - 1] === j) candidates.push([...ri, ...[...rj].reverse()]);
    let best: { km: number; route: string[] } | null = null;
    for (const c of candidates) {
      const e = evaluate(inst, c);
      if (e.ok && (best === null || e.km < best.km)) best = { km: e.km, route: c };
    }
    if (best) for (const o of best.route) routeOf.set(o, best.route);
  }
  const unique: string[][] = [];
  const seen = new Set<string[]>();
  for (const r of routeOf.values()) {
    if (!seen.has(r)) {
      seen.add(r);
      unique.push(r);
    }
  }
  return unique;
}

/** Small seeded PRNG (mulberry32) so mock runs are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simulated annealing over relocate, swap and 2-opt moves (same moves as the Python core).
 * `onProgress` is called with a 0-1 fraction of the time budget.
 */
export function simulatedAnnealing(
  inst: Instance,
  initial: string[][],
  seconds: number,
  seed = 1,
  onProgress?: (fraction: number) => void,
  now: () => number = () => performance.now(),
): string[][] {
  const rnd = mulberry32(seed);
  const pick = (n: number) => Math.floor(rnd() * n);
  let routes = initial.filter((r) => r.length).map((r) => [...r]);
  let km = routes.map((r) => evaluate(inst, r).km);
  let current = TRUCK_WEIGHT * routes.length + km.reduce((a, b) => a + b, 0);
  let best = current;
  let bestRoutes = routes.map((r) => [...r]);
  let t = 2000;
  const start = now();
  const end = start + seconds * 1000;
  let iterations = 0;
  while (routes.length > 1) {
    if ((++iterations & 255) === 0) {
      const time = now();
      if (time >= end) break;
      onProgress?.((time - start) / (end - start));
    }
    const move = rnd();
    const a = pick(routes.length);
    let changes: Map<number, string[]>;
    if (move < 0.5) {
      let b = pick(routes.length - 1);
      if (b >= a) b++;
      const k = pick(routes[a].length);
      const newA = [...routes[a].slice(0, k), ...routes[a].slice(k + 1)];
      const pos = pick(routes[b].length + 1);
      const newB = [...routes[b].slice(0, pos), routes[a][k], ...routes[b].slice(pos)];
      changes = new Map([
        [a, newA],
        [b, newB],
      ]);
    } else if (move < 0.8) {
      let b = pick(routes.length - 1);
      if (b >= a) b++;
      const i = pick(routes[a].length);
      const j = pick(routes[b].length);
      const newA = [...routes[a]];
      const newB = [...routes[b]];
      [newA[i], newB[j]] = [newB[j], newA[i]];
      changes = new Map([
        [a, newA],
        [b, newB],
      ]);
    } else {
      const r = routes[a];
      if (r.length < 3) continue;
      let i = pick(r.length);
      let j = pick(r.length - 1);
      if (j >= i) j++;
      if (i > j) [i, j] = [j, i];
      changes = new Map([[a, [...r.slice(0, i), ...r.slice(i, j + 1).reverse(), ...r.slice(j + 1)]]]);
    }
    const newKm = new Map<number, number>();
    let ok = true;
    for (const [k, r] of changes) {
      const e = evaluate(inst, r);
      if (!e.ok) {
        ok = false;
        break;
      }
      newKm.set(k, e.km);
    }
    if (ok) {
      let delta = 0;
      for (const k of changes.keys()) delta += newKm.get(k)! - km[k];
      for (const r of changes.values()) if (r.length === 0) delta -= TRUCK_WEIGHT;
      if (delta < 0 || rnd() < Math.exp(-delta / Math.max(t, 1e-9))) {
        for (const [k, r] of changes) {
          routes[k] = r;
          km[k] = newKm.get(k)!;
        }
        if (routes.some((r) => r.length === 0)) {
          const keep = routes.map((r) => r.length > 0);
          routes = routes.filter((_, k) => keep[k]);
          km = km.filter((_, k) => keep[k]);
        }
        current += delta;
        if (current < best - 1e-9) {
          best = current;
          bestRoutes = routes.map((r) => [...r]);
        }
      }
    }
    t *= 0.9995;
  }
  onProgress?.(1);
  return bestRoutes;
}

/** Independent validator (RNF-04): capacity, expiry and single assignment. Returns error codes. */
export function validateSolution(inst: Instance, routes: string[][], feasible: string[]): string[] {
  const errors: string[] = [];
  const seen: string[] = [];
  routes.forEach((r, n) => {
    let load = 0;
    for (const o of r) load += inst.units.get(o)!;
    if (load > inst.fleet.capacity_units) errors.push(`truck ${n + 1}: capacity`);
    else if (!evaluate(inst, r).ok) errors.push(`truck ${n + 1}: expiry`);
    seen.push(...r);
  });
  if ([...seen].sort().join() !== [...feasible].sort().join()) errors.push('assignment');
  return errors;
}
