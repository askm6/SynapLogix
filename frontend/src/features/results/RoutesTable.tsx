/** Routes and stops table (RF-11): one row per truck, expandable to its ordered stops. */
import { Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TableWrap, cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import type { RunDetail } from '@/types/api';
import { routeColor } from '@/lib/simulation';

export function RoutesTable({
  detail,
  names,
  selected,
  onSelect,
}: {
  detail: RunDetail;
  names: Map<string, string>;
  selected: string | null;
  onSelect: (routeId: string | null) => void;
}) {
  const { t, f } = useI18n();
  const stopsByRoute = new Map<string, typeof detail.stops>();
  for (const s of detail.stops) {
    const list = stopsByRoute.get(s.route_id);
    if (list) list.push(s);
    else stopsByRoute.set(s.route_id, [s]);
  }
  return (
    <TableWrap maxHeight={520}>
      <thead>
        <tr>
          <th>{t('res.col.truck')}</th>
          <th className="text-right">{t('res.col.stops')}</th>
          <th className="text-right">{t('res.col.km')}</th>
          <th className="text-right">{t('res.col.duration')}</th>
          <th className="text-right">{t('res.col.units')}</th>
          <th className="text-right">{t('res.col.load')}</th>
          <th>{t('res.col.departure')}</th>
          <th>{t('res.col.return')}</th>
        </tr>
      </thead>
      <tbody>
        {detail.routes.map((r, i) => {
          const open = selected === r.route_id;
          const stops = (stopsByRoute.get(r.route_id) ?? []).sort((a, b) => a.stop_order - b.stop_order);
          return (
            <Fragment key={r.route_id}>
              <tr
                className={cx('cursor-pointer hover:bg-white/5', open && 'bg-accent/10')}
                onClick={() => onSelect(open ? null : r.route_id)}
              >
                <td className="whitespace-nowrap">
                  <button className="inline-flex items-center gap-2 font-medium" aria-expanded={open}>
                    {open ? (
                      <ChevronDown className="size-4" aria-hidden />
                    ) : (
                      <ChevronRight className="size-4" aria-hidden />
                    )}
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: routeColor(i) }}
                      aria-hidden
                    />
                    {r.truck_number}
                  </button>
                </td>
                <td className="text-right tabular-nums">{stops.length}</td>
                <td className="text-right tabular-nums">{f.int(r.km)}</td>
                <td className="text-right tabular-nums">{f.hours(r.duration_h)}</td>
                <td className="text-right tabular-nums">{f.int(r.units)}</td>
                <td className="text-right tabular-nums">{f.pct(r.load_factor)}</td>
                <td className="whitespace-nowrap tabular-nums">{f.dateTime(r.departure_at)}</td>
                <td className="whitespace-nowrap tabular-nums">{f.dateTime(r.return_at)}</td>
              </tr>
              {open && (
                <tr>
                  <td colSpan={8} className="bg-white/[0.02]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted">
                          <th className="!static !bg-transparent">{t('res.col.stop')}</th>
                          <th className="!static !bg-transparent">{t('data.col.order')}</th>
                          <th className="!static !bg-transparent">{t('data.col.destination')}</th>
                          <th className="!static !bg-transparent">{t('res.col.arrival')}</th>
                          <th className="!static !bg-transparent text-right">{t('res.col.margin')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stops.map((s) => (
                          <tr key={`${s.order_id}-${s.stop_order}`}>
                            <td className="tabular-nums">{s.stop_order}</td>
                            <td>{s.order_id}</td>
                            <td>{names.get(s.destination_id) ?? s.destination_id}</td>
                            <td className="tabular-nums">{f.dateTime(s.estimated_arrival)}</td>
                            <td
                              className={cx(
                                'text-right tabular-nums',
                                s.expiry_margin_h < 6 ? 'text-warn' : 'text-ok',
                              )}
                            >
                              {f.hours(s.expiry_margin_h)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </TableWrap>
  );
}
