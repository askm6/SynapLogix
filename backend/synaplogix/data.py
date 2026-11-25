"""Destination loading, input validation and synthetic scenario generator (section 5.2 of the P1 report)."""
from __future__ import annotations

import csv
import random
from datetime import date, timedelta
from pathlib import Path

from .models import Destination, Order, OrderLine, Product

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DEPOT = "D000"  # Mataró


def load_destinations(path: Path = DATA_DIR / "destinations.csv") -> dict[str, Destination]:
    """Read the depot and the delivery destinations (destination_id;name;latitude;longitude)."""
    with open(path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f, delimiter=";"))
    return {r["destination_id"]: Destination(r["destination_id"], r["name"],
                                             float(r["latitude"]), float(r["longitude"])) for r in rows}


PRODUCT_NAMES = ["Plain yogurt", "Greek yogurt", "Kefir", "Fresh milk", "Fresh cream", "Fresh cheese",
                 "Ricotta", "Mozzarella", "Hummus", "Gazpacho", "Salmorejo", "Ready-made salad",
                 "Fresh sliced bread", "Croissant", "Pizza dough", "Fresh pasta", "Chilled omelette",
                 "Fresh orange juice", "Fruit smoothie", "Dairy dessert"]


def generate_products(n: int = 60, seed: int = 1) -> dict[str, Product]:
    """Synthetic catalog: manufacturing time of 1-3 days and shelf life of 3-21 days (section 5.2)."""
    rnd = random.Random(seed)
    products = {}
    for i in range(1, n + 1):
        pid = f"P{i:03d}"
        name = f"{PRODUCT_NAMES[(i - 1) % len(PRODUCT_NAMES)]} {1 + (i - 1) // len(PRODUCT_NAMES)}"
        products[pid] = Product(pid, name, round(rnd.uniform(0.4, 6.0), 2), rnd.randint(1, 3), rnd.randint(3, 21))
    return products


def generate_orders(n_orders: int, destinations: dict[str, Destination], products: dict[str, Product],
                    mean_lines: int = 100, max_units: int = 500, seed: int = 1,
                    reference_date: date = date(2026, 11, 12)) -> list[Order]:
    """Reproducible synthetic orders (RF-05).

    Each order has mean_lines ± 50 % lines, each with 1 to max_units units, and an order date
    on the reference date or the day before.
    """
    rnd = random.Random(seed)
    destination_ids = [d for d in destinations if d != DEPOT]
    product_ids = list(products)
    orders = []
    for i in range(1, n_orders + 1):
        n_lines = max(1, min(len(product_ids), round(rnd.uniform(0.5, 1.5) * mean_lines)))
        chosen = rnd.sample(product_ids, n_lines) if n_lines <= len(product_ids) else product_ids
        lines = [OrderLine(p, rnd.randint(1, max_units)) for p in chosen]
        orders.append(Order(f"ORD{i:04d}", reference_date - timedelta(days=rnd.randint(0, 1)),
                            f"C{rnd.randint(1, 120):03d}", rnd.choice(destination_ids), lines))
    return orders


def validate(orders: list[Order], products: dict[str, Product], destinations: dict[str, Destination]) -> list[str]:
    """Return the list of input errors (ERR-02 and ERR-03 in section 3.5). An empty list means valid data."""
    errors, seen = [], set()
    for order in orders:
        if order.id in seen:
            errors.append(f"{order.id}: duplicate order")
        seen.add(order.id)
        if order.destination not in destinations or order.destination == DEPOT:
            errors.append(f"{order.id}: unknown destination {order.destination}")
        if not order.lines:
            errors.append(f"{order.id}: order has no lines")
        for line in order.lines:
            if line.product not in products:
                errors.append(f"{order.id}: unknown product {line.product}")
            if line.quantity <= 0:
                errors.append(f"{order.id}: non-positive quantity for {line.product}")
    return errors
