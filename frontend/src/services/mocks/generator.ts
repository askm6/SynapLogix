/**
 * Synthetic scenario generator for mock mode (RF-05), following backend/synaplogix/data.py:
 * mean_lines ± 50 % lines per order, 1 to max_units units per line, order date on the reference
 * date or the day before, 120 customers and a random destination. Same seed, same scenario.
 * It uses its own PRNG, so a seed does not produce the same orders as the Python generator.
 */
import type { Destination, Order, OrderLine, Product } from '@/types/entities';
import { DEPOT, mulberry32 } from './solver/core';

export const REFERENCE_DATE = '2026-11-12';

export function generateOrders(
  scenarioId: string,
  nOrders: number,
  meanLines: number,
  maxUnits: number,
  seed: number,
  destinations: Destination[],
  products: Product[],
): { orders: Order[]; order_lines: OrderLine[] } {
  const rnd = mulberry32(seed);
  const randint = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const destinationIds = destinations.map((d) => d.destination_id).filter((id) => id !== DEPOT);
  const productIds = products.map((p) => p.product_id);
  const orders: Order[] = [];
  const order_lines: OrderLine[] = [];
  const reference = Date.UTC(2026, 10, 12);
  for (let i = 1; i <= nOrders; i++) {
    const orderId = `ORD${String(i).padStart(4, '0')}`;
    const nLines = Math.max(1, Math.min(productIds.length, Math.round((0.5 + rnd()) * meanLines)));
    // Partial Fisher-Yates: the first nLines products of a shuffled copy, without repetition.
    const pool = [...productIds];
    for (let k = 0; k < nLines; k++) {
      const j = k + Math.floor(rnd() * (pool.length - k));
      [pool[k], pool[j]] = [pool[j], pool[k]];
      order_lines.push({ order_id: orderId, product_id: pool[k], quantity: randint(1, maxUnits) });
    }
    const date = new Date(reference - randint(0, 1) * 86_400_000).toISOString().slice(0, 10);
    orders.push({
      order_id: orderId,
      scenario_id: scenarioId,
      order_date: date,
      customer_id: `C${String(randint(1, 120)).padStart(3, '0')}`,
      destination_id: destinationIds[Math.floor(rnd() * destinationIds.length)],
    });
  }
  return { orders, order_lines };
}
