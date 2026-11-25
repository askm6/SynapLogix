/**
 * Simulator model: each truck follows Mataró → stops → Mataró, with its departure, the estimated
 * arrival at each stop and its return taken from the solution. Between two points the position is
 * interpolated linearly in time (driving pauses and rests are spread over the segment).
 */
import type { RouteDetail } from '@/types/api';
import type { Destination, Stop } from '@/types/entities';

export interface TimelinePoint {
  t: number;
  lat: number;
  lon: number;
  /** Index of the stop in the route (0-based), or null for the depot. */
  stop: number | null;
}

export interface Timeline {
  route: RouteDetail;
  stops: Stop[];
  points: TimelinePoint[];
}

export type TruckStatus = 'waiting' | 'driving' | 'returning' | 'done';

export interface TruckState {
  lat: number;
  lon: number;
  status: TruckStatus;
  /** Stops already reached at this time. */
  delivered: number;
  /** Next stop to reach, if any. */
  next: Stop | null;
}

/** Naive API date-time → milliseconds (read as UTC so no time zone shift is applied). */
export const toMs = (iso: string) => Date.parse(`${iso.slice(0, 19)}Z`);

export function buildTimelines(
  routes: RouteDetail[],
  stops: Stop[],
  destinations: Destination[],
  depotId = 'D000',
): Timeline[] {
  const coords = new Map(destinations.map((d) => [d.destination_id, d]));
  const depot = coords.get(depotId);
  const byRoute = new Map<string, Stop[]>();
  for (const s of stops) {
    const list = byRoute.get(s.route_id);
    if (list) list.push(s);
    else byRoute.set(s.route_id, [s]);
  }
  return routes.map((route) => {
    const routeStops = (byRoute.get(route.route_id) ?? []).sort((a, b) => a.stop_order - b.stop_order);
    const point = (id: string, t: number, stop: number | null): TimelinePoint => {
      const d = coords.get(id) ?? depot;
      return { t, lat: d?.latitude ?? 0, lon: d?.longitude ?? 0, stop };
    };
    return {
      route,
      stops: routeStops,
      points: [
        point(depotId, toMs(route.departure_at), null),
        ...routeStops.map((s, i) => point(s.destination_id, toMs(s.estimated_arrival), i)),
        point(depotId, toMs(route.return_at), null),
      ],
    };
  });
}

export function truckStateAt(timeline: Timeline, t: number): TruckState {
  const { points, stops } = timeline;
  const first = points[0];
  const last = points[points.length - 1];
  if (t <= first.t)
    return { lat: first.lat, lon: first.lon, status: 'waiting', delivered: 0, next: stops[0] ?? null };
  if (t >= last.t)
    return { lat: last.lat, lon: last.lon, status: 'done', delivered: stops.length, next: null };
  let i = 0;
  while (i < points.length - 2 && points[i + 1].t <= t) i++;
  const a = points[i];
  const b = points[i + 1];
  const span = b.t - a.t;
  const k = span > 0 ? (t - a.t) / span : 1;
  const delivered = points.slice(1, i + 1).filter((p) => p.stop !== null).length;
  return {
    lat: a.lat + (b.lat - a.lat) * k,
    lon: a.lon + (b.lon - a.lon) * k,
    status: b.stop === null ? 'returning' : 'driving',
    delivered,
    next: b.stop === null ? null : stops[b.stop],
  };
}

export function simulationBounds(timelines: Timeline[]): { start: number; end: number } {
  let start = Infinity;
  let end = -Infinity;
  for (const tl of timelines) {
    start = Math.min(start, tl.points[0].t);
    end = Math.max(end, tl.points[tl.points.length - 1].t);
  }
  return Number.isFinite(start) ? { start, end } : { start: 0, end: 0 };
}

/** Distinct, evenly spread colors per route (golden-angle hues). */
export function routeColor(index: number): string {
  return `hsl(${Math.round((205 + index * 137.508) % 360)} 78% 58%)`;
}
