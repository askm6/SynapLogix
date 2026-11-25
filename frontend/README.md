# SynapLogix frontend

Web interface of SynapLogix, built with React, TypeScript and Vite. It covers the six screens of section 5.5 of the project report plus a dedicated map screen, shows the routes on a Leaflet map with OpenStreetMap tiles and animates them with a truck simulator.

The interface is available in **Spanish (default)** and **English**, in **dark mode (default)** and light mode, with the SynapLogix identity: black or white background and the `#3AA7FF` accent.

The app runs today **without the backend**. A mock service layer returns the same entities and endpoints as the planned FastAPI API, and an in-browser port of the calculation core solves the routes. Connecting the real API only means changing one environment variable.

## Getting started

You need Node.js 20 or later.

```bash
cd frontend
cp .env.example .env      # VITE_USE_MOCKS=true by default
npm install
npm run dev               # http://localhost:5173
```

| Command | What it does |
|---------|--------------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type check and production build in `dist/` |
| `npm run preview` | Serves the production build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Acceptance tests (Playwright). Run `npx playwright install chromium` once first |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run fixtures` | Rebuilds the mock fixtures from the Python core (needs Python 3.11+) |

### Environment variables

| Variable | Default | Meaning |
|----------|---------|---------|
| `VITE_USE_MOCKS` | `true` | `true`: everything runs in the browser. `false`: every call goes to the API |
| `VITE_API_URL` | `http://localhost:8000` | Base URL of the FastAPI backend |

## Screens

| Path | Screen | Use cases | What it does |
|------|--------|-----------|--------------|
| `/` | Home | — | Latest run with its KPIs, scenarios, current fleet and quick access to Optimize |
| `/datos` | Data | CU-01, CU-02 | Scenarios and their orders; CSV/Excel import with row-by-row validation errors; synthetic scenario generator with seed (S1-S3 templates); product and destination catalog |
| `/flota` | Fleet | CU-04 | Capacity, average speed, cost per km and optional driving-hours limit (ERR-08 validation); saved configurations |
| `/optimizacion` | Optimization | CU-05 | Scenario, algorithm (Clarke-Wright, OR-Tools, Metaheuristic), time limit and progress bar |
| `/resultados/:runId` | Results | CU-06, CU-08 | KPIs, validator outcome, routes and stops table, infeasible orders with their reason, CSV export, and a link to the map |
| `/mapa/:runId` | Map | CU-06 | Full-height map with one color per route and the truck simulator |
| `/comparar` | Compare | CU-07 | 2 to 4 saved runs side by side, best value per indicator, difference from the reference and charts |

### Map and simulator

The map and the simulator have their own screen (`/mapa`), opened from Results or from the sidebar. Results stays light (indicators and tables only), and the map only loads when it is opened. A finished run never changes, so it is loaded once and kept in the cache: moving between Results, Map and Compare does not call the API again.

The simulator plays the trucks of a run in simulated time: play, pause, restart, speed (1 to 24 simulated hours per second) and a time slider. Each truck leaves Mataró at its departure time, reaches each stop at its estimated arrival and returns to Mataró. Between two points its position is interpolated linearly in time. The trucks move at the full frame rate on their own canvas layer; the clock, the slider and the side panel refresh five times per second. The side panel shows, for each truck, its status, delivered stops, next stop, estimated arrival and expiry margin, in orange below 6 hours. Clicking a route, a truck or a table row selects it on the map.

Without OSRM the routes are drawn as straight lines between stops. When the API returns a road `geometry` for a route, the map draws it instead.

## Architecture

```
pages ──► features ──► hooks (TanStack Query) ──► services ──┬─► api/    (fetch → FastAPI)
  │           │                                              └─► mocks/  (fixtures + Web Worker solver)
  └───────────┴──► components/ui, lib, i18n, app/store (Zustand)
```

- **Pages** compose the features of each screen. They never call `fetch` or know whether mocks are on.
- **Hooks** (`src/hooks/queries.ts`) wrap every service call in TanStack Query: caching, loading and error states, and polling of a running optimization.
- **Services** (`src/services`) implement one interface, `Api` in `services/types.ts`, twice: `api/` over HTTP and `mocks/` in the browser. `services/index.ts` picks one with `VITE_USE_MOCKS`.
- **Types** (`src/types/entities.ts`) are the entities of section 4.4 in `snake_case`, defined as Zod schemas so the same definition validates data and types the code. `src/types/api.ts` adds the request and response shapes.

