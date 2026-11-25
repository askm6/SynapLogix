/**
 * Row-by-row validation of imported files (RF-04, ERR-01 to ERR-03). Every error points to the
 * file row (the header is row 1) and the field, so the user can fix the file. The API validates
 * again on import; this check gives immediate feedback before anything is sent.
 */
import type { Destination, Order, OrderLine, Product } from '@/types/entities';
import type { DatasetKind, RowError } from '@/types/api';

export type RawRow = Record<string, string>;

export const COLUMNS: Record<DatasetKind, string[]> = {
  products: ['product_id', 'name', 'sale_price', 'manufacturing_days', 'shelf_life_days'],
  destinations: ['destination_id', 'name', 'latitude', 'longitude'],
  orders: ['order_id', 'order_date', 'customer_id', 'destination_id'],
  order_lines: ['order_id', 'product_id', 'quantity'],
};

export interface Validated<T> {
  rows: T[];
  errors: RowError[];
}

interface Context {
  productIds?: Set<string>;
  destinationIds?: Set<string>;
  orderIds?: Set<string>;
}

const FIRST_DATA_ROW = 2;

function missingColumns(kind: DatasetKind, header: string[]): RowError[] {
  return COLUMNS[kind]
    .filter((column) => !header.includes(column))
    .map((column) => ({ row: 1, field: column, code: 'missing_column' as const }));
}

/** Reads one row with helpers that record errors instead of throwing. */
function reader(raw: RawRow, row: number, errors: RowError[]) {
  const text = (field: string): string => {
    const value = (raw[field] ?? '').trim();
    if (!value) errors.push({ row, field, code: 'empty' });
    return value;
  };
  const number = (field: string, { integer = false, positive = false, nonNegative = false } = {}): number => {
    const value = text(field);
    if (!value) return NaN;
    const n = Number(value);
    if (!Number.isFinite(n) || (integer && !Number.isInteger(n))) {
      errors.push({ row, field, code: 'invalid_number', value });
      return NaN;
    }
    if ((positive && n <= 0) || (nonNegative && n < 0))
      errors.push({ row, field, code: 'not_positive', value });
    return n;
  };
  const date = (field: string): string => {
    const value = text(field);
    if (!value) return value;
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
    // Date.parse accepts 2026-02-31; check the round trip to reject impossible dates.
    if (!ok || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
      errors.push({ row, field, code: 'invalid_date', value });
    }
    return value;
  };
  return { text, number, date };
}

function check<T>(
  kind: DatasetKind,
  header: string[],
  raws: RawRow[],
  parse: (r: ReturnType<typeof reader>, raw: RawRow, row: number, errors: RowError[]) => T,
  key: (item: T) => string,
): Validated<T> {
  const errors = missingColumns(kind, header);
  if (errors.length) return { rows: [], errors };
  const rows: T[] = [];
  const seen = new Set<string>();
  raws.forEach((raw, index) => {
    const row = index + FIRST_DATA_ROW;
    const before = errors.length;
    const item = parse(reader(raw, row, errors), raw, row, errors);
    const k = key(item);
    if (k && seen.has(k)) errors.push({ row, field: COLUMNS[kind][0], code: 'duplicate', value: k });
    seen.add(k);
    if (errors.length === before) rows.push(item);
  });
  return { rows, errors };
}

export function validateProducts(header: string[], raws: RawRow[]): Validated<Product> {
  return check(
    'products',
    header,
    raws,
    (r) => ({
      product_id: r.text('product_id'),
      name: r.text('name'),
      sale_price: r.number('sale_price', { nonNegative: true }),
      manufacturing_days: r.number('manufacturing_days', { integer: true, nonNegative: true }),
      shelf_life_days: r.number('shelf_life_days', { integer: true, positive: true }),
    }),
    (p) => p.product_id,
  );
}

export function validateDestinations(header: string[], raws: RawRow[]): Validated<Destination> {
  return check(
    'destinations',
    header,
    raws,
    (r, raw) => ({
      destination_id: r.text('destination_id'),
      name: r.text('name'),
      latitude: r.number('latitude'),
      longitude: r.number('longitude'),
      km_from_mataro: raw.km_from_mataro?.trim() ? Number(raw.km_from_mataro) : null,
    }),
    (d) => d.destination_id,
  );
}

export function validateOrders(
  header: string[],
  raws: RawRow[],
  ctx: Context,
): Validated<Omit<Order, 'scenario_id'>> {
  return check(
    'orders',
    header,
    raws,
    (r, _raw, row, errors) => {
      const order = {
        order_id: r.text('order_id'),
        order_date: r.date('order_date'),
        customer_id: r.text('customer_id'),
        destination_id: r.text('destination_id'),
      };
      if (order.destination_id && ctx.destinationIds && !ctx.destinationIds.has(order.destination_id)) {
        errors.push({ row, field: 'destination_id', code: 'unknown_id', value: order.destination_id });
      }
      return order;
    },
    (o) => o.order_id,
  );
}

export function validateOrderLines(header: string[], raws: RawRow[], ctx: Context): Validated<OrderLine> {
  return check(
    'order_lines',
    header,
    raws,
    (r, _raw, row, errors) => {
      const line = {
        order_id: r.text('order_id'),
        product_id: r.text('product_id'),
        quantity: r.number('quantity', { integer: true, positive: true }),
      };
      if (line.order_id && ctx.orderIds && !ctx.orderIds.has(line.order_id)) {
        errors.push({ row, field: 'order_id', code: 'unknown_id', value: line.order_id });
      }
      if (line.product_id && ctx.productIds && !ctx.productIds.has(line.product_id)) {
        errors.push({ row, field: 'product_id', code: 'unknown_id', value: line.product_id });
      }
      return line;
    },
    // The primary key of order_lines is (order_id, product_id).
    (l) => (l.order_id && l.product_id ? `${l.order_id}|${l.product_id}` : ''),
  );
}
