"""Nutrient (Glucose) Consumption & Perfusion Feed Kinetics Engine.

Implements specific cellular nutrient uptake and continuous media replenishment.
"""
from app.models.config import BioreactorConfig
from app.simulation.perfusion import vvd_to_dilution_rate


def calculate_nutrient_derivative(
    nutrient: float,
    viable_cells: float,
    perfusion_rate_vvd: float,
    config: BioreactorConfig,
) -> float:
    """Calculate glucose substrate change rate dS/dt (g/L/hour).

    dS/dt = D * (S_feed - S) - q_s * X_v

    Model Assumptions:
    - Glucose is fed continuously via perfusion media at concentration S_feed (g/L).
    - Cellular consumption rate is proportional to viable cell density X_v.
    """
    D = vvd_to_dilution_rate(perfusion_rate_vvd)
    replenishment = D * (config.feed_nutrient_concentration - nutrient)
    consumption = config.cell_nutrient_consumption_rate * viable_cells

    ds_dt = replenishment - consumption

    # If nutrient is depleted to zero, consumption stops
    if nutrient <= 0.0 and ds_dt < 0.0:
        return max(0.0, replenishment)

    return ds_dt
