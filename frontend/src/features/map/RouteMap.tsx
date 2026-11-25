/**
 * Route map (RF-11): Leaflet on OpenStreetMap tiles (no API key). One color per route from Mataró,
 * destinations as small dots, and the trucks of the simulator when a simulated time is given.
 */
import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import { useI18n } from '@/i18n';
import type { Destination } from '@/types/entities';
import { routeColor, truckStateAt, type Timeline } from '@/lib/simulation';

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

export function RouteMap({
  timelines,
  destinations,
  selected,
  onSelect,
  time,
  height = 520,
}: {
  timelines: Timeline[];
  destinations: Destination[];
  selected: string | null;
  onSelect: (routeId: string | null) => void;
  /** Simulated time in ms; null hides the trucks. */
  time: number | null;
  height?: number;
}) {
  const { t, f } = useI18n();
  const depot = destinations.find((d) => d.destination_id === 'D000');
  const names = useMemo(() => new Map(destinations.map((d) => [d.destination_id, d.name])), [destinations]);
  const visited = useMemo(() => {
    const ids = new Set(timelines.flatMap((tl) => tl.stops.map((s) => s.destination_id)));
    return destinations.filter((d) => ids.has(d.destination_id) && d.latitude != null && d.longitude != null);
  }, [timelines, destinations]);
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
      <MapContainer bounds={IBERIA} scrollWheelZoom={false} className="h-full w-full" attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds bounds={bounds} />
        {timelines.map((tl, i) => {
          const isSelected = selected === tl.route.route_id;
          const dimmed = selected !== null && !isSelected;
          const positions: LatLngExpression[] = tl.route.geometry ?? tl.points.map((p) => [p.lat, p.lon]);
          return (
            <Polyline
              key={tl.route.route_id}
              positions={positions}
              pathOptions={{
                color: routeColor(i),
                weight: isSelected ? 5 : 3,
                opacity: dimmed ? 0.15 : 0.85,
              }}
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
        {time !== null &&
          timelines.map((tl, i) => {
            const state = truckStateAt(tl, time);
            if (state.status === 'waiting' || state.status === 'done') return null;
            const isSelected = selected === tl.route.route_id;
            return (
              <CircleMarker
                key={`truck-${tl.route.route_id}`}
                center={[state.lat, state.lon]}
                radius={isSelected ? 8 : 6}
                pathOptions={{ color: '#ffffff', weight: 2, fillColor: routeColor(i), fillOpacity: 1 }}
                eventHandlers={{ click: () => onSelect(tl.route.route_id) }}
              >
                <Tooltip>
                  {t('res.col.truck')} {tl.route.truck_number}
                  {state.next && ` → ${names.get(state.next.destination_id) ?? state.next.destination_id}`}
                </Tooltip>
              </CircleMarker>
            );
          })}
      </MapContainer>
    </div>
  );
}
