/** Home screen: summary of the latest run and scenario, and quick access to Optimize. */
import { Link } from 'react-router';
import { ArrowRight, Database, Play, Route as RouteIcon, Truck } from 'lucide-react';
import { Button, Card, Empty, PageHeader, Spinner } from '@/components/ui';
import { KpiGrid } from '@/features/results/KpiGrid';
import { useCurrentFleet, useRun, useRuns, useScenarios } from '@/hooks/queries';
import { useI18n, type MessageKey } from '@/i18n';

const STEPS: { key: MessageKey; to: string; icon: typeof Database }[] = [
  { key: 'home.step1', to: '/datos', icon: Database },
  { key: 'home.step2', to: '/flota', icon: Truck },
  { key: 'home.step3', to: '/optimizacion', icon: Play },
  { key: 'home.step4', to: '/resultados', icon: RouteIcon },
];

export function HomePage() {
  const { t, f } = useI18n();
  const runs = useRuns();
  const scenarios = useScenarios();
  const fleet = useCurrentFleet();
  const latest = runs.data?.[0];
  const detail = useRun(latest?.run_id ?? null);

  return (
    <>
      <PageHeader
        title={t('home.title')}
        subtitle={t('home.subtitle')}
        actions={
          <Link to="/optimizacion">
            <Button variant="primary" icon={<Play className="size-4" />}>
              {t('home.optimizeNow')}
            </Button>
          </Link>
        }
      />
      <div className="flex flex-col gap-6">
        <Card
          title={t('home.lastRun')}
          actions={
            latest && (
              <Link to={`/resultados/${latest.run_id}`}>
                <Button size="sm" variant="ghost" icon={<ArrowRight className="size-4" />}>
                  {t('home.viewResults')}
                </Button>
              </Link>
            )
          }
        >
          {runs.isLoading || (latest && detail.isLoading) ? (
            <Spinner label={t('common.loading')} />
          ) : !latest || !detail.data ? (
            <Empty>{t('home.noRuns')}</Empty>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">
                {detail.data.scenario_name} · {t(`algo.${latest.algorithm}`)} ·{' '}
                {f.dateTime(latest.created_at)}
              </p>
              <KpiGrid detail={detail.data} />
            </div>
          )}
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title={t('home.scenarios')}>
            {scenarios.isLoading ? (
              <Spinner label={t('common.loading')} />
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {scenarios.data?.slice(0, 5).map((s) => (
                  <li key={s.scenario_id} className="flex flex-col">
                    <span className="font-medium text-fg">{s.name}</span>
                    <span className="text-xs tabular-nums text-muted">
                      {f.int(s.n_orders)} {t('unit.orders')} · {f.int(s.total_units)} {t('unit.units')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t('home.currentFleet')}>
            {fleet.data && (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">{t('fleet.capacity')}</dt>
                  <dd className="font-medium tabular-nums">{f.int(fleet.data.capacity_units)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{t('fleet.speed')}</dt>
                  <dd className="font-medium tabular-nums">{f.int(fleet.data.speed_kmh)} km/h</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{t('fleet.cost')}</dt>
                  <dd className="font-medium tabular-nums">{f.dec(fleet.data.cost_per_km)} €/km</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">{t('fleet.maxHours')}</dt>
                  <dd className="font-medium tabular-nums">
                    {fleet.data.max_driving_hours == null
                      ? t('fleet.noLimit')
                      : f.hours(fleet.data.max_driving_hours)}
                  </dd>
                </div>
              </dl>
            )}
          </Card>

          <Card title={t('home.steps')}>
            <ol className="flex flex-col gap-1">
              {STEPS.map(({ key, to, icon: Icon }, i) => (
                <li key={key}>
                  <Link
                    to={to}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted hover:bg-white/5 hover:text-fg"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent-ink">
                      {i + 1}
                    </span>
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {t(key)}
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
