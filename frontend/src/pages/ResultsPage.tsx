/**
 * Results screen (CU-06, CU-08): KPIs, routes and stops, infeasible orders and CSV export.
 * The map and the simulator live on their own screen (MapPage), opened from here.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Download, Map as MapIcon } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Notice,
  PageHeader,
  Select,
  Spinner,
  TableWrap,
} from '@/components/ui';
import { KpiGrid } from '@/features/results/KpiGrid';
import { RoutesTable } from '@/features/results/RoutesTable';
import { useDestinations, useRun, useRuns } from '@/hooks/queries';
import { useI18n, type MessageKey } from '@/i18n';
import { useUi } from '@/app/store';
import { downloadText, kpisCsv, routesCsv } from '@/lib/csv';

export function ResultsPage() {
  const { t, f } = useI18n();
  const navigate = useNavigate();
  const params = useParams();
  const runs = useRuns();
  const destinations = useDestinations();
  const { runId: lastRunId, setRunId } = useUi();
  const runId = params.runId ?? lastRunId ?? runs.data?.[0]?.run_id ?? null;
  const run = useRun(runId);
  const [selected, setSelected] = useState<string | null>(null);

  const detail = run.data?.status === 'done' ? run.data : null;
  const names = useMemo(
    () => new Map(destinations.data?.map((d) => [d.destination_id, d.name])),
    [destinations.data],
  );

  if (runs.isLoading) return <Spinner label={t('common.loading')} />;
  if (!runId) {
    return (
      <>
        <PageHeader title={t('res.title')} />
        <Card>
          <Empty
            action={
              <Link to="/optimizacion">
                <Button variant="primary">{t('res.goOptimize')}</Button>
              </Link>
            }
          >
            {t('res.noRuns')}
          </Empty>
        </Card>
      </>
    );
  }

  const exportName = (kind: string) => `synaplogix_${runId}_${kind}.csv`;

  return (
    <>
      <PageHeader
        title={t('res.title')}
        subtitle={
          detail
            ? `${detail.scenario_name} · ${t(`algo.${detail.run.algorithm}`)} · ${f.dateTime(detail.run.created_at)}`
            : undefined
        }
        actions={
          <>
            <Field label={t('res.run')} htmlFor="res-run">
              <Select
                id="res-run"
                value={runId}
                onChange={(e) => {
                  setRunId(e.target.value);
                  setSelected(null);
                  navigate(`/resultados/${e.target.value}`);
                }}
                className="min-w-64"
              >
                {runs.data?.map((r) => (
                  <option key={r.run_id} value={r.run_id}>
                    {r.run_id} · {t(`algo.${r.algorithm}`)} · {r.n_trucks} {t('unit.trucks')}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        }
      />

      {run.isLoading || !detail ? (
        run.isError ? (
          <Notice tone="danger">{t('common.error')}</Notice>
        ) : (
          <Spinner label={t('common.loading')} />
        )
      ) : (
        <div className="flex flex-col gap-6">
          <KpiGrid detail={detail} />
          <div className="flex flex-col gap-2">
            {detail.message && <Notice tone="warn">{t(`res.msg.${detail.message}` as MessageKey)}</Notice>}
            {detail.validation_errors?.length === 0 && <Notice tone="ok">{t('res.validation')}</Notice>}
            {!!detail.validation_errors?.length && (
              <Notice tone="danger">
                {t('res.validationFailed')} {detail.validation_errors.join(' · ')}
              </Notice>
            )}
          </div>

          <Card solid>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent-ink">
                  <MapIcon className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-fg">{t('res.map')}</h2>
                  <p className="text-xs text-muted">{t('res.mapHint')}</p>
                </div>
              </div>
              <Link to={`/mapa/${runId}`}>
                <Button variant="primary" icon={<MapIcon className="size-4" />}>
                  {t('res.openMap')}
                </Button>
              </Link>
            </div>
          </Card>

          <Card
            title={t('res.routes')}
            actions={
              <>
                <Button
                  size="sm"
                  icon={<Download className="size-4" />}
                  onClick={() =>
                    downloadText(exportName('routes'), routesCsv(detail, destinations.data ?? []))
                  }
                >
                  {t('res.exportRoutes')}
                </Button>
                <Button
                  size="sm"
                  icon={<Download className="size-4" />}
                  onClick={() => downloadText(exportName('kpis'), kpisCsv(detail))}
                >
                  {t('res.exportKpis')}
                </Button>
              </>
            }
          >
            <RoutesTable detail={detail} names={names} selected={selected} onSelect={setSelected} />
          </Card>

          <Card title={`${t('res.infeasible')} (${detail.infeasible.length})`}>
            {detail.infeasible.length === 0 ? (
              <Empty>{t('res.noInfeasible')}</Empty>
            ) : (
              <TableWrap maxHeight={320}>
                <thead>
                  <tr>
                    <th>{t('data.col.order')}</th>
                    <th>{t('data.col.destination')}</th>
                    <th className="text-right">{t('res.col.units')}</th>
                    <th>{t('res.col.reason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.infeasible.map((o) => (
                    <tr key={o.order_id}>
                      <td className="font-medium">{o.order_id}</td>
                      <td>{names.get(o.destination_id) ?? o.destination_id}</td>
                      <td className="text-right tabular-nums">{f.int(o.units)}</td>
                      <td>
                        <Badge tone={o.reason === 'does_not_fit' ? 'danger' : 'warn'}>
                          {t(`reason.${o.reason}`)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
