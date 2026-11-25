"""Benchmark for sections 7.3, 7.4 and 7.5 of the P1 report: runs scenarios S1-S3 and the scalability test."""
import json
import platform
import statistics
import sys
import time

from synaplogix.data import generate_orders, generate_products, load_destinations, validate
from synaplogix.models import Fleet
from synaplogix.routing import (Instance, clarke_wright, distance_matrix, kpis, simulated_annealing,
                                truck_lower_bound, validate_solution)

FLEET = Fleet(capacity_units=60_000, speed_kmh=70, cost_per_km=1.10)
SCENARIOS = {"S1": (50, 101, 10), "S2": (200, 102, 30), "S3": (500, 103, 60)}  # orders, seed, SA seconds


def timed(f, repetitions=5):
    """Run f several times and return its last result and the mean wall-clock time in seconds."""
    times, result = [], None
    for _ in range(repetitions):
        start = time.perf_counter()
        result = f()
        times.append(time.perf_counter() - start)
    return result, statistics.mean(times)


def run(n_orders, seed, sa_seconds, repetitions=5):
    """Run one scenario end to end and return its KPIs and phase timings."""
    destinations = load_destinations()
    products = generate_products(200, seed)
    orders, t_data = timed(lambda: generate_orders(n_orders, destinations, products, seed=seed), repetitions)
    errors = validate(orders, products, destinations)
    assert not errors, errors
    dist, t_matrix = timed(lambda: distance_matrix(destinations), repetitions)
    inst, t_dates = timed(lambda: Instance.build(orders, products, dist, FLEET), repetitions)
    infeasible = inst.infeasible_orders()
    feasible = [o.id for o in orders if o.id not in infeasible]
    cw, t_cw = timed(lambda: clarke_wright(inst, feasible), repetitions)
    start = time.perf_counter()
    sa = simulated_annealing(inst, cw, seconds=sa_seconds, seed=seed)
    t_sa = time.perf_counter() - start
    (errors_cw, errors_sa), t_validation = timed(lambda: (validate_solution(inst, cw, feasible),
                                                          validate_solution(inst, sa, feasible)), repetitions)
    return {"orders": n_orders, "lines": sum(len(o.lines) for o in orders),
            "units": sum(o.units for o in orders), "infeasible": infeasible,
            "lower_bound": truck_lower_bound(inst, feasible),
            "clarke_wright": kpis(inst, cw), "simulated_annealing": kpis(inst, sa),
            "errors": errors_cw + errors_sa,
            "seconds": {"data_generation": t_data, "distance_matrix": t_matrix, "dates": t_dates,
                        "clarke_wright": t_cw, "simulated_annealing": t_sa, "validation": t_validation}}


if __name__ == "__main__":
    output = {"machine": f"{platform.processor() or platform.machine()} · Python {sys.version.split()[0]}",
              "fleet": FLEET.__dict__, "scenarios": {}, "scalability": []}
    for name, (n, seed, seconds) in SCENARIOS.items():
        output["scenarios"][name] = run(n, seed, seconds)
        print(name, json.dumps(output["scenarios"][name], default=str), flush=True)
    for n in (50, 100, 200, 300, 400, 500):
        r = run(n, 200 + n, 20, repetitions=1)
        output["scalability"].append({"orders": n, "clarke_wright_seconds": r["seconds"]["clarke_wright"],
                                      "clarke_wright_trucks": r["clarke_wright"]["trucks"],
                                      "simulated_annealing_trucks": r["simulated_annealing"]["trucks"],
                                      "lower_bound": r["lower_bound"]})
        print("scalability", output["scalability"][-1], flush=True)
    with open("benchmark_results.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=1, default=str)
