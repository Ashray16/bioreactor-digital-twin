"""Filter Fouling Risk Index Engine.

Computes a normalized 0-100 index representing simulated membrane filtration fouling risk.

Model Assumptions:
- Fouling risk depends on viable biomass concentration, filtration hydraulic flux,
  accumulated operating duration, and filter surface area capacity.
- Output is explicitly designated as a "Fouling Risk Model" (0-100 index), not an
  experimentally validated physical pressure drop equation.
"""
from typing import Literal
from app.models.config import BioreactorConfig
from app.simulation.perfusion import vvd_to_dilution_rate


def calculate_fouling_index(
    viable_cells: float,
    total_cells: float,
    perfusion_rate_vvd: float,
    simulation_time_hours: float,
    config: BioreactorConfig,
) -> tuple[float, Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]]:
    """Calculate normalized Fouling Risk Index (0.0 to 100.0) and categorical risk state.

    Formula:
    Risk = 100 * (w_density * (total_cells / X_ref) + w_flux * (D * total_cells / Flux_ref) + w_time * (t / T_ref))
           * (config.fouling_sensitivity / config.filter_area)
    """
    X_ref = 1.0e8  # Target cell density reference (10^8 cells/mL)
    D = vvd_to_dilution_rate(perfusion_rate_vvd)
    
    # Hydraulic biomass flux proxy
    biomass_flux = D * total_cells
    flux_ref = (1.5 / 24.0) * 1.0e8  # Reference flux at 1.5 VVD and 10^8 cells/mL
    
    time_ref = 120.0  # Reference operating duration (120 hours / 5 days)

    # Component weights
    w_density = 0.45
    w_flux = 0.35
    w_time = 0.20

    density_term = w_density * (total_cells / X_ref)
    flux_term = w_flux * (biomass_flux / flux_ref if flux_ref > 0 else 0)
    time_term = w_time * (simulation_time_hours / time_ref)

    area_factor = 0.1 / max(0.01, config.filter_area)
    raw_index = 100.0 * (density_term + flux_term + time_term) * config.fouling_sensitivity * area_factor
    
    # Clamp index between 0.0 and 100.0
    fouling_index = max(0.0, min(100.0, round(raw_index, 1)))

    if fouling_index <= 30.0:
        state: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"] = "LOW"
    elif fouling_index <= 70.0:
        state = "MODERATE"
    elif fouling_index <= 90.0:
        state = "HIGH"
    else:
        state = "CRITICAL"

    return fouling_index, state
