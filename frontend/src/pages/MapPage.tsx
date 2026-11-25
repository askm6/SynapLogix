/**
 * Map screen: the route map and the truck simulator of one run, on their own page.
 * Keeping them apart from Results means the heavy map only loads when it is opened, and nothing
 * else on the page re-renders while the simulation plays. A finished run is loaded once and never
 * requested again (see useRun).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BarChart3 } from 'lucide-react';
import { Badge, Button, Card, Empty, Field, Notice, PageHeader, Select, Spinner } from '@/components/ui';
import { Simulator } from '@/features/map/Simulator';
import { useDestinations, useRun, useRuns } from '@/hooks/queries';
import { useI18n } from '@/i18n';
import { useUi } from '@/app/store';
import { buildTimelines } from '@/lib/simulation';

/** Map height that fills the window below the header and the simulator controls. */
function useMapHeight(): number {
  const compute = () => Math.max(420, Math.round(window.innerHeight - 290));
  const [height, setHeight] = useState(compute);
  useEffect(() => {
    const onResize = () => setHeight(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return height;
}

export function MapPage() {
  const { t, f } = useI18n();
  const navigate = useNavigate();
  const params = useParams();
  const runs = useRuns();
  const destinations = useDestinations();
  const { runId: lastRunId, setRunId } = useUi();
  const runId = params.runId ?? lastRunId ?? runs.data?.[0]?.run_id ?? null;
  const run = useRun(runId);
  const [selected, setSelected] = useState<string | null>(null);
  const mapHeight = useMapHeight();

  const detail = run.data?.status === 'done' ? run.data : null;
  const timelines = useMemo(
    () => (detail && destinations.data ? buildTimelines(detail.routes, detail.stops, destinations.data) : []),
    [detail, destinations.data],
  );

  if (runs.isLoading) return <Spinner label={t('common.loading')} />;
  if (!runId) {
    return (
      <>
        <PageHeader title={t('map.title')} />
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

  const selectedTruck = detail?.routes.find((r) => r.route_id === selected)?.truck_number;

  return (
    <>
      <PageHeader
        title={t('map.title')}
        subtitle={
          detail
            ? `${detail.scenario_name} · ${t(`algo.${detail.run.algorithm}`)} · ${f.int(detail.run.n_trucks)} ${t('unit.trucks')} · ${f.km(detail.run.total_km)}`
            : undefined
        }
        actions={
          <>
            {selectedTruck != null && <Badge tone="accent">{t('res.selected', { n: selectedTruck })}</Badge>}
            <Field label={t('res.run')} htmlFor="map-run">
              <Select
                id="map-run"
                value={runId}
                onChange={(e) => {
                  setRunId(e.target.value);
                  setSelected(null);
                  navigate(`/mapa/${e.target.value}`);
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
            <Link to={`/resultados/${runId}`} className="self-end">
              <Button icon={<BarChart3 className="size-4" />}>{t('map.toResults')}</Button>
            </Link>
          </>
        }
      />
      {run.isError ? (
        <Notice tone="danger">{t('common.error')}</Notice>
      ) : !detail || !destinations.data ? (
        <Spinner label={t('common.loading')} />
      ) : (
        <Simulator
          key={detail.run.run_id}
          timelines={timelines}
          destinations={destinations.data}
          selected={selected}
          onSelect={setSelected}
          mapHeight={mapHeight}
        />
      )}
    </>
  );
}
