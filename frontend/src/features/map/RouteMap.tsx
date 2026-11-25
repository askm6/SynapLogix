/**
 * Route map (RF-11): Leaflet on OpenStreetMap tiles (no API key). One color per route from Mataró,
 * destinations as small dots, and the trucks of the simulator when a clock is given.
 *
 * Performance: the map draws on a canvas (preferCanvas). Routes, destinations and the depot are a
 * memoized layer that only re-renders when the solution or the selection changes; the trucks are
 * Leaflet markers moved imperatively on every clock tick, with no React render per frame.
 */
import { memo, useEffect, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L, { type LatLngBoundsExpression, type LatLngExpression } from 'leaflet';
import { useI18n } from '@/i18n';
import type { Destination } from '@/types/entities';
import { routeColor, truckStateAt, type SimClock, type Timeline } from '@/lib/simulation';

const IBERIA: LatLngBoundsExpression = [
  [36.0, -9.5],
  [43.8, 3.4],
];

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, bounds]);
  return null;
}

interface LayerProps {
  timelines: Timeline[];
  destinations: Destination[];
  selected: string | null;
  onSelect: (routeId: string | null) => void;
}

/** Routes, visited destinations and the depot. Re-renders only when its props change. */
const StaticLayers = memo(function StaticLayers({ timelines, destinations, selected, onSelect }: LayerProps) {
  const { t, f } = useI18n();
  const depot = destinations.find((d) => d.destination_id === 'D000');
  const visited = useMemo(() => {
    const ids = new Set(timelines.flatMap((tl) => tl.stops.map((s) => s.destination_id)));
    return destinations.filter((d) => ids.has(d.destination_id) && d.latitude != null && d.longitude != null);
  }, [timelines, destinations]);

  return (
    <>
      {timelines.map((tl, i) => {
        const isSelected = selected === tl.route.route_id;
        const dimmed = selected !== null && !isSelected;
        const positions: LatLngExpression[] = tl.route.geometry ?? tl.points.map((p) => [p.lat, p.lon]);
        return (
          <Polyline
            key={tl.route.route_id}
            positions={positions}
            pathOptions={{ color: routeColor(i), weight: isSelected ? 5 : 3, opacity: dimmed ? 0.15 : 0.85 }}
            eventHandlers={{ click: () => onSelect(isSelected ? null : tl.route.route_id) }}
          >
            <Tooltip sticky>
              {t('res.col.truck')} {tl.route.truck_number} · {f.km(tl.route.km)} · {tl.stops.length}{' '}
              {t('res.col.stops').toLowerCase()}
            </Tooltip>
          </Polyline>
        );
      })}
      {visited.map((d) => (
        <CircleMarker
          key={d.destination_id}
          center={[d.latitude!, d.longitude!]}
          radius={3.5}
          pathOptions={{ color: '#ffffff', weight: 1, fillColor: '#9fb4c8', fillOpacity: 0.9 }}
        >
          <Tooltip>{d.name}</Tooltip>
        </CircleMarker>
      ))}
      {depot?.latitude != null && depot.longitude != null && (
        <CircleMarker
          center={[depot.latitude, depot.longitude]}
          radius={9}
          pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#3AA7FF', fillOpacity: 1 }}
        >
          <Tooltip permanent direction="right" offset={[10, 0]}>
            {t('res.depot')}
          </Tooltip>
        </CircleMarker>
      )}
    </>
  );
});

/** One Leaflet marker per truck, created once per solution and moved on every clock tick. */
function TruckLayer({
  timelines,
  clock,
  selected,
  onSelect,
}: {
  timelines: Timeline[];
  clock: SimClock;
  selected: string | null;
  onSelect: (routeId: string | null) => void;
}) {
  const map = useMap();
  const { t } = useI18n();
  const markers = useRef<L.CircleMarker[]>([]);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    // The trucks get their own pane and canvas, so moving them never redraws the routes underneath.
    const pane = map.getPane('trucks') ?? map.createPane('trucks');
    pane.style.zIndex = '450';
    const renderer = L.canvas({ pane: 'trucks' });
    const layer = L.layerGroup().addTo(map);
    markers.current = timelines.map((tl, i) => {
      const marker = L.circleMarker([0, 0], {
        pane: 'trucks',
        renderer,
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: routeColor(i),
        fillOpacity: 1,
      });
      marker.bindTooltip(`${t('res.col.truck')} ${tl.route.truck_number}`);
      marker.on('click', () => onSelectRef.current(tl.route.route_id));
      return marker;
    });
    const visible = new Array<boolean>(timelines.length).fill(false);
    const update = (time: number) => {
      timelines.forEach((tl, i) => {
        const state = truckStateAt(tl, time);
        const show = state.status === 'driving' || state.status === 'returning';
        const marker = markers.current[i];
        if (show) {
          marker.setLatLng([state.lat, state.lon]);
          if (!visible[i]) layer.addLayer(marker);
        } else if (visible[i]) {
          layer.removeLayer(marker);
        }
        visible[i] = show;
      });
    };
    update(clock.get());
    const unsubscribe = clock.subscribe(update);
    return () => {
      unsubscribe();
      layer.remove();
    };
  }, [map, timelines, clock, t]);

  useEffect(() => {
    timelines.forEach((tl, i) => markers.current[i]?.setRadius(selected === tl.route.route_id ? 8 : 6));
  }, [selected, timelines]);

  return null;
}

export function RouteMap({
  timelines,
  destinations,
  selected,
  onSelect,
  clock,
  height = 520,
}: LayerProps & {
  /** Simulated clock; without one the trucks are hidden. */
  clock: SimClock | null;
  height?: number;
}) {
  const bounds = useMemo<LatLngBoundsExpression>(() => {
    const pts = timelines.flatMap((tl) => tl.points.map((p) => [p.lat, p.lon] as [number, number]));
    if (!pts.length) return IBERIA;
    const lats = pts.map((p) => p[0]);
    const lons = pts.map((p) => p[1]);
    return [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ];
  }, [timelines]);

  return (
    <div className="overflow-hidden rounded-xl border border-line" style={{ height }}>
      {/* Wheel zoom is off so scrolling the page never gets stuck on the map; use the +/- buttons or double click. */}
      <MapContainer
        bounds={IBERIA}
        preferCanvas
        scrollWheelZoom={false}
        className="h-full w-full"
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds bounds={bounds} />
        <StaticLayers
          timelines={timelines}
          destinations={destinations}
          selected={selected}
          onSelect={onSelect}
        />
        {clock && <TruckLayer timelines={timelines} clock={clock} selected={selected} onSelect={onSelect} />}
      </MapContainer>
    </div>
  );
}
