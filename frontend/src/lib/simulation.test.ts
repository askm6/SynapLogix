import { describe, expect, it } from 'vitest';
import type { RouteDetail } from '@/types/api';
import type { Destination, Stop } from '@/types/entities';
import { buildTimelines, simulationBounds, toMs, truckStateAt } from './simulation';
import { kpisCsv, routesCsv, toCsv } from './csv';

const destinations: Destination[] = [
  { destination_id: 'D000', name: 'Mataró', latitude: 41.5, longitude: 2.4, km_from_mataro: null },
  { destination_id: 'D001', name: 'A', latitude: 41.5, longitude: 0.4, km_from_mataro: null },
  { destination_id: 'D002', name: 'B; "quoted"', latitude: 40.5, longitude: 0.4, km_from_mataro: null },
];
const route: RouteDetail = {
  route_id: 'R1',
  run_id: 'RUN1',
  truck_number: 1,
  km: 400,
  duration_h: 6,
  units: 100,
  load_factor: 0.5,
  departure_at: '2026-11-14T08:00:00',
  return_at: '2026-11-14T14:00:00',
};
const stops: Stop[] = [
  {
    route_id: 'R1',
    stop_order: 2,
    destination_id: 'D002',
    order_id: 'O2',
    estimated_arrival: '2026-11-14T11:00:00',
    expiry_margin_h: 20,
  },
  {
    route_id: 'R1',
    stop_order: 1,
    destination_id: 'D001',
    order_id: 'O1',
    estimated_arrival: '2026-11-14T10:00:00',
    expiry_margin_h: 30,
  },
];

describe('simulator', () => {
  const [timeline] = buildTimelines([route], stops, destinations);

  it('orders the stops and starts and ends in Mataró', () => {
    expect(timeline.points.map((p) => p.stop)).toEqual([null, 0, 1, null]);
    expect(timeline.stops.map((s) => s.order_id)).toEqual(['O1', 'O2']);
    expect(simulationBounds([timeline])).toEqual({
      start: toMs(route.departure_at),
      end: toMs(route.return_at),
    });
  });

  it('interpolates the truck position and status over time', () => {
    const start = toMs(route.departure_at);
    expect(truckStateAt(timeline, start - 1).status).toBe('waiting');
    const halfway = truckStateAt(timeline, start + 3_600_000); // 09:00, halfway to the first stop
    expect(halfway.status).toBe('driving');
    expect(halfway.lon).toBeCloseTo(1.4);
    expect(halfway.next?.order_id).toBe('O1');
    const afterSecond = truckStateAt(timeline, toMs('2026-11-14T12:00:00'));
    expect(afterSecond).toMatchObject({ status: 'returning', delivered: 2, next: null });
    expect(truckStateAt(timeline, toMs(route.return_at) + 1).status).toBe('done');
  });
});

describe('CSV export (RF-14)', () => {
  it('escapes separators and quotes', () => {
    expect(toCsv([['a;b', 'say "hi"', 3]])).toBe('"a;b";"say ""hi""";3\r\n');
  });

  it('writes one row per stop and the KPIs shown in the interface', () => {
    const detail = {
      run: {
        run_id: 'RUN1',
        scenario_id: 'S1',
        fleet_id: 'F1',
        algorithm: 'clarke_wright' as const,
        n_trucks: 1,
        total_km: 400,
        total_cost: 440,
        computation_time_s: 0.01,
        created_at: '2026-11-13T09:00:00',
      },
      status: 'done' as const,
      progress: 1,
      scenario_name: 'S1',
      fleet: {
        fleet_id: 'F1',
        capacity_units: 200,
        speed_kmh: 70,
        cost_per_km: 1.1,
        max_driving_hours: null,
      },
      kpis: {
        total_hours: 6,
        avg_load_factor: 0.5,
        avg_expiry_margin_h: 25,
        orders_served: 2,
        orders_infeasible: 1,
        lower_bound: 1,
      },
      routes: [route],
      stops,
      infeasible: [{ order_id: 'O3', destination_id: 'D001', units: 999, reason: 'does_not_fit' as const }],
    };
    const routesFile = routesCsv(detail, destinations).trim().split('\r\n');
    expect(routesFile).toHaveLength(3);
    expect(routesFile[2]).toContain('"B; ""quoted"""');
    const kpis = kpisCsv(detail);
    expect(kpis).toContain('n_trucks;1');
    expect(kpis).toContain('total_cost;440');
    expect(kpis).toContain('infeasible:O3;does_not_fit');
  });
});
