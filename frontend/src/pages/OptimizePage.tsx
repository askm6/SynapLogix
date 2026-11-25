/** Optimization screen (CU-05, RF-09, RF-10): scenario, algorithm, time limit and a progress bar. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Cpu, Pencil, Play } from 'lucide-react';
import {
  Button,
  Card,
  Empty,
  Field,
  Notice,
  PageHeader,
  Progress,
  Select,
  Spinner,
  cx,
} from '@/components/ui';
import { keys, useCurrentFleet, useRun, useScenarios, useStartOptimization } from '@/hooks/queries';
import { useI18n } from '@/i18n';
import { useUi } from '@/app/store';
import type { Algorithm } from '@/types/entities';
import { useQueryClient } from '@tanstack/react-query';

const ALGORITHMS: Algorithm[] = ['clarke_wright', 'ortools', 'metaheuristic'];

export function OptimizePage() {
  const { t, f } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const scenarios = useScenarios();
  const fleet = useCurrentFleet();
  const { scenarioId, setScenarioId, setRunId } = useUi();
  const start = useStartOptimization();
  const [algorithm, setAlgorithm] = useState<Algorithm>('metaheuristic');
  const [timeLimit, setTimeLimit] = useState(10);
  const [runId, setLocalRunId] = useState<string | null>(null);
  const run = useRun(runId);

  const selected = scenarios.data?.find((s) => s.scenario_id === scenarioId) ?? scenarios.data?.[0];
  const status = run.data?.status;
  const running = start.isPending || status === 'running' || status === 'queued';

  async function launch() {
    if (!selected || !fleet.data) return;
    const response = await start.mutateAsync({
      scenario_id: selected.scenario_id,
      fleet_id: fleet.data.fleet_id,
      algorithm,
      time_limit_s: timeLimit,
    });
    setLocalRunId(response.run_id);
    setRunId(response.run_id);
  }

  // A finished run appears in Results, Compare and Home: refresh the list once.
  useEffect(() => {
    if (status === 'done') void qc.invalidateQueries({ queryKey: keys.runs });
  }, [status, qc]);

  if (scenarios.isLoading || fleet.isLoading) return <Spinner label={t('common.loading')} />;

  return (
    <>
      <PageHeader title={t('opt.title')} subtitle={t('opt.subtitle')} />
      {!selected ? (
        <Card>
          <Empty
            action={
              <Link to="/datos">
                <Button variant="primary">{t('nav.data')}</Button>
              </Link>
            }
          >
            {t('opt.noScenario')}
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card title={t('opt.title')}>
            <div className="flex flex-col gap-6">
              <Field label={t('opt.scenario')} htmlFor="opt-scenario">
                <Select
                  id="opt-scenario"
                  value={selected.scenario_id}
                  disabled={running}
                  onChange={(e) => setScenarioId(e.target.value)}
                >
                  {scenarios.data?.map((s) => (
                    <option key={s.scenario_id} value={s.scenario_id}>
                      {s.name} · {f.int(s.n_orders)} {t('unit.orders')} · {f.int(s.n_lines)} {t('unit.lines')}
                    </option>
                  ))}
                </Select>
              </Field>

              <fieldset className="flex flex-col gap-2" disabled={running}>
                <legend className="mb-1.5 text-xs font-medium text-muted">{t('opt.algorithm')}</legend>
                <div className="grid gap-3 md:grid-cols-3">
                  {ALGORITHMS.map((a) => (
                    <label
                      key={a}
                      className={cx(
                        'glass flex cursor-pointer flex-col gap-1 rounded-xl p-4 transition',
                        algorithm === a ? 'shadow-[inset_0_0_0_1.5px_var(--accent)]' : 'hover:bg-white/5',
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-fg">
                        <input
                          type="radio"
                          name="algorithm"
                          value={a}
                          checked={algorithm === a}
                          onChange={() => setAlgorithm(a)}
                          className="accent-[#3AA7FF]"
                        />
                        {t(`algo.${a}`)}
                      </span>
                      <span className="text-xs text-muted">{t(`algo.${a}.desc`)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <Field
                label={`${t('opt.timeLimit')}: ${t('opt.seconds', { n: timeLimit })}`}
                hint={t('opt.timeLimitHint')}
                htmlFor="opt-time"
              >
                <input
                  id="opt-time"
                  type="range"
                  min={5}
                  max={300}
                  step={5}
                  value={timeLimit}
                  disabled={running || algorithm === 'clarke_wright'}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="w-full accent-[#3AA7FF]"
                />
              </Field>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  icon={<Play className="size-4" />}
                  onClick={launch}
                  loading={running}
                  disabled={!fleet.data}
                >
                  {running ? t('opt.running') : t('opt.start')}
                </Button>
              </div>

              {runId && run.data && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>{t('opt.progress')}</span>
                    <span className="tabular-nums">{Math.round(run.data.progress * 100)} %</span>
                  </div>
                  <Progress value={run.data.progress} label={t('opt.progress')} />
                  {status === 'done' && (
                    <Notice tone="ok">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>
                          {t('opt.done')} {f.int(run.data.run.n_trucks)} {t('unit.trucks')} ·{' '}
                          {f.km(run.data.run.total_km)} · {f.eur(run.data.run.total_cost)}
                        </span>
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<ArrowRight className="size-4" />}
                          onClick={() => navigate(`/resultados/${runId}`)}
                        >
                          {t('opt.viewResults')}
                        </Button>
                      </div>
                    </Notice>
                  )}
                  {status === 'failed' && <Notice tone="danger">{t('opt.failed')}</Notice>}
                </div>
              )}
              {start.isError && <Notice tone="danger">{t('opt.failed')}</Notice>}
            </div>
          </Card>

          <Card
            title={t('opt.fleet')}
            actions={
              <Link to="/flota">
                <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />}>
                  {t('common.edit')}
                </Button>
              </Link>
            }
          >
            {fleet.data && (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-muted">{t('fleet.capacity')}</dt>
                  <dd className="font-medium tabular-nums">
                    {f.int(fleet.data.capacity_units)} {t('unit.units')}
                  </dd>
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
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-line p-3 text-xs text-muted">
              <Cpu className="size-4 shrink-0 text-accent-ink" aria-hidden />
              {t('algo.metaheuristic.desc')}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
