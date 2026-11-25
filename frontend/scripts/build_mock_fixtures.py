"""Build the frontend mock fixtures from the Python calculation core (backend/synaplogix).

The fixtures use exactly the entities of section 4.4 of the project report (snake_case):
destinations, products, and scenario S1 (orders and order_lines, seed 101), plus the reference
KPIs of Clarke-Wright for S1 so the TypeScript mock solver can be checked against the Python core.

Run from the frontend folder:  python scripts/build_mock_fixtures.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from synaplogix.data import DEPOT, generate_orders, generate_products, load_destinations  # noqa: E402
from synaplogix.models import Fleet  # noqa: E402
from synaplogix.routing import Instance, clarke_wright, distance_matrix, kpis  # noqa: E402

OUT = ROOT / "frontend" / "src" / "services" / "mocks" / "fixtures"
SEED, N_ORDERS = 101, 50  # scenario S1 (section 6.2)
FLEET = Fleet(capacity_units=60_000, speed_kmh=70, cost_per_km=1.10)  # test fleet of section 7.3


def write(name: str, data) -> None:
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {name}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    destinations = load_destinations()
    products = generate_products(200, SEED)
    orders = generate_orders(N_ORDERS, destinations, products, seed=SEED)

    write("destinations.json", [
        {"destination_id": d.id, "name": d.name, "latitude": d.lat, "longitude": d.lon, "km_from_mataro": None}
        for d in destinations.values()])
    write("products.json", [
        {"product_id": p.id, "name": p.name, "sale_price": p.sale_price,
         "manufacturing_days": p.manufacturing_days, "shelf_life_days": p.shelf_life_days}
        for p in products.values()])
    write("scenario_s1.json", {
        "scenario": {"scenario_id": "S1", "name": "S1 Pequeño", "type": "training", "seed": SEED,
                     "created_at": "2026-11-13T09:00:00"},
        "orders": [{"order_id": o.id, "scenario_id": "S1", "order_date": o.order_date.isoformat(),
                    "customer_id": o.customer, "destination_id": o.destination} for o in orders],
        "order_lines": [{"order_id": o.id, "product_id": line.product, "quantity": line.quantity}
                        for o in orders for line in o.lines],
    })

    inst = Instance.build(orders, products, distance_matrix(destinations), FLEET)
    infeasible = inst.infeasible_orders()
    feasible = [o.id for o in orders if o.id not in infeasible]
    routes = clarke_wright(inst, feasible)
    write("reference_s1.json", {"fleet": FLEET.__dict__, "depot": DEPOT, "infeasible": infeasible,
                                "clarke_wright": kpis(inst, routes), "routes": routes})


if __name__ == "__main__":
    main()