### Folder structure

```
frontend/
├─ e2e/                      Playwright acceptance tests (PA-01, PA-05)
├─ public/brand/             logo files (provisional mark, see "Pending")
├─ scripts/
│  └─ build_mock_fixtures.py builds the mock fixtures with backend/synaplogix
└─ src/
   ├─ app/                   router, layout (sidebar and top bar), UI store
   ├─ pages/                 one file per screen
   ├─ features/
   │  ├─ data-import/        file reading, row validation, import panel
   │  ├─ scenario-generator/ generator form
   │  ├─ map/                route map and simulator
   │  └─ results/            KPI grid and routes table
   ├─ components/            UI kit (glass cards, buttons, inputs…), virtualized DataTable, logo
   ├─ hooks/                 TanStack Query hooks
   ├─ i18n/                  es.ts (source of keys), en.ts, translate and number/date formatters
   ├─ lib/                   simulator model, CSV export
   ├─ services/
   │  ├─ api/                HTTP client and one call per endpoint
   │  ├─ mocks/              mock API, scenario generator, fixtures and solver (Web Worker)
   │  ├─ types.ts            the service contract
   │  └─ index.ts            chooses mocks or HTTP
   ├─ styles/                Tailwind and theme tokens
   ├─ test/                  Vitest setup
   └─ types/                 entities and API shapes
```

## API contract

The HTTP client calls these endpoints. Bodies and responses use the entities of section 4.4 in `snake_case`; the extra fields are listed in `src/types/api.ts`.

| Method and path | Body | Response |
|-----------------|------|----------|
| `GET /products` | — | `Product[]` |
| `POST /products/import` | `Product[]` | `ImportResult` |
| `GET /destinations` | — | `Destination[]` (includes the depot, `D000`) |
| `POST /destinations/import` | `Destination[]` | `ImportResult` |
| `GET /orders?scenario_id=` | — | `Order[]` |
| `GET /orders/lines?scenario_id=` | — | `OrderLine[]` |
| `POST /orders/import` | `{scenario: {name, type}, orders, order_lines}` | `ImportResult & {scenario}` |
| `GET /scenarios` | — | `ScenarioSummary[]` (scenario plus `n_orders`, `n_lines`, `total_units`) |
| `POST /scenarios/generate` | `{name, n_orders, mean_lines, max_units, seed}` | `ScenarioSummary` |
| `DELETE /scenarios/{scenario_id}` | — | `204` |
| `GET /fleet` | — | `FleetConfig[]`, newest first |
| `GET /fleet/current` | — | `FleetConfig` |
| `POST /fleet` | `FleetConfig` without `fleet_id` | `FleetConfig` (becomes current) |
| `POST /optimize` | `{scenario_id, fleet_id, algorithm, time_limit_s}` | `{run_id, status}` at once |
| `GET /results` | — | `Run[]` (finished runs), newest first |
| `GET /results/{run_id}` | — | `RunDetail` |
| `DELETE /results/{run_id}` | — | `204` |

**Optimization progress.** `POST /optimize` returns immediately with a `run_id`. The interface then polls `GET /results/{run_id}` every second. While running, `RunDetail` carries `status` (`queued`, `running`, `done` or `failed`) and `progress` (0 to 1); when `status` is `done` it also carries `kpis`, `routes`, `stops`, `infeasible` and `validation_errors`.

`RunDetail.routes` extends the `routes` entity with `departure_at` and `return_at`, which the simulator needs, and an optional `geometry` (list of `[lat, lon]`) with the road path from OSRM. `algorithm` is `clarke_wright`, `ortools` or `metaheuristic`. Date-times are naive ISO strings (`2026-11-14T08:00:00`), as the Python core produces them.

**Errors.** The client reads FastAPI's `{"detail": "..."}` or `{"detail": {"message": "...", "field": "..."}}` and raises an `ApiError` with the HTTP status (section 5.6).

