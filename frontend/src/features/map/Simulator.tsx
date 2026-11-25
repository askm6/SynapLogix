/**
 * Visual simulator: plays the trucks along their stops in simulated time (play, pause, speed and a
 * time slider), with the estimated arrival and the expiry margin of each truck's next stop.
 * Mount it with a `key` per run so a new solution starts a fresh simulation.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Badge, Button, cx } from '@/components/ui';
import { useI18n, type MessageKey } from '@/i18n';
import type { Destination } from '@/types/entities';
import {
  routeColor,
  simulationBounds,
  truckStateAt,
  type Timeline,
  type TruckStatus,
} from '@/lib/simulation';
import { RouteMap } from './RouteMap';

const SPEEDS = [1, 3, 6, 12, 24];
const HOUR = 3_600_000;

const STATUS_KEY: Record<TruckStatus, MessageKey> = {
  waiting: 'sim.waiting',
  driving: 'sim.driving',
  returning: 'sim.returning',
  done: 'sim.done',
};

export function Simulator({
  timelines,
  destinations,
  selected,
  onSelect,
}: {
  timelines: Timeline[];
  destinations: Destination[];
  selected: string | null;
  onSelect: (routeId: string | null) => void;
}) {
  const { t, f } = useI18n();
  const { start, end } = useMemo(() => simulationBounds(timelines), [timelines]);
  const [time, setTime] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(6);
  const names = useMemo(() => new Map(destinations.map((d) => [d.destination_id, d.name])), [destinations]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      setTime((current) => {
        const next = current + elapsed * speed * HOUR;
        if (next >= end) {
          setPlaying(false);
          return end;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, end]);

  const states = timelines.map((tl, i) => ({ tl, i, state: truckStateAt(tl, time) }));
  const active = states.filter((s) => s.state.status === 'driving' || s.state.status === 'returning').length;
  const list = selected ? states.filter((s) => s.tl.route.route_id === selected) : states;
  const iso = new Date(time).toISOString().slice(0, 19);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-3">
        <RouteMap
          timelines={timelines}
          destinations={destinations}
          selected={selected}
          onSelect={onSelect}
          time={time}
        />
        <div className="glass flex flex-wrap items-center gap-3 rounded-xl px-3 py-2">
          <Button
            size="sm"
            variant="primary"
            icon={playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            onClick={() => {
              if (!playing && time >= end) setTime(start);
              setPlaying(!playing);
            }}
          >
            {playing ? t('sim.pause') : t('sim.play')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw className="size-4" />}
            onClick={() => {
              setTime(start);
              setPlaying(false);
            }}
          >
            {t('sim.reset')}
          </Button>
          <label className="flex items-center gap-2 text-xs text-muted">
            {t('sim.speed')}
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="h-8 rounded-lg border border-line bg-glass px-2 text-xs text-fg [&>option]:bg-glass-strong"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {t('sim.speedValue', { n: s })}
                </option>
              ))}
            </select>
          </label>
          <input
            type="range"
            min={start}
            max={end}
            step={60_000}
            value={time}
            onChange={(e) => {
              setTime(Number(e.target.value));
              setPlaying(false);
            }}
            aria-label={t('sim.clock')}
            className="min-w-40 flex-1 accent-[#3AA7FF]"
          />
          <div className="text-right text-xs">
            <div className="text-muted">{t('sim.clock')}</div>
            <div className="font-medium tabular-nums text-fg">{f.dateTime(iso)}</div>
          </div>
        </div>
      </div>

      <div className="glass flex max-h-[600px] flex-col rounded-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-sm font-semibold">{t('sim.title')}</span>
          <Badge tone="accent">
            {t('sim.fleet')}: {active}/{timelines.length}
          </Badge>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {list.map(({ tl, i, state }) => {
            const margin = state.next?.expiry_margin_h;
            return (
              <li key={tl.route.route_id}>
                <button
                  onClick={() => onSelect(selected === tl.route.route_id ? null : tl.route.route_id)}
                  className={cx(
                    'flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left text-xs transition hover:bg-white/5',
                    selected === tl.route.route_id && 'bg-accent/10',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium text-fg">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: routeColor(i) }}
                        aria-hidden
                      />
                      {t('res.col.truck')} {tl.route.truck_number}
                    </span>
                    <span className="text-muted">{t(STATUS_KEY[state.status])}</span>
                  </span>
                  <span className="text-muted">
                    {t('sim.delivered', { n: state.delivered, total: tl.stops.length })}
                  </span>
                  {state.next && (
                    <span className="flex flex-wrap gap-x-3 text-muted">
                      <span>
                        {t('sim.nextStop')}:{' '}
                        <span className="text-fg">
                          {names.get(state.next.destination_id) ?? state.next.destination_id}
                        </span>
                      </span>
                      <span>
                        {t('sim.eta')}:{' '}
                        <span className="text-fg tabular-nums">
                          {f.dateTime(state.next.estimated_arrival)}
                        </span>
                      </span>
                      {margin != null && (
                        <span>
                          {t('sim.margin')}:{' '}
                          <span className={cx('tabular-nums', margin < 6 ? 'text-warn' : 'text-ok')}>
                            {f.hours(margin)}
                          </span>
                        </span>
                      )}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        {selected && (
          <div className="border-t border-line p-2">
            <Button size="sm" variant="ghost" className="w-full" onClick={() => onSelect(null)}>
              {t('res.showAll')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
