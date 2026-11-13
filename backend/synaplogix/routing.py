"""Distances, route evaluation, reference solution (Clarke-Wright), metaheuristic (simulated annealing),
independent validator and KPIs (sections 5.3, 5.4 and 7.1 of the P1 report)."""
from __future__ import annotations

import math
import random
import time as _time
from dataclasses import dataclass
from datetime import datetime, timedelta

from .data import DEPOT
from .models import Destination, Fleet, Order, Product, delivery_deadline, earliest_departure

ROAD_FACTOR = 1.25  # fallback without OSRM (ERR-06): Haversine distance x road factor
EARTH_RADIUS_KM = 6371.0088

DOES_NOT_FIT = "does not fit"  # ERR-04
WOULD_EXPIRE = "would expire"  # ERR-05


def haversine_km(a: Destination, b: Destination) -> float:
    """Great-circle distance between two points, in km."""
    lat1, lon1, lat2, lon2 = map(math.radians, (a.lat, a.lon, b.lat, b.lon))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def distance_matrix(destinations: dict[str, Destination],
                    factor: float = ROAD_FACTOR) -> dict[tuple[str, str], float]:
    """Full matrix of estimated road km between every pair of points, including Mataró."""
    ids = list(destinations)
    return {(i, j): (0.0 if i == j else haversine_km(destinations[i], destinations[j]) * factor)
            for i in ids for j in ids}


