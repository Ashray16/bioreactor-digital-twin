"""Perfusion & Media Exchange Hydrodynamics Engine.

Converts Vessel Volumes per Day (VVD) to dilution rate D (1/hour)
and calculates media volumetric flow rates.
"""

def vvd_to_dilution_rate(perfusion_rate_vvd: float) -> float:
    """Convert perfusion rate in Vessel Volumes per Day (VVD) to hourly dilution rate D (1/hour)."""
    return max(0.0, perfusion_rate_vvd / 24.0)


def calculate_flow_rates(perfusion_rate_vvd: float, reactor_volume_L: float) -> tuple[float, float]:
    """Calculate media inflow and outflow rates in Liters per hour (L/h)."""
    D = vvd_to_dilution_rate(perfusion_rate_vvd)
    flow_rate = D * reactor_volume_L
    return flow_rate, flow_rate
