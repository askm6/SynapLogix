/** Data screen (CU-01, CU-02): scenarios with their orders, file import with validation, and catalog. */
import { useMemo, useState } from 'react';
import { Eye, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Empty,
  Notice,
  PageHeader,
  Spinner,
  Tabs,
  TableWrap,
  cx,
} from '@/components/ui';
import { DataTable, type Column } from '@/components/DataTable';
import { ImportPanel } from '@/features/data-import/ImportPanel';
import { ScenarioGenerator } from '@/features/scenario-generator/ScenarioGenerator';
import {
  useDestinations,
  useOrderLines,
  useOrders,
  useProducts,
  useRemoveScenario,
  useScenarios,
} from '@/hooks/queries';
import { useI18n } from '@/i18n';
import { useUi } from '@/app/store';
import type { Destination, Product } from '@/types/entities';

type Tab = 'scenarios' | 'import' | 'catalog';

function ScenarioOrders({ scenarioId, name }: { scenarioId: string; name: string }) {
  const { t, f } = useI18n();
  const orders = useOrders(scenarioId);
  const lines = useOrderLines(scenarioId);
  const destinations = useDestinations();
  const rows = useMemo(() => {
    const units = new Map<string, { units: number; lines: number }>();
    for (const l of lines.data ?? []) {
      const u = units.get(l.order_id) ?? { units: 0, lines: 0 };
      u.units += l.quantity;
      u.lines += 1;
      units.set(l.order_id, u);
    }
    const names = new Map(destinations.data?.map((d) => [d.destination_id, d.name]));
    return (orders.data ?? []).map((o) => ({
      ...o,
      ...units.get(o.order_id),
      destination: names.get(o.destination_id) ?? o.destination_id,
    }));
  }, [orders.data, lines.data, destinations.data]);
  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    { id: 'order', header: t('data.col.order'), value: (r) => r.order_id },
    {
      id: 'date',
      header: t('data.col.date'),
      value: (r) => r.order_date,
      render: (r) => f.date(r.order_date),
    },
    { id: 'customer', header: t('data.col.customer'), value: (r) => r.customer_id },
    { id: 'dest', header: t('data.col.destination'), value: (r) => r.destination },
    { id: 'lines', header: t('data.col.lines'), value: (r) => r.lines ?? 0, align: 'right' },
    {
      id: 'units',
      header: t('data.col.units'),
      value: (r) => r.units ?? 0,
      render: (r) => f.int(r.units ?? 0),
      align: 'right',
    },
  ];
  return (
    <Card title={t('data.orders.title', { name })}>
      {orders.isLoading || lines.isLoading ? (
        <Spinner label={t('common.loading')} />
      ) : (
        <DataTable data={rows} columns={columns} height={360} />
      )}
    </Card>
  );
}

function ScenariosTab() {
  const { t, f } = useI18n();
  const scenarios = useScenarios();
  const remove = useRemoveScenario();
  const { scenarioId, setScenarioId } = useUi();
  const selected = scenarios.data?.find((s) => s.scenario_id === scenarioId) ?? scenarios.data?.[0];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card title={t('data.tab.scenarios')}>
          {scenarios.isLoading ? (
            <Spinner label={t('common.loading')} />
          ) : scenarios.isError ? (
            <Notice tone="danger">{t('common.error')}</Notice>
          ) : !scenarios.data?.length ? (
            <Empty>{t('data.scenarios.empty')}</Empty>
          ) : (
            <TableWrap maxHeight={340}>
              <thead>
                <tr>
                  <th>{t('data.col.name')}</th>
                  <th>{t('data.col.type')}</th>
                  <th className="text-right">{t('data.col.orders')}</th>
                  <th className="text-right">{t('data.col.lines')}</th>
                  <th className="text-right">{t('data.col.units')}</th>
                  <th className="text-right">{t('data.col.seed')}</th>
                  <th>
                    <span className="sr-only">{t('data.viewOrders')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {scenarios.data.map((s) => (
                  <tr
                    key={s.scenario_id}
                    className={cx(s.scenario_id === selected?.scenario_id && 'bg-accent/10')}
                  >
                    <td className="font-medium">{s.name}</td>
                    <td>
                      <Badge tone={s.type === 'real' ? 'accent' : 'neutral'}>
                        {t(`data.type.${s.type}`)}
                      </Badge>
                    </td>
                    <td className="text-right tabular-nums">{f.int(s.n_orders)}</td>
                    <td className="text-right tabular-nums">{f.int(s.n_lines)}</td>
                    <td className="text-right tabular-nums">{f.int(s.total_units)}</td>
                    <td className="text-right tabular-nums">{s.seed ?? t('common.none')}</td>
                    <td className="whitespace-nowrap text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Eye className="size-4" />}
                        onClick={() => setScenarioId(s.scenario_id)}
                        aria-label={`${t('data.viewOrders')} ${s.name}`}
                      />
                      {s.scenario_id !== 'S1' && (
                        <Button
                          size="sm"
                          variant="danger"
                          icon={<Trash2 className="size-4" />}
                          onClick={() => remove.mutate(s.scenario_id)}
                          aria-label={`${t('common.delete')} ${s.name}`}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
        {selected && <ScenarioOrders scenarioId={selected.scenario_id} name={selected.name} />}
      </div>
      <ScenarioGenerator />
    </div>
  );
}

function CatalogTab() {
  const { t, f } = useI18n();
  const products = useProducts();
  const destinations = useDestinations();
  const productColumns: Column<Product>[] = [
    { id: 'id', header: t('data.col.id'), value: (p) => p.product_id },
    { id: 'name', header: t('data.col.name'), value: (p) => p.name },
    {
      id: 'price',
      header: t('data.col.price'),
      value: (p) => p.sale_price,
      render: (p) => `${f.dec(p.sale_price)} €`,
      align: 'right',
    },
    { id: 'mf', header: t('data.col.manufacturing'), value: (p) => p.manufacturing_days, align: 'right' },
    { id: 'sl', header: t('data.col.shelfLife'), value: (p) => p.shelf_life_days, align: 'right' },
  ];
  const destinationColumns: Column<Destination>[] = [
    { id: 'id', header: t('data.col.id'), value: (d) => d.destination_id },
    { id: 'name', header: t('data.col.name'), value: (d) => d.name },
    { id: 'lat', header: t('data.col.lat'), value: (d) => d.latitude, align: 'right' },
    { id: 'lon', header: t('data.col.lon'), value: (d) => d.longitude, align: 'right' },
  ];
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title={t('catalog.products')}>
        {products.isLoading ? (
          <Spinner label={t('common.loading')} />
        ) : (
          <DataTable data={products.data ?? []} columns={productColumns} />
        )}
      </Card>
      <Card title={t('catalog.destinations')}>
        {destinations.isLoading ? (
          <Spinner label={t('common.loading')} />
        ) : (
          <DataTable data={destinations.data ?? []} columns={destinationColumns} />
        )}
      </Card>
    </div>
  );
}

export function DataPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('scenarios');
  return (
    <>
      <PageHeader
        title={t('data.title')}
        subtitle={t('data.subtitle')}
        actions={
          <Tabs<Tab>
            label={t('data.title')}
            value={tab}
            onChange={setTab}
            items={[
              { value: 'scenarios', label: t('data.tab.scenarios') },
              { value: 'import', label: t('data.tab.import') },
              { value: 'catalog', label: t('data.tab.catalog') },
            ]}
          />
        }
      />
      {tab === 'scenarios' && <ScenariosTab />}
      {tab === 'import' && <ImportPanel />}
      {tab === 'catalog' && <CatalogTab />}
    </>
  );
}
