"""Unit tests PU-01 to PU-09 from section 6.3 of the P1 report, plus a metaheuristic test."""
import math
from datetime import date

import pytest

from synaplogix.data import DEPOT, generate_orders, generate_products, load_destinations, validate
from synaplogix.models import Fleet, Order, OrderLine, Product, order_expiry_date, order_ready_date
from synaplogix.routing import (DOES_NOT_FIT, WOULD_EXPIRE, Instance, clarke_wright, distance_matrix,
                                haversine_km, kpis, simulated_annealing, validate_solution)

DESTINATIONS = load_destinations()
DIST = distance_matrix(DESTINATIONS)
F = date(2026, 11, 12)
PRODUCTS = {"A": Product("A", "Yogurt", 0.5, 1, 14), "B": Product("B", "Gazpacho", 2.0, 3, 5),
            "C": Product("C", "Cheese", 3.0, 2, 30)}
FLEET = Fleet(capacity_units=1000, speed_kmh=70, cost_per_km=1.0)


def make_order(order_id, destination, lines, order_date=F):
    return Order(order_id, order_date, "C001", destination, [OrderLine(p, q) for p, q in lines])


def test_pu01_order_expiry_is_the_minimum():
    order = make_order("X", "D026", [("A", 10), ("B", 10)])
    assert order_expiry_date(order, PRODUCTS) == date(2026, 11, 20)  # B: 12 + 3 + 5 = 20 < A: 12 + 1 + 14 = 27


def test_pu02_ready_date_is_f_plus_4():
    order = make_order("X", "D026", [("A", 10), ("B", 10)])  # manufacturing times of 1 and 3 days
    assert order_ready_date(order, PRODUCTS) == date(2026, 11, 16)


def test_pu03_input_validation():
    bad = [make_order("X", "D026", [("Z", 5)]), make_order("Y", "D999", [("A", 0)])]
    errors = validate(bad, PRODUCTS, DESTINATIONS)
    assert any("unknown product Z" in e for e in errors)
    assert any("unknown destination D999" in e for e in errors)
    assert any("non-positive quantity" in e for e in errors)


def test_pu04_order_that_does_not_fit():
    inst = Instance.build([make_order("X", "D026", [("A", 1500)])], PRODUCTS, DIST, FLEET)
    assert inst.infeasible_orders() == {"X": DOES_NOT_FIT}


def test_pu05_order_that_would_expire():
    products = {"R": Product("R", "Fast", 1.0, 1, 0)}  # expires on the same day it is ready
    slow = Fleet(capacity_units=1000, speed_kmh=20, cost_per_km=1.0)  # Lisbon at 20 km/h takes more than 16 h
    inst = Instance.build([make_order("X", "D058", [("R", 10)])], products, DIST, slow)
    assert inst.infeasible_orders() == {"X": WOULD_EXPIRE}


def test_pu06_validator_rejects_capacity_overflow():
    orders = [make_order("X", "D026", [("A", 700)]), make_order("Y", "D026", [("A", 700)])]
    inst = Instance.build(orders, PRODUCTS, DIST, FLEET)
    assert validate_solution(inst, [["X", "Y"]], ["X", "Y"])


def test_pu07_clarke_wright_scenario_s0():
    # S0: five orders that can be checked by hand; everything fits in two 1,000-unit trucks
    orders = [make_order("P1", "D007", [("A", 400)]), make_order("P2", "D040", [("A", 300)]),
              make_order("P3", "D043", [("A", 300)]), make_order("P4", "D047", [("A", 400)]),
              make_order("P5", "D023", [("A", 500)])]
    inst = Instance.build(orders, PRODUCTS, DIST, FLEET)
    routes = clarke_wright(inst, [o.id for o in orders])
    assert len(routes) == 2
    assert validate_solution(inst, routes, [o.id for o in orders]) == []


def test_pu08_kpis_of_a_known_route():
    orders = [make_order("P1", "D026", [("A", 500)])]
    inst = Instance.build(orders, PRODUCTS, DIST, FLEET)
    k = kpis(inst, [["P1"]])
    expected = 2 * DIST[DEPOT, "D026"]
    assert k["trucks"] == 1 and math.isclose(k["km"], round(expected, 1))
    assert math.isclose(k["cost"], round(expected * 1.0, 2)) and k["load_factor"] == 0.5


def test_pu09_haversine_madrid_barcelona():
    # Reference great-circle distance between Madrid and Barcelona: about 505 km
    assert haversine_km(DESTINATIONS["D026"], DESTINATIONS["D007"]) == pytest.approx(505, rel=0.01)


def test_metaheuristic_is_valid_and_never_worse():
    products = generate_products(seed=3)
    orders = generate_orders(40, DESTINATIONS, products, mean_lines=10, seed=3)
    inst = Instance.build(orders, products, DIST, Fleet(15000, 70, 1.0))
    feasible = [o.id for o in orders if o.id not in inst.infeasible_orders()]
    baseline = clarke_wright(inst, feasible)
    best = simulated_annealing(inst, baseline, seconds=2, seed=3)
    assert validate_solution(inst, best, feasible) == []
    assert len(best) <= len(baseline)
