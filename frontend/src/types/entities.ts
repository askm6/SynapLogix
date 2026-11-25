/**
 * Entities of the data model (section 4.4 of the project report), in snake_case exactly as the
 * FastAPI backend serializes them. Zod schemas validate imported files and API responses;
 * the TypeScript types are inferred from them so there is a single source of truth.
 */
import { z } from 'zod';

export const productSchema = z.object({
  product_id: z.string().min(1),
  name: z.string().min(1),
  sale_price: z.number().nonnegative(),
  manufacturing_days: z.number().int().nonnegative(),
  shelf_life_days: z.number().int().positive(),
});
export type Product = z.infer<typeof productSchema>;

export const destinationSchema = z.object({
  destination_id: z.string().min(1),
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  km_from_mataro: z.number().nonnegative().nullable(),
});
export type Destination = z.infer<typeof destinationSchema>;

export const scenarioTypeSchema = z.enum(['training', 'real']);
export const scenarioSchema = z.object({
  scenario_id: z.string().min(1),
  name: z.string().min(1),
  type: scenarioTypeSchema,
  seed: z.number().int().nullable(),
  created_at: z.string(),
});
export type Scenario = z.infer<typeof scenarioSchema>;

export const orderSchema = z.object({
  order_id: z.string().min(1),
  scenario_id: z.string().min(1),
  order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customer_id: z.string().min(1),
  destination_id: z.string().min(1),
});
export type Order = z.infer<typeof orderSchema>;

export const orderLineSchema = z.object({
  order_id: z.string().min(1),
  product_id: z.string().min(1),
  quantity: z.number().int().positive(),
});
export type OrderLine = z.infer<typeof orderLineSchema>;

export const fleetConfigSchema = z.object({
  fleet_id: z.string().min(1),
  capacity_units: z.number().int().positive(),
  speed_kmh: z.number().positive(),
  cost_per_km: z.number().positive(),
  max_driving_hours: z.number().positive().nullable(),
});
export type FleetConfig = z.infer<typeof fleetConfigSchema>;

export const algorithmSchema = z.enum(['clarke_wright', 'ortools', 'metaheuristic']);
export type Algorithm = z.infer<typeof algorithmSchema>;

export const runSchema = z.object({
  run_id: z.string().min(1),
  scenario_id: z.string().min(1),
  fleet_id: z.string().min(1),
  algorithm: algorithmSchema,
  n_trucks: z.number().int().nonnegative(),
  total_km: z.number().nonnegative(),
  total_cost: z.number().nonnegative(),
  computation_time_s: z.number().nonnegative(),
  created_at: z.string(),
});
export type Run = z.infer<typeof runSchema>;

export const routeSchema = z.object({
  route_id: z.string().min(1),
  run_id: z.string().min(1),
  truck_number: z.number().int().positive(),
  km: z.number().nonnegative(),
  duration_h: z.number().nonnegative(),
  units: z.number().int().nonnegative(),
  load_factor: z.number().min(0).max(1),
});
export type Route = z.infer<typeof routeSchema>;

export const stopSchema = z.object({
  route_id: z.string().min(1),
  stop_order: z.number().int().positive(),
  destination_id: z.string().min(1),
  order_id: z.string().min(1),
  estimated_arrival: z.string(),
  expiry_margin_h: z.number(),
});
export type Stop = z.infer<typeof stopSchema>;
