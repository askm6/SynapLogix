/** Global indicators of a run (RF-12, section 7.1). */
import { Clock, Cpu, Euro, Gauge, PackageCheck, Route, Timer, Truck } from 'lucide-react';
import { Kpi } from '@/components/ui';
import { useI18n } from '@/i18n';
import type { RunDetail } from '@/types/api';

export function KpiGrid({ detail }: { detail: RunDetail }) {
  const { t, f } = useI18n();
  const { run, kpis } = detail;
  const icon = 'size-3.5 text-accent-ink';
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Kpi
        icon={<Truck className={icon} aria-hidden />}
        label={t('kpi.trucks')}
        value={f.int(run.n_trucks)}
        hint={kpis ? t('kpi.lowerBoundHint', { n: kpis.lower_bound }) : undefined}
      />
      <Kpi icon={<Route className={icon} aria-hidden />} label={t('kpi.km')} value={f.km(run.total_km)} />
      <Kpi icon={<Euro className={icon} aria-hidden />} label={t('kpi.cost')} value={f.eur(run.total_cost)} />
      <Kpi
        icon={<Clock className={icon} aria-hidden />}
        label={t('kpi.hours')}
        value={kpis ? f.hours(kpis.total_hours) : '—'}
      />
      <Kpi
        icon={<Gauge className={icon} aria-hidden />}
        label={t('kpi.load')}
        value={kpis ? f.pct(kpis.avg_load_factor) : '—'}
      />
      <Kpi
        icon={<Timer className={icon} aria-hidden />}
        label={t('kpi.margin')}
        value={kpis ? f.hours(kpis.avg_expiry_margin_h) : '—'}
      />
      <Kpi
        icon={<PackageCheck className={icon} aria-hidden />}
        label={t('kpi.served')}
        value={kpis ? f.int(kpis.orders_served) : '—'}
        hint={kpis ? `${t('kpi.infeasible')}: ${f.int(kpis.orders_infeasible)}` : undefined}
      />
      <Kpi
        icon={<Cpu className={icon} aria-hidden />}
        label={t('kpi.time')}
        value={f.seconds(run.computation_time_s)}
        hint={t(`algo.${run.algorithm}`)}
      />
    </div>
  );
}
