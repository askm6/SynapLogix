/**
 * PA-01 (scenario E1, daily planning) in mock mode: optimize S1 with Clarke-Wright and check that the
 * KPIs, the map and the routes table agree (CA-07) and that the CSV export works (RF-14).
 */
import { expect, test } from '@playwright/test';

test('E1: optimize S1 and review the results', async ({ page }) => {
  await page.goto('/optimizacion');
  await page.getByRole('radio', { name: /Clarke-Wright/ }).check();
  await page.getByRole('button', { name: 'Optimizar' }).click();
  await expect(page.getByText('Optimización terminada.')).toBeVisible({ timeout: 30_000 });
  // Same result as the Python core for S1 (section 7.3 of the report).
  await expect(page.getByText(/21 camiones · 37\.076 km/)).toBeVisible();

  await page.getByRole('button', { name: 'Ver resultados' }).click();
  await expect(page).toHaveURL(/\/resultados\/RUN/);
  await expect(page.getByText('Pedidos inviables (10)')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar rutas (CSV)' }).click();
  expect((await download).suggestedFilename()).toMatch(/_routes\.csv$/);

  // The map and the simulator live on their own screen.
  await page.getByRole('button', { name: 'Abrir mapa y simulador' }).click();
  await expect(page).toHaveURL(/\/mapa\/RUN/);
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await page.getByRole('button', { name: 'Reproducir' }).click();
  await expect(page.getByRole('button', { name: 'Pausa' })).toBeVisible();
});

test('E5: a file with an unknown product is rejected with its row', async ({ page }) => {
  await page.goto('/datos');
  await page.getByRole('tab', { name: 'Importar' }).click();
  await page.getByRole('tab', { name: 'Pedidos y líneas' }).click();
  const inputs = page.locator('input[type=file]');
  await inputs.nth(0).setInputFiles({
    name: 'orders.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('order_id;order_date;customer_id;destination_id\nORD1;2026-11-12;C001;D026\n'),
  });
  await inputs.nth(1).setInputFiles({
    name: 'order_lines.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('order_id;product_id;quantity\nORD1;P999;5\n'),
  });
  await expect(page.getByText('Identificador inexistente')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importar' })).toHaveCount(0);
});
