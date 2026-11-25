/** PU-03 and E5: invalid rows are rejected with their row number, field and reason. */
import { describe, expect, it } from 'vitest';
import { COLUMNS, validateOrderLines, validateOrders, validateProducts } from './validation';

describe('import validation', () => {
  it('rejects a file with missing columns (ERR-01)', () => {
    const result = validateProducts(['product_id', 'name'], []);
    expect(result.errors.map((e) => e.field)).toEqual([
      'sale_price',
      'manufacturing_days',
      'shelf_life_days',
    ]);
    expect(result.errors.every((e) => e.code === 'missing_column' && e.row === 1)).toBe(true);
  });

  it('reports empty fields, invalid numbers and non-positive values with their row', () => {
    const result = validateProducts(COLUMNS.products, [
      {
        product_id: 'P001',
        name: 'Yogur',
        sale_price: '0.45',
        manufacturing_days: '1',
        shelf_life_days: '14',
      },
      { product_id: 'P002', name: '', sale_price: 'abc', manufacturing_days: '1.5', shelf_life_days: '0' },
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([
      { row: 3, field: 'name', code: 'empty' },
      { row: 3, field: 'sale_price', code: 'invalid_number', value: 'abc' },
      { row: 3, field: 'manufacturing_days', code: 'invalid_number', value: '1.5' },
      { row: 3, field: 'shelf_life_days', code: 'not_positive', value: '0' },
    ]);
  });

  it('detects duplicates and invalid dates', () => {
    const result = validateOrders(
      COLUMNS.orders,
      [
        { order_id: 'ORD1', order_date: '2026-11-12', customer_id: 'C1', destination_id: 'D026' },
        { order_id: 'ORD1', order_date: '2026-02-31', customer_id: 'C1', destination_id: 'D026' },
      ],
      { destinationIds: new Set(['D026']) },
    );
    expect(result.errors).toEqual([
      { row: 3, field: 'order_date', code: 'invalid_date', value: '2026-02-31' },
      { row: 3, field: 'order_id', code: 'duplicate', value: 'ORD1' },
    ]);
  });

  it('rejects lines with an unknown product (ERR-02, scenario E5)', () => {
    const result = validateOrderLines(
      COLUMNS.order_lines,
      [
        { order_id: 'ORD1', product_id: 'P001', quantity: '320' },
        { order_id: 'ORD1', product_id: 'P999', quantity: '5' },
        { order_id: 'ORD2', product_id: 'P001', quantity: '-3' },
      ],
      { orderIds: new Set(['ORD1']), productIds: new Set(['P001']) },
    );
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual([
      { row: 3, field: 'product_id', code: 'unknown_id', value: 'P999' },
      { row: 4, field: 'quantity', code: 'not_positive', value: '-3' },
      { row: 4, field: 'order_id', code: 'unknown_id', value: 'ORD2' },
    ]);
  });
});
