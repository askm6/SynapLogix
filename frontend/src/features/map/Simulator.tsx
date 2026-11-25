/**
 * Visual simulator: plays the trucks along their stops in simulated time (play, pause, speed and a
 * time slider), with the estimated arrival and the expiry margin of each truck's next stop.
 * Mount it with a `key` per run so a new solution starts a fresh simulation.
 *
 * Performance: the animation loop only advances a SimClock. The map moves the trucks from that
 * clock at full frame rate; the clock label, slider and truck list re-render at most 5 times a second.
 */
import { memo, useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Badge, Button, cx } from '@/components/ui';
import { useI18n, type MessageKey } from '@/i18n';
import type { Destination, Stop } from '@/types/entities';
import {
  routeColor,
  SimClock,
  simulationBounds,
  truckStateAt,
  type Timeline,
  type TruckStatus,
} from '@/lib/simulation';
import { RouteMap } from './RouteMap';

const SPEEDS = [1, 3, 6, 12, 24];
const HOUR = 3_600_000;
/** Refresh interval of the clock label, slider and truck list while playing. */
const UI_REFRESH_MS = 200;

const STATUS_KEY: Record<TruckStatus, MessageKey> = {
  waiting: 'sim.waiting',
  driving: 'sim.driving',
  returning: 'sim.returning',
  done: 'sim.done',
};

/**
 * One truck in the side panel. Its props only change when the truck changes status, delivers or
 * moves to a new stop, so between those events React skips it entirely (important with 200 trucks).
 */
const TruckRow = memo(function TruckRow({
  timeline,
  index,
  status,
  delivered,
  next,
  isSelected,
  names,
  onSelect,
}: {
  timeline: Timeline;
  index: number;
  status: TruckStatus;
  delivered: number;
  next: Stop | null;
  isSelected: boolean;
  names: Map<string, string>;
  onSelect: (routeId: string | null) => void;
}) {
  const { t, f } = useI18n();
  const routeId = timeline.route.route_id;
  const margin = next?.expiry_margin_h;
  return (
    <li>
      <button
        onClick={() => onSelect(isSelected ? null : routeId)}
        className={cx(
          'flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left text-xs transition hover:bg-white/5',
          isSelected && 'bg-accent/10',
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-medium text-fg">
            <span className="size-2.5 rounded-full" style={{ background: routeColor(index) }} aria-hidden />
            {t('res.col.truck')} {timeline.route.truck_number}
          </span>
          <span className="text-muted">{t(STATUS_KEY[status])}</span>
        </span>
        <span className="text-muted">
          {t('sim.delivered', { n: delivered, total: timeline.stops.length })}
        </span>
        {next && (
          <span className="flex flex-wrap gap-x-3 text-muted">
            <span>
              {t('sim.nextStop')}:{' '}
              <span className="text-fg">{names.get(next.destination_id) ?? next.destination_id}</span>
            </span>
            <span>
              {t('sim.eta')}:{' '}
              <span className="text-fg tabular-nums">{f.dateTime(next.estimated_arrival)}</span>
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
});

/** Side panel with the status of each truck at the given time. */
const TruckList = memo(function TruckList({
  timelines,
  time,
  names,
  selected,
  onSelect,
  maxHeight,
}: {
  timelines: Timeline[];
  time: number;
  names: Map<string, string>;
  selected: string | null;
  onSelect: (routeId: string | null) => void;
  maxHeight: number;
}) {
  const { t } = useI18n();
  const states = timelines.map((tl, i) => ({ tl, i, state: truckStateAt(tl, time) }));
  const active = states.filter((s) => s.state.status === 'driving' || s.state.status === 'returning').length;
  const list = selected ? states.filter((s) => s.tl.route.route_id === selected) : states;

  return (
    <div className="flex flex-col rounded-xl border border-line bg-glass-strong" style={{ maxHeight }}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-sm font-semibold">{t('sim.title')}</span>
        <Badge tone="accent">
          {t('sim.fleet')}: {active}/{timelines.length}
        </Badge>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {list.map(({ tl, i, state }) => (
          <TruckRow
            key={tl.route.route_id}
            timeline={tl}
            index={i}
            status={state.status}
            delivered={state.delivered}
            next={state.next}
            isSelected={selected === tl.route.route_id}
            names={names}
            onSelect={onSelect}
          />
        ))}
      </ul>
      {selected && (
        <div className="border-t border-line p-2">
          <Button size="sm" variant="ghost" className="w-full" onClick={() => onSelect(null)}>
            {t('res.showAll')}
          </Button>
        </div>
      )}
    </div>
  );
});

export function Simulator({
  timelines,
  destinations,
  selected,
  onSelect,
  mapHeight = 520,
}: {
  timelines: Timeline[];
  destinations: Destination[];
  selected: string | null;
  onSelect: (routeId: string | null) => void;
  /** Height of the map in px; the truck panel takes the same height. */
  mapHeight?: number;
}) {
  const { t, f } = useI18n();
  const { start, end } = useMemo(() => simulationBounds(timelines), [timelines]);
  const [clock] = useState(() => new SimClock(start));
  const [uiTime, setUiTime] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(6);
  const names = useMemo(() => new Map(destinations.map((d) => [d.destination_id, d.name])), [destinations]);

  /** Moves the clock and refreshes the rest of the interface at once (used by the controls). */
  const jump = (time: number) => {
    clock.set(time);
    setUiTime(time);
  };

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    let lastUi = last;
    const tick = (now: number) => {
      const next = Math.min(end, clock.get() + ((now - last) / 1000) * speed * HOUR);
      last = now;
      clock.set(next);
      if (next >= end) {
        setUiTime(next);
        setPlaying(false);
        return;
      }
      if (now - lastUi >= UI_REFRESH_MS) {
        lastUi = now;
        setUiTime(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setUiTime(clock.get());
    };
  }, [playing, speed, end, clock]);

  const iso = new Date(uiTime).toISOString().slice(0, 19);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-3">
        <RouteMap
          timelines={timelines}
          destinations={destinations}
          selected={selected}
          onSelect={onSelect}
          clock={clock}
          height={mapHeight}
        />
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-glass-strong px-3 py-2">
          <Button
            size="sm"
            variant="primary"
            icon={playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            onClick={() => {
              if (!playing && clock.get() >= end) jump(start);
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
              setPlaying(false);
              jump(start);
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
            value={uiTime}
            onChange={(e) => {
              setPlaying(false);
              jump(Number(e.target.value));
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
      <TruckList
        timelines={timelines}
        time={uiTime}
        names={names}
        selected={selected}
        onSelect={onSelect}
        maxHeight={mapHeight + 64}
      />
    </div>
  );
}
