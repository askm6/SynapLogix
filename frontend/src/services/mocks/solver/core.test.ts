/**
 * The TypeScript port must reproduce the Python core on scenario S1: same infeasible orders and,
 * for the deterministic Clarke-Wright, the same routes and KPIs (reference_s1.json is written by the
 * Python core with scripts/build_mock_fixtures.py; rerun it whenever data/destinations.csv changes).
 */
import { describe, expect, it } from 'vitest';
import type { Destination, FleetConfig, Order, OrderLine, Product } from '@/types/entities';
import destinations from '../fixtures/destinations.json';
import products from '../fixtures/products.json';
import s1 from '../fixtures/scenario_s1.json';
import reference from '../fixtures/reference_s1.json';
import {
  buildInstance,
  clarkeWright,
  evaluate,
  haversineKm,
  infeasibleOrders,
  validateSolution,
} from './core';
import { solve } from './solve';

const fleet: FleetConfig = { fleet_id: 'F001', ...reference.fleet };
const input = {
  orders: s1.orders as Order[],
  lines: s1.order_lines as OrderLine[],
  products: products as Product[],
  destinations: destinations as Destination[],
  fleet,
};

describe('mock solver (port of backend/synaplogix)', () => {
  it('computes Haversine distances (PU-09: Mataró-Madrid about 500 km)', () => {
    expect(haversineKm(41.5381, 2.4447, 40.4168, -3.7038)).toBeGreaterThan(500);
    expect(haversineKm(41.5381, 2.4447, 40.4168, -3.7038)).toBeLessThan(540);
  });

  it('marks the same infeasible orders as the Python core', () => {
    const inst = buildInstance(input);
    const infeasible = Object.fromEntries(
      [...infeasibleOrders(inst)].map(([id, reason]) => [id, reason.replace('_', ' ')]),
    );
    expect(infeasible).toEqual(reference.infeasible);
  });

  it('reproduces Clarke-Wright on S1 (same routes, km and cost)', () => {
    const inst = buildInstance(input);
    const infeasible = infeasibleOrders(inst);
    const feasible = inst.orderIds.filter((o) => !infeasible.has(o));
    const routes = clarkeWright(inst, feasible);
    // JavaScript and Python can differ in the last digit of sin/cos, which may flip an exact tie
    // between a route and its reverse (same stops, same km). Compare routes regardless of direction.
    const canonical = (rs: string[][]) =>
      rs.map((r) => [r.join('>'), [...r].reverse().join('>')].sort()[0]).sort();
    expect(canonical(routes)).toEqual(canonical(reference.routes));
    const km = routes.reduce((sum, r) => sum + evaluate(inst, r).km, 0);
    expect(Math.round(km * 10) / 10).toBe(reference.clarke_wright.km);
    expect(validateSolution(inst, routes, feasible)).toEqual([]);
  });

  it('builds a valid result with KPIs that match the Python core', () => {
    const result = solve({
      ...input,
      run_id: 'RUN0001',
      algorithm: 'clarke_wright',
      time_limit_s: 1,
      seed: 101,
    });
    expect(result.n_trucks).toBe(reference.clarke_wright.trucks);
    expect(result.total_cost).toBe(reference.clarke_wright.cost);
    expect(result.kpis.orders_served).toBe(reference.clarke_wright.orders);
    expect(result.kpis.avg_load_factor).toBe(reference.clarke_wright.load_factor);
    expect(result.validation_errors).toEqual([]);
    expect(result.stops.every((s) => s.expiry_margin_h >= 0)).toBe(true);
  });

  it('never makes the reference worse with the metaheuristic', () => {
    const result = solve({
      ...input,
      run_id: 'RUN0002',
      algorithm: 'metaheuristic',
      time_limit_s: 1,
      seed: 101,
    });
    expect(result.n_trucks).toBeLessThanOrEqual(reference.clarke_wright.trucks);
    expect(result.validation_errors).toEqual([]);
  });
});
