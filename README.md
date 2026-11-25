# SynapLogix

**Intelligent routes. Smarter Logistics.**

Delivery planning and route optimization platform for perishable goods.

SynapLogix is being developed for IA DELIVERY SL, a manufacturer of short-shelf-life food products based in Mataró (Barcelona). The company currently outsources its deliveries and wants to bring them in-house with the smallest possible fleet of its own trucks. SynapLogix calculates the minimum number of trucks needed to serve every order across mainland Spain (Portugal and Andorra are out of scope), and guarantees that each order arrives before its most perishable product expires.

## The problem

From a technical point of view, this is a capacitated vehicle routing problem with time windows (CVRPTW):

- a single depot in Mataró, where every route starts and ends;
- a homogeneous fleet with the same capacity (in product units), average speed and cost per km for every truck;
- orders that cannot be split between trucks;
- a delivery deadline for each order.

The objective is hierarchical. First minimize the number of trucks, then the total distance (and therefore the cost), and finally the total delivery time.

Each order's dates follow the rules of the project brief. Production starts the day after the order is received.

| Concept | Rule |
|---------|------|
| Expiry date of each line | order date + manufacturing days + shelf-life days |
| Expiry date of the order | the earliest expiry date among its lines |
| Ready date of the order | order date + 1 + the longest manufacturing time among its lines |

A truck leaves Mataró at 08:00 on the latest ready date among the orders it carries. Each order must arrive by 23:59 on its expiry date.

## Current status

| Part | Status |
|------|--------|
| Calculation core (Python) | Done and covered by unit tests |
| Web interface (React) | Done, running on mock data until the API exists |
| REST API (FastAPI), database, OSRM, OR-Tools, Docker Compose | Not started |

### Calculation core

The calculation core lives in `backend/synaplogix`:

- **Data model and date rules.** Ready date and expiry date of every order.
- **Data loading and validation.** A reproducible synthetic scenario generator with a fixed seed.
- **Distances.** Estimated road distances between the 48 points (Mataró and 47 destinations), computed as the Haversine distance × 1.25. This is the documented fallback for when the OSRM routing service is not available.
- **Clarke-Wright savings algorithm.** Used as the reference solution.
- **Simulated annealing.** An in-house metaheuristic that improves the reference solution with relocate, swap and 2-opt moves.
- **Validation and indicators.** An independent validator that checks capacity, expiry and single assignment of every order, a lower bound on the number of trucks, and KPIs: trucks, km, cost, hours, load factor and expiry margin.

### Web interface

The web interface is in `frontend/` (React, TypeScript, Vite and Leaflet with OpenStreetMap tiles). It has the Home, Data, Fleet, Optimization, Results, Map and Compare screens, in Spanish and English, with dark and light themes, and a truck simulator on the map. Until the API exists it runs on its own: a mock service layer with the same entities and endpoints as the planned API, and an in-browser port of the calculation core. Setting `VITE_USE_MOCKS=false` connects it to the API. See [frontend/README.md](frontend/README.md), which also documents the API contract the backend has to implement.

### Not implemented yet

The REST API (FastAPI), the database, the OSRM routing engine, the OR-Tools solver and the Docker Compose setup. The project report plans PostgreSQL with the data model of its section 4.4; the class database (`BDIADelivery`, SQL Server) uses a different model in Spanish, so the backend will have to choose one and adapt the other.

## Repository structure

```
backend/
  synaplogix/
    models.py            entities and date rules
    data.py              data loading, input validation and scenario generator
    routing.py           distances, Clarke-Wright, simulated annealing, validator and KPIs
  tests/
    test_core.py         unit tests PU-01 to PU-09 and the metaheuristic test
  benchmark.py           scenarios S1-S3 and scalability test (writes benchmark_results.json)
  benchmark_results.json results of the latest benchmark run
  measure_coverage.py    line coverage of the calculation core
  app/                   REST API (planned): api, core, optim and db packages
data/
  destinations.csv       Mataró (D000) and the 47 mainland provincial capitals (D001-D047) with GPS coordinates
docs/                    project documentation (planned)
frontend/
  src/                   screens, map and simulator, service layer (HTTP and mock), types and texts
  e2e/                   Playwright acceptance tests (scenarios E1 and E5)
  scripts/               build_mock_fixtures.py: mock data generated with backend/synaplogix
```

The calculation core currently lives in `backend/synaplogix`. When the REST API is integrated, it will move to `backend/app/core` and `backend/app/optim`.

## Getting started

### Calculation core

You need Python 3.11 or later.

```bash
cd backend
python -m venv .venv                 # optional: a virtual environment (ignored by Git)
.venv/Scripts/activate               # Windows; on macOS or Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m pytest -q                  # unit tests
python measure_coverage.py           # line coverage of the calculation core
python benchmark.py                  # scenarios S1-S3 and scalability (about 4 minutes)
```

### Web interface

You need Node.js 20 or later.

```bash
cd frontend
npm install
npm run dev                          # http://localhost:5173
npm test                             # unit tests
```

If you change `data/destinations.csv`, run `npm run fixtures` in `frontend/` to rebuild the mock data.

## Input data

All files use a semicolon as the field separator and a dot as the decimal separator.

| File | Header |
|------|--------|
| `products.csv` | `product_id;name;sale_price;manufacturing_days;shelf_life_days` |
| `destinations.csv` | `destination_id;name;latitude;longitude` |
| `orders.csv` | `order_id;order_date;customer_id;destination_id` |
| `order_lines.csv` | `order_id;product_id;quantity` |

## Results

These results come from `backend/benchmark.py` (`benchmark_results.json`). They use a test fleet of 60,000 units per truck, 70 km/h and €1.10 per km, with no driving-time limit, estimated distances and the 47 mainland provincial capitals. The simulated annealing runs for 10, 30 and 60 seconds in S1, S2 and S3.

| Scenario | Orders | Clarke-Wright | Simulated annealing | Lower bound | Infeasible orders |
|----------|-------:|--------------:|--------------------:|------------:|------------------:|
| S1       |     50 | 24 trucks · 35,994 km | 21 trucks · 33,178 km |          19 |  2 |
| S2       |    200 | 95 trucks · 127,147 km | 85 trucks · 117,241 km |          76 | 16 |
| S3       |    500 | 236 trucks · 324,785 km | 214 trucks · 296,482 km |         199 | 26 |

No solution violates the capacity or expiry constraints. Infeasible orders cannot reach their destination before expiring, even on a direct route, so they are reported with their reason and excluded from the plan. The simulated annealing uses 9 to 13 % fewer trucks than Clarke-Wright.

The project report (sections 7.3 to 7.5) still shows an earlier run that also included Portugal and Andorra; these are the current figures.

## Author

Maxime Pol Marcet