@dataclass
class Instance:
    """Orders prepared for optimization: units, earliest departure and delivery deadline per order."""
    orders: list[Order]
    dist: dict[tuple[str, str], float]
    fleet: Fleet
    units: dict[str, int]
    departure: dict[str, datetime]
    deadline: dict[str, datetime]
    destination: dict[str, str]

    @classmethod
    def build(cls, orders: list[Order], products: dict[str, Product], dist, fleet: Fleet) -> "Instance":
        return cls(orders, dist, fleet,
                   {o.id: o.units for o in orders},
                   {o.id: earliest_departure(o, products) for o in orders},
                   {o.id: delivery_deadline(o, products) for o in orders},
                   {o.id: o.destination for o in orders})

    def hours(self, km: float) -> float:
        return km / self.fleet.speed_kmh

    def with_rest_breaks(self, driving_hours: float) -> float:
        """Elapsed hours needed to drive `driving_hours` with a single driver
        (45-minute break every 4.5 h and 11-hour daily rest every 9 h; Regulation (EC) No 561/2006)."""
        if self.fleet.max_driving_hours is None:
            return driving_hours
        days = int(driving_hours // self.fleet.max_driving_hours)
        remainder = driving_hours - days * self.fleet.max_driving_hours
        breaks = days * 1 + int(remainder // 4.5)  # one break per 4.5-hour block within each driving day
        return driving_hours + days * 11 + breaks * 0.75

    def evaluate(self, route: list[str]) -> tuple[bool, float, list[datetime]]:
        """Return (feasible, round-trip km, arrival time at each stop)."""
        if not route:
            return True, 0.0, []
        if sum(self.units[o] for o in route) > self.fleet.capacity_units:
            return False, math.inf, []
        departure = max(self.departure[o] for o in route)
        previous, km, arrivals = DEPOT, 0.0, []
        for o in route:
            km += self.dist[previous, self.destination[o]]
            arrival = departure + timedelta(hours=self.with_rest_breaks(self.hours(km)))
            if arrival > self.deadline[o]:
                return False, math.inf, []
            arrivals.append(arrival)
            previous = self.destination[o]
        km += self.dist[previous, DEPOT]
        return True, km, arrivals

    def infeasible_orders(self) -> dict[str, str]:
        """ERR-04 (does not fit in a truck) and ERR-05 (would expire even on a direct route)."""
        result = {}
        for o in self.orders:
            if self.units[o.id] > self.fleet.capacity_units:
                result[o.id] = DOES_NOT_FIT
            elif not self.evaluate([o.id])[0]:
                result[o.id] = WOULD_EXPIRE
        return result


def total_km(inst: Instance, routes: list[list[str]]) -> float:
    return sum(inst.evaluate(r)[1] for r in routes)


def truck_lower_bound(inst: Instance, feasible: list[str]) -> int:
    """No plan can use fewer trucks than ceil(total units / capacity) (section 7.2)."""
    return math.ceil(sum(inst.units[o] for o in feasible) / inst.fleet.capacity_units)


# ------------------------------------------------------------------------------ Clarke-Wright
def clarke_wright(inst: Instance, feasible: list[str]) -> list[list[str]]:
    """Savings algorithm: start with one route per order and merge route ends while capacity and
    expiry are respected, in decreasing order of saving s(i, j) = d(0, i) + d(0, j) - d(i, j)."""
    d, dest = inst.dist, inst.destination
    route_of = {o: [o] for o in feasible}
    savings = []
    for a in range(len(feasible)):
        i = feasible[a]
        for b in range(a + 1, len(feasible)):
            j = feasible[b]
            s = d[DEPOT, dest[i]] + d[DEPOT, dest[j]] - d[dest[i], dest[j]]
            if s > 0:
                savings.append((s, i, j))
    savings.sort(key=lambda t: -t[0])
    for _, i, j in savings:
        ri, rj = route_of[i], route_of[j]
        if ri is rj:
            continue
        candidates = []
        if ri[-1] == i and rj[0] == j:
            candidates.append(ri + rj)
        if rj[-1] == j and ri[0] == i:
            candidates.append(rj + ri)
        if ri[0] == i and rj[0] == j:
            candidates.append(ri[::-1] + rj)
        if ri[-1] == i and rj[-1] == j:
            candidates.append(ri + rj[::-1])
        best = None
        for c in candidates:
            ok, km, _ = inst.evaluate(c)
            if ok and (best is None or km < best[0]):
                best = (km, c)
        if best:
            merged = best[1]
            for o in merged:
                route_of[o] = merged
    unique, seen = [], set()
    for r in route_of.values():
        if id(r) not in seen:
            seen.add(id(r))
            unique.append(r)
    return unique


# ------------------------------------------------------------------------- Simulated annealing
TRUCK_WEIGHT = 100_000.0  # fixed cost per truck: reducing trucks always dominates reducing km


def cost(inst: Instance, routes: list[list[str]]) -> float:
    """Hierarchical objective: TRUCK_WEIGHT per truck used plus total km."""
    return TRUCK_WEIGHT * sum(1 for r in routes if r) + total_km(inst, routes)


def simulated_annealing(inst: Instance, initial: list[list[str]], seconds: float = 30.0,
                        seed: int = 1, t0: float = 2000.0, cooling: float = 0.9995) -> list[list[str]]:
    """In-house metaheuristic: improves the initial solution with relocate, inter-route swap and
    intra-route 2-opt moves, accepting worse solutions with probability exp(-delta / T)."""
    rnd = random.Random(seed)
    routes = [list(r) for r in initial if r]
    km = [inst.evaluate(r)[1] for r in routes]
    current = TRUCK_WEIGHT * len(routes) + sum(km)
    best, best_routes = current, [list(r) for r in routes]
    t, end = t0, _time.perf_counter() + seconds
    while _time.perf_counter() < end and len(routes) > 1:
        move = rnd.random()
        a = rnd.randrange(len(routes))
        if move < 0.5:  # relocate one order from route a to route b (route a is removed if it empties)
            b = rnd.randrange(len(routes) - 1)
            b += b >= a
            k = rnd.randrange(len(routes[a]))
            new_a = routes[a][:k] + routes[a][k + 1:]
            pos = rnd.randrange(len(routes[b]) + 1)
            new_b = routes[b][:pos] + [routes[a][k]] + routes[b][pos:]
            changes = {a: new_a, b: new_b}
        elif move < 0.8:  # swap one order between two routes
            b = rnd.randrange(len(routes) - 1)
            b += b >= a
            i, j = rnd.randrange(len(routes[a])), rnd.randrange(len(routes[b]))
            new_a, new_b = list(routes[a]), list(routes[b])
            new_a[i], new_b[j] = new_b[j], new_a[i]
            changes = {a: new_a, b: new_b}
        else:  # 2-opt within route a
            if len(routes[a]) < 3:
                continue
            i, j = sorted(rnd.sample(range(len(routes[a])), 2))
            changes = {a: routes[a][:i] + routes[a][i:j + 1][::-1] + routes[a][j + 1:]}
        new_km, ok = {}, True
        for k, r in changes.items():
            feasible, kk, _ = inst.evaluate(r)
            if not feasible:
                ok = False
                break
            new_km[k] = kk
        if ok:
            delta = sum(new_km[k] - km[k] for k in changes)
            delta -= TRUCK_WEIGHT * sum(1 for k, r in changes.items() if not r)
            if delta < 0 or rnd.random() < math.exp(-delta / max(t, 1e-9)):
                for k, r in changes.items():
                    routes[k], km[k] = r, new_km[k]
                empty = [k for k in range(len(routes)) if not routes[k]]
                for k in sorted(empty, reverse=True):
                    del routes[k], km[k]
                current += delta
                if current < best - 1e-9:
                    best, best_routes = current, [list(r) for r in routes]
        t *= cooling
    return best_routes


# ---------------------------------------------------------------------------- Validator and KPIs
def validate_solution(inst: Instance, routes: list[list[str]], feasible: list[str]) -> list[str]:
    """Independent validator (RNF-04): capacity, expiry and single assignment of every order."""
    errors, seen = [], []
    for n, r in enumerate(routes, 1):
        load = sum(inst.units[o] for o in r)
        if load > inst.fleet.capacity_units:
            errors.append(f"truck {n}: {load} units exceed the capacity")
        ok, _, _ = inst.evaluate(r)
        if not ok and load <= inst.fleet.capacity_units:
            errors.append(f"truck {n}: an order arrives after its expiry date")
        seen += r
    if sorted(seen) != sorted(feasible):
        errors.append("a feasible order is missing or assigned more than once")
    return errors


def kpis(inst: Instance, routes: list[list[str]]) -> dict[str, float]:
    """Indicators of section 7.1: trucks, km, cost, hours, average load factor and average expiry margin."""
    km = margin_h = hours = load = 0.0
    n_orders = 0
    for r in routes:
        ok, k, arrivals = inst.evaluate(r)
        km += k
        hours += inst.with_rest_breaks(inst.hours(k))
        load += sum(inst.units[o] for o in r) / inst.fleet.capacity_units
        for o, t in zip(r, arrivals):
            margin_h += (inst.deadline[o] - t).total_seconds() / 3600
            n_orders += 1
    n = len(routes)
    return {"trucks": n, "km": round(km, 1), "cost": round(km * inst.fleet.cost_per_km, 2),
            "hours": round(hours, 1), "load_factor": round(load / n, 3) if n else 0.0,
            "avg_margin_h": round(margin_h / n_orders, 1) if n_orders else 0.0, "orders": n_orders}
