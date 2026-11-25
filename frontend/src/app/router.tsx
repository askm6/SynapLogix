import { createBrowserRouter } from 'react-router';
import { Layout } from './Layout';
import { Spinner } from '@/components/ui';

/** Each screen is loaded on demand, so the map and the charts only download when they are opened. */
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
});

/** Spanish paths, matching the screens of section 5.5 of the report. */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    hydrateFallbackElement: <Spinner label="…" />,
    children: [
      { index: true, lazy: page(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage }))) },
      { path: 'datos', lazy: page(() => import('@/pages/DataPage').then((m) => ({ default: m.DataPage }))) },
      {
        path: 'flota',
        lazy: page(() => import('@/pages/FleetPage').then((m) => ({ default: m.FleetPage }))),
      },
      {
        path: 'optimizacion',
        lazy: page(() => import('@/pages/OptimizePage').then((m) => ({ default: m.OptimizePage }))),
      },
      {
        path: 'resultados',
        lazy: page(() => import('@/pages/ResultsPage').then((m) => ({ default: m.ResultsPage }))),
      },
      {
        path: 'resultados/:runId',
        lazy: page(() => import('@/pages/ResultsPage').then((m) => ({ default: m.ResultsPage }))),
      },
      {
        path: 'mapa',
        lazy: page(() => import('@/pages/MapPage').then((m) => ({ default: m.MapPage }))),
      },
      {
        path: 'mapa/:runId',
        lazy: page(() => import('@/pages/MapPage').then((m) => ({ default: m.MapPage }))),
      },
      {
        path: 'comparar',
        lazy: page(() => import('@/pages/ComparePage').then((m) => ({ default: m.ComparePage }))),
      },
    ],
  },
]);
