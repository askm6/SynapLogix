/** Compare screen (CU-07, RF-13): indicators of 2 to 4 saved runs side by side, with the first as reference. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQueries } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Trash2, Trophy } from 'lucide-react';
import { Badge, Button, Card, Empty, PageHeader, Spinner, TableWrap, cx } from '@/components/ui';
import { api } from '@/services';
import { keys, useRemoveRun, useRuns } from '@/hooks/queries';
import { useI18n, type Format, type MessageKey } from '@/i18n';
import type { RunDetail } from '@/types/api';
import { routeColor } from '@/lib/simulation';

const MAX_SELECTED = 4;

interface Metric {
  key: MessageKey;
  value: (d: RunDetail) => number | null;
  format: (f: Format, x: number) => string;
  /** Which direction is better; null for context values such as capacity. */
  better: 'min' | 'max' | null;
}

const METRICS: Metric[] = [
  { key: 'kpi.trucks', value: (d) => d.run.n_trucks, format: (f, x) => f.int(x), better: 'min' },
  { key: 'kpi.km', value: (d) => d.run.total_km, format: (f, x) => f.km(x), better: 'min' },
  { key: 'kpi.cost', value: (d) => d.run.total_cost, format: (f, x) => f.eur(x), better: 'min' },
  {
    key: 'kpi.hours',
    value: (d) => d.kpis?.total_hours ?? null,
    format: (f, x) => f.hours(x),
    better: 'min',
  },
  {
    key: 'kpi.load',
    value: (d) => d.kpis?.avg_load_factor ?? null,
    format: (f, x) => f.pct(x),
    better: 'max',
  },
  {
    key: 'kpi.margin',
    value: (d) => d.kpis?.avg_expiry_margin_h ?? null,
    format: (f, x) => f.hours(x),
    better: 'max',
  },
  {
    key: 'kpi.served',
    value: (d) => d.kpis?.orders_served ?? null,
    format: (f, x) => f.int(x),
    better: 'max',
  },
  {
    key: 'kpi.infeasible',
    value: (d) => d.kpis?.orders_infeasible ?? null,
    format: (f, x) => f.int(x),
    better: 'min',
  },
  {
    key: 'kpi.lowerBound',
    value: (d) => d.kpis?.lower_bound ?? null,
    format: (f, x) => f.int(x),
    better: null,
  },
  { key: 'kpi.time', value: (d) => d.run.computation_time_s, format: (f, x) => f.seconds(x), better: 'min' },
  { key: 'cmp.capacity', value: (d) => d.fleet.capacity_units, format: (f, x) => f.int(x), better: null },
];

const CHARTS: MessageKey[] = ['kpi.trucks', 'kpi.km', 'kpi.cost'];