**Validation.** The interface validates imported files before sending them (RF-04: missing columns, empty fields, invalid numbers, non-positive values, invalid dates, duplicates and unknown identifiers, each with its row and field). The API must validate again; its `ImportResult.errors` uses the same `RowError` shape.

## Mock mode

With `VITE_USE_MOCKS=true` the app works on its own:

- **Fixtures** come from the Python core: the 66 destinations and Mataró (`data/destinations.csv`), the product catalog and scenario S1 (50 orders, seed 101), written by `scripts/build_mock_fixtures.py`.
- **Solver.** `services/mocks/solver/core.ts` is a port of `backend/synaplogix/routing.py` and `models.py`: date rules, infeasible orders, Clarke-Wright, simulated annealing, validator and KPIs. It runs in a Web Worker so the interface stays responsive. Clarke-Wright reproduces the Python core exactly on S1 (21 trucks, 37,075.8 km, €40,783.34); a unit test checks it against `reference_s1.json`. The simulated annealing uses the same moves but its own random generator, so its results can differ slightly from Python.
- **OR-Tools** cannot run in the browser. In mock mode it runs the metaheuristic, and the results screen says so.
- **Generated scenarios** use the same rules as `data.py` with a different random generator: the same seed always gives the same scenario, but not the same orders as the Python generator.
- **Persistence.** Saved fleets, runs and scenario parameters are kept in `localStorage` (`synaplogix.mock.v1`). Generated scenarios are rebuilt from their seed instead of being stored. The **Reset demo** button in the top bar deletes all of it and starts again from the fixtures.

## Decisions

| Decision | Alternatives | Reason |
|----------|--------------|--------|
| Tailwind CSS v4 with CSS variables for the theme | CSS Modules, a component library | Glass effects and dark/light themes with little code; no visual style imposed by a library |
| TanStack Query for server data | Redux, plain `useEffect` | Caching, loading and error states and polling come built in |
| Zustand for interface state | React Context | Small, and persists theme, language and last selection |
| Own typed i18n (`es.ts`, `en.ts`) | i18next | Two languages and about 220 keys: a typed dictionary catches missing keys at compile time with no dependency |
| Zod schemas as the source of the types | Hand-written interfaces | One definition both validates data and types the code |
| Polling `GET /results/{run_id}` for progress | Server-sent events, WebSocket | Simplest to implement in FastAPI; one request per second is negligible |
| Mock solver ported from the Python core, in a Web Worker | Hand-written result fixtures | Any scenario or fleet can be optimized in the demo (scenario E2) and the numbers match the backend |
| React Router with lazy-loaded screens | One bundle | The map, the charts and SheetJS only download when their screen opens |
| SheetJS from its official CDN | `xlsx` from npm | The npm package is no longer updated and has known vulnerabilities |
| TanStack Table and TanStack Virtual | Plain tables | Sorting, filtering and tens of thousands of rows without slowing down (RNF-02) |
| Simulator: canvas map, trucks moved outside React, side panel refreshed 5 times per second | Re-render the map every frame | Each animation frame costs under 1 ms of JavaScript with 203 trucks (scenario S3), instead of re-rendering every route; the panel around the map has no backdrop blur so the GPU does not re-blur it on every frame |
| Map wheel zoom off | On | Scrolling the page never gets stuck on the map; zoom with the buttons or a double click |
| Dark tiles by CSS filter on OpenStreetMap | Paid dark map styles | No API keys (requirement of the brief) |

## Tests

- **Unit (Vitest, `npm test`):** the mock solver against the Python core (PU-09 and S1 Clarke-Wright), import validation (PU-03, E5), the simulator model and the CSV export.
- **Acceptance (Playwright, `npm run test:e2e`):** E1, daily planning (PA-01), and E5, a file with an unknown product (PA-05), against the dev server in mock mode.

## Pending

- **Official logos.** `public/brand/synaplogix-mark.svg` is a provisional mark; replace it with the official files (light and dark versions) to meet RNF-08.
- **Docker.** A `Dockerfile` for the frontend and its service in `docker-compose.yml` (section 5.8), once the backend is containerized.
- **Bundle size in mock mode.** The S1 fixtures (about 300 KB) are part of the main bundle. With the real backend they could be loaded only when `VITE_USE_MOCKS=true`.
