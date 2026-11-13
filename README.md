# SynapLogix

**Intelligent routes. Smarter Logistics.**

Delivery planning and route optimization platform for perishable goods.

SynapLogix is being developed for IA DELIVERY SL, a manufacturer of short-shelf-life food products based in Mataró (Barcelona). The company currently outsources its deliveries and wants to bring them in-house with the smallest possible fleet of its own trucks. SynapLogix calculates the minimum number of trucks needed to serve every order across mainland Spain, mainland Portugal and Andorra, and guarantees that each order arrives before its most perishable product expires.

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

The calculation core is implemented in Python and covered by unit tests:

- **Data model and date rules.** Ready date and expiry date of every order.
- **Data loading and validation.** A reproducible synthetic scenario generator with a fixed seed.
- **Distances.** Estimated road distances between the 67 points (Mataró and 66 destinations), computed as the Haversine distance × 1.25. This is the documented fallback for when the OSRM routing service is not available.
- **Clarke-Wright savings algorithm.** Used as the reference solution.
- **Simulated annealing.** An in-house metaheuristic that improves the reference solution with relocate, swap and 2-opt moves.
- **Validation and indicators.** An independent validator that checks capacity, expiry and single assignment of every order, a lower bound on the number of trucks, and KPIs: trucks, km, cost, hours, load factor and expiry margin.

Not yet implemented: the REST API (FastAPI), the web interface (React and Leaflet), the OSRM routing engine and the OR-Tools solver.

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
data/
  destinations.csv       Mataró (D000) and the 66 destinations (D001-D066) with GPS coordinates
```

## Getting started

You need Python 3.11 or later.

```bash
cd backend
pip install -r requirements.txt
python -m pytest -q          # unit tests
python measure_coverage.py   # line coverage of the calculation core
python benchmark.py          # scenarios S1-S3 and scalability (about 4 minutes)
```

## Input data

All files use a semicolon as the field separator and a dot as the decimal separator.

| File | Header |
|------|--------|
| `products.csv` | `product_id;name;sale_price;manufacturing_days;shelf_life_days` |
| `destinations.csv` | `destination_id;name;latitude;longitude` |
| `orders.csv` | `order_id;order_date;customer_id;destination_id` |
| `order_lines.csv` | `order_id;product_id;quantity` |

## Results

These results use a test fleet of 60,000 units per truck, 70 km/h and €1.10 per km, with no driving-time limit and estimated distances.

| Scenario | Orders | Clarke-Wright | Simulated annealing | Lower bound |
|----------|-------:|--------------:|--------------------:|------------:|
| S1       |     50 |     21 trucks |           21 trucks |          17 |
| S2       |    200 |     76 trucks |           70 trucks |          64 |
| S3       |    500 |    219 trucks |          195 trucks |         179 |

No solution violates the capacity or expiry constraints. Some orders cannot reach their destination before expiring, even on a direct route, so they are reported as infeasible and excluded from the plan. This affects 10 orders in S1, 39 in S2 and 62 in S3 (see section 7.3 of the project report).

## Author

Maxime Pol Marcet
