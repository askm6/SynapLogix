"""Data model and date calculations for SynapLogix (sections 2.4 and 5.3 of the P1 report)."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta

# Reference times: a ready order can leave the depot at 08:00 on its ready date,
# and a product remains valid until 23:59 on its expiry date.
DEPARTURE_TIME = time(8, 0)
END_OF_DAY = time(23, 59)


@dataclass(frozen=True)
class Product:
    id: str
    name: str
    sale_price: float
    manufacturing_days: int
    shelf_life_days: int


@dataclass(frozen=True)
class Destination:
    id: str
    name: str
    lat: float
    lon: float


@dataclass(frozen=True)
class OrderLine:
    product: str
    quantity: int


@dataclass
class Order:
    id: str
    order_date: date
    customer: str
    destination: str
    lines: list[OrderLine] = field(default_factory=list)

    @property
    def units(self) -> int:
        """Total units in the order, used for the truck capacity check."""
        return sum(line.quantity for line in self.lines)


@dataclass(frozen=True)
class Fleet:
    """Homogeneous fleet: every truck has the same capacity, average speed and cost per km."""
    capacity_units: int
    speed_kmh: float
    cost_per_km: float
    max_driving_hours: float | None = None  # None disables the driving-time limit


def order_expiry_date(order: Order, products: dict[str, Product]) -> date:
    """Expiry date of the order: the minimum of F + TF + DC over its lines (literal formula of the brief)."""
    return min(order.order_date + timedelta(days=products[line.product].manufacturing_days
                                            + products[line.product].shelf_life_days)
               for line in order.lines)


def order_ready_date(order: Order, products: dict[str, Product]) -> date:
    """Date on which the order is fully manufactured: F + 1 + the longest manufacturing time of its lines."""
    return order.order_date + timedelta(
        days=1 + max(products[line.product].manufacturing_days for line in order.lines))


def delivery_deadline(order: Order, products: dict[str, Product]) -> datetime:
    """Latest valid arrival time: 23:59 on the order's expiry date."""
    return datetime.combine(order_expiry_date(order, products), END_OF_DAY)


def earliest_departure(order: Order, products: dict[str, Product]) -> datetime:
    """Earliest time a truck carrying this order can leave Mataró: 08:00 on its ready date."""
    return datetime.combine(order_ready_date(order, products), DEPARTURE_TIME)
