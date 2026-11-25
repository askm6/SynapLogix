/**
 * Runs one optimization end to end (section 4.3 steps 3-6) and returns the entities the API would
 * return: routes, stops, infeasible orders and KPIs. Shared by the Web Worker and the unit tests.
 */
import type { Algorithm } from '@/types/entities';
import type { InfeasibleOrder, RouteDetail, RunKpis } from '@/types/api';
import type { Stop } from '@/types/entities';
import {
  buildInstance,
  clarkeWright,
  evaluate,
  infeasibleOrders,
  simulatedAnnealing,
  truckLowerBound,
  validateSolution,
  withRestBreaks,
  type SolverInput,
} from './core';

export interface SolveRequest extends SolverInput {
  run_id: string;
  algorithm: Algorithm;
  time_limit_s: number;
  seed: number;
}

export interface SolveResult {
  routes: RouteDetail[];
  stops: Stop[];
  infeasible: InfeasibleOrder[];
  kpis: RunKpis;
  n_trucks: number;
  total_km: number;
  total_cost: number;
  computation_time_s: number;
  validation_errors: string[];
}

const HOUR = 3_600_000;
const round = (x: number, digits: number) => Math.round(x * 10 ** digits) / 10 ** digits;

/** Naive ISO date-time (no time zone), as the backend serializes Python datetimes. */
export const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 19);

export function solve(request: SolveRequest, onProgress: (fraction: number) => void = () => {}): SolveResult {
  const started = performance.now();
  const inst = buildInstance(request);
  const infeasible = infeasibleOrders(inst);
  const feasible = inst.orderIds.filter((o) => !infeasible.has(o));
  onProgress(0.02);
  let routes = clarkeWright(inst, feasible);
  if (request.algorithm === 'clarke_wright') {
    onProgress(1);
  } else {
    // The time budget leaves room for building the result; the progress maps to 5-100 %.
    routes = simulatedAnnealing(inst, routes, request.time_limit_s, request.seed, (f) =>
      onProgress(0.05 + 0.95 * f),
    );
  }
  const validationErrors = validateSolution(inst, routes, feasible);

  const routeRows: RouteDetail[] = [];
  const stops: Stop[] = [];
  let totalKm = 0;
  let totalHours = 0;
  let loadSum = 0;
  let marginSum = 0;
  routes.forEach((route, index) => {
    const { km, arrivals } = evaluate(inst, route);
    const units = route.reduce((sum, o) => sum + inst.units.get(o)!, 0);
    const duration = withRestBreaks(inst.fleet, km / inst.fleet.speed_kmh);
    const departure = Math.max(...route.map((o) => inst.departure.get(o)!));
    const routeId = `${request.run_id}-R${String(index + 1).padStart(3, '0')}`;
    routeRows.push({
      route_id: routeId,
      run_id: request.run_id,
      truck_number: index + 1,
      km: round(km, 1),
      duration_h: round(duration, 1),
      units,
      load_factor: round(units / inst.fleet.capacity_units, 3),
      departure_at: toIso(departure),
      return_at: toIso(departure + duration * HOUR),
    });
    route.forEach((orderId, k) => {
      const margin = (inst.deadline.get(orderId)! - arrivals[k]) / HOUR;
      marginSum += margin;
      stops.push({
        route_id: routeId,
        stop_order: k + 1,
        destination_id: inst.destination.get(orderId)!,
        order_id: orderId,
        estimated_arrival: toIso(arrivals[k]),
        expiry_margin_h: round(margin, 1),
      });
    });
    totalKm += km;
    totalHours += duration;
    loadSum += units / inst.fleet.capacity_units;
  });

  const n = routes.length;
  return {
    routes: routeRows,
    stops,
    infeasible: [...infeasible].map(([order_id, reason]) => ({
      order_id,
      reason,
      destination_id: inst.destination.get(order_id)!,
      units: inst.units.get(order_id)!,
    })),
    kpis: {
      total_hours: round(totalHours, 1),
      avg_load_factor: n ? round(loadSum / n, 3) : 0,
      avg_expiry_margin_h: stops.length ? round(marginSum / stops.length, 1) : 0,
      orders_served: stops.length,
      orders_infeasible: infeasible.size,
      lower_bound: truckLowerBound(inst, feasible),
    },
    n_trucks: n,
    total_km: round(totalKm, 1),
    total_cost: round(totalKm * inst.fleet.cost_per_km, 2),
    computation_time_s: round((performance.now() - started) / 1000, 3),
    validation_errors: validationErrors,
  };
}