export function ComparePage() {
  const { t, f } = useI18n();
  const runs = useRuns();
  const remove = useRemoveRun();
  const [picked, setPicked] = useState<string[] | null>(null);
  // Until the user picks, compare the two latest runs.
  const selected =
    picked ??
    (runs.data ?? [])
      .slice(0, 2)
      .map((r) => r.run_id)
      .reverse();

  const details = useQueries({
    queries: selected.map((id) => ({ queryKey: keys.run(id), queryFn: () => api.results.get(id) })),
  });
  const loaded = details.map((q) => q.data).filter((d): d is RunDetail => !!d && d.status === 'done');
  const label = (d: RunDetail) => `${d.run.run_id} · ${t(`algo.${d.run.algorithm}`)}`;

  const chartData = useMemo(
    () =>
      CHARTS.map((key) => {
        const metric = METRICS.find((m) => m.key === key)!;
        return {
          key,
          rows: loaded.map((d, i) => ({
            name: d.run.run_id,
            value: metric.value(d) ?? 0,
            color: routeColor(i),
          })),
        };
      }),
    [loaded],
  );

  const toggle = (id: string) => {
    const current = selected;
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id].slice(-MAX_SELECTED);
    setPicked(next);
  };

  if (runs.isLoading) return <Spinner label={t('common.loading')} />;

  return (
    <>
      <PageHeader title={t('cmp.title')} subtitle={t('cmp.subtitle')} />
      {(runs.data?.length ?? 0) < 2 ? (
        <Card>
          <Empty
            action={
              <Link to="/optimizacion">
                <Button variant="primary">{t('res.goOptimize')}</Button>
              </Link>
            }
          >
            {t('cmp.empty')}
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card title={t('cmp.select')}>
            <p className="mb-3 text-xs text-muted">{t('cmp.selectHint')}</p>
            <ul className="flex flex-col gap-1">
              {runs.data?.map((r) => {
                const index = selected.indexOf(r.run_id);
                return (
                  <li key={r.run_id} className="flex items-center gap-2">
                    <label
                      className={cx(
                        'flex flex-1 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-white/5',
                        index >= 0 && 'bg-accent/10',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={index >= 0}
                        onChange={() => toggle(r.run_id)}
                        className="accent-[#3AA7FF]"
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-fg">
                          {r.run_id} {index === 0 && <Badge tone="accent">ref.</Badge>}
                        </span>
                        <span className="truncate text-xs text-muted">
                          {t(`algo.${r.algorithm}`)} · {r.n_trucks} {t('unit.trucks')} · {f.km(r.total_km)}
                        </span>
                      </span>
                    </label>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<Trash2 className="size-4" />}
                      aria-label={`${t('cmp.delete')} ${r.run_id}`}
                      onClick={() => {
                        setPicked(selected.filter((x) => x !== r.run_id));
                        remove.mutate(r.run_id);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="flex min-w-0 flex-col gap-6">
            <Card title={t('cmp.metric')}>
              {details.some((q) => q.isLoading) ? (
                <Spinner label={t('common.loading')} />
              ) : loaded.length < 2 ? (
                <Empty>{t('cmp.selectHint')}</Empty>
              ) : (
                <TableWrap>
                  <thead>
                    <tr>
                      <th>{t('cmp.metric')}</th>
                      {loaded.map((d, i) => (
                        <th key={d.run.run_id} className="text-right">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="size-2.5 rounded-full"
                              style={{ background: routeColor(i) }}
                              aria-hidden
                            />
                            {label(d)}
                          </span>
                          <div className="font-normal">{d.scenario_name}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map((m) => {
                      const values = loaded.map((d) => m.value(d));
                      const numbers = values.filter((v): v is number => v != null);
                      const best =
                        m.better && numbers.length
                          ? m.better === 'min'
                            ? Math.min(...numbers)
                            : Math.max(...numbers)
                          : null;
                      const ref = values[0];
                      return (
                        <tr key={m.key}>
                          <td className="text-muted">{t(m.key)}</td>
                          {values.map((v, i) => {
                            const isBest = best !== null && v === best && new Set(numbers).size > 1;
                            const delta = i > 0 && v != null && ref ? (v - ref) / ref : null;
                            return (
                              <td
                                key={i}
                                className={cx('text-right tabular-nums', isBest && 'font-semibold text-ok')}
                              >
                                <span className="inline-flex items-center gap-1">
                                  {isBest && <Trophy className="size-3.5" aria-label={t('cmp.best')} />}
                                  {v == null ? t('common.none') : m.format(f, v)}
                                </span>
                                {delta !== null && delta !== 0 && m.better && (
                                  <div
                                    className={cx(
                                      'text-xs',
                                      (m.better === 'min' ? delta < 0 : delta > 0)
                                        ? 'text-ok'
                                        : 'text-danger',
                                    )}
                                  >
                                    {delta > 0 ? '+' : ''}
                                    {f.pct(delta)} {t('cmp.vsRef')}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </TableWrap>
              )}
            </Card>

            {loaded.length >= 2 && (
              <div className="grid gap-4 lg:grid-cols-3">
                {chartData.map(({ key, rows }) => (
                  <Card key={key} title={t(key)}>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                          <XAxis
                            dataKey="name"
                            tick={{ fill: 'var(--muted)', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fill: 'var(--muted)', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={56}
                            tickFormatter={(x: number) => f.int(x)}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgb(58 167 255 / 0.08)' }}
                            contentStyle={{
                              background: 'var(--glass-strong)',
                              border: '1px solid var(--line)',
                              borderRadius: 12,
                              color: 'var(--fg)',
                            }}
                            formatter={(x) => f.int(Number(x))}
                          />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--accent)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
