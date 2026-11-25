/**
 * CSV export of a run (RF-14, CU-08). Same format as the input files: ";" separator and dot decimals,
 * so the numbers match what the interface shows (CA-07) and the files reopen in any tool.
 */
import type { RunDetail } from '@/types/api';
import type { Destination } from '@/types/entities';

type Cell = string | number | null | undefined;

export function toCsv(rows: Cell[][]): string {
  const escape = (value: Cell) => {
    const text = value == null ? '' : String(value);
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((row) => row.map(escape).join(';')).join('\r\n') + '\r\n';
}

export function routesCsv(detail: RunDetail, destinations: Destination[]): string {
  const names = new Map(destinations.map((d) => [d.destination_id, d.name]));
  const routes = new Map(detail.routes.map((r) => [r.route_id, r]));
  const header = [
    'run_id',
    'truck_number',
    'route_km',
    'route_duration_h',
    'route_units',
    'load_factor',
    'departure_at',
    'return_at',
    'stop_order',
    'order_id',
    'destination_id',
    'destination_name',
    'estimated_arrival',
    'expiry_margin_h',
  ];
  // Same order as the interface: by truck, then by stop.
  const ordered = [...detail.stops].sort(
    (a, b) =>
      routes.get(a.route_id)!.truck_number - routes.get(b.route_id)!.truck_number ||
      a.stop_order - b.stop_order,
  );
  const rows = ordered.map((s) => {
    const r = routes.get(s.route_id)!;
    return [
      detail.run.run_id,
      r.truck_number,
      r.km,
      r.duration_h,
      r.units,
      r.load_factor,
      r.departure_at,
      r.return_at,
      s.stop_order,
      s.order_id,
      s.destination_id,
      names.get(s.destination_id) ?? '',
      s.estimated_arrival,
      s.expiry_margin_h,
    ];
  });
  return toCsv([header, ...rows]);
}

export function kpisCsv(detail: RunDetail): string {
  const { run, kpis, fleet } = detail;
  const rows: Cell[][] = [
    ['metric', 'value'],
    ['run_id', run.run_id],
    ['scenario', detail.scenario_name],
    ['algorithm', run.algorithm],
    ['capacity_units', fleet.capacity_units],
    ['speed_kmh', fleet.speed_kmh],
    ['cost_per_km', fleet.cost_per_km],
    ['max_driving_hours', fleet.max_driving_hours],
    ['n_trucks', run.n_trucks],
    ['lower_bound', kpis?.lower_bound],
    ['total_km', run.total_km],
    ['total_cost', run.total_cost],
    ['total_hours', kpis?.total_hours],
    ['avg_load_factor', kpis?.avg_load_factor],
    ['avg_expiry_margin_h', kpis?.avg_expiry_margin_h],
    ['orders_served', kpis?.orders_served],
    ['orders_infeasible', kpis?.orders_infeasible],
    ['computation_time_s', run.computation_time_s],
  ];
  for (const o of detail.infeasible) rows.push([`infeasible:${o.order_id}`, o.reason]);
  return toCsv(rows);
}

export function downloadText(filename: string, content: string): void {
  // The BOM lets Excel detect UTF-8 (accents in destination names).
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
