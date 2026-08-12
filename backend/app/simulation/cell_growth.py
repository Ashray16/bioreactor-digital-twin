"""Mammalian Cell Growth & Viability Model Engine.

Implements Monod substrate limitation, non-competitive lactate growth inhibition,
death rate acceleration, and maximum sustainable density (carrying capacity) constraints.
"""
from app.models.config import BioreactorConfig


def calculate_specific_growth_rate(
    nutrient: float,
    metabolite: float,
    viable_cells: float,
    config: BioreactorConfig,
) -> float:
    """Calculate specific cell growth rate mu (1/hour).

    Model Assumptions:
    - Monod kinetics for nutrient limitation (S / (K_s + S))
    - Non-competitive inhibition for lactate accumulation (K_i / (K_i + P))
    - Density limitation factor (1 - X_v / X_max)
    """
    if nutrient <= 0.0 or viable_cells >= config.max_sustainable_density:
        return 0.0

    monod_factor = nutrient / (config.monod_constant_nutrient + nutrient)
    inhibition_factor = config.metabolite_inhibition_constant / (
        config.metabolite_inhibition_constant + metabolite
    )
    density_factor = max(0.0, 1.0 - (viable_cells / config.max_sustainable_density))

    mu = config.max_growth_rate * monod_factor * inhibition_factor * density_factor
    return max(0.0, mu)


def calculate_cell_death_rate(
    metabolite: float,
    config: BioreactorConfig,
) -> float:
    """Calculate specific cell death rate k_d (1/hour).

    Model Assumptions:
    - Baseline mortality rate k_d0
    - Accelerated mortality under high metabolite accumulation
    """
    toxicity_factor = metabolite / (config.metabolite_inhibition_constant + metabolite)
    kd = config.death_rate_base + (0.015 * toxicity_factor)
    return max(0.0, kd)


def calculate_cell_density_derivatives(
    viable_cells: float,
    nonviable_cells: float,
    nutrient: float,
    metabolite: float,
    perfusion_rate_vvd: float,
    config: BioreactorConfig,
) -> tuple[float, float]:
    """Calculate derivatives (dXv/dt, dXd/dt) in cells/mL/hour."""
    mu = calculate_specific_growth_rate(nutrient, metabolite, viable_cells, config)
    kd = calculate_cell_death_rate(metabolite, config)

    # In perfusion bioreactors with cell retention filter (e.g. ATF/TFF),
    # viable cells are retained in vessel. Nonviable cells slowly bleed or degrade.
    dxv_dt = (mu - kd) * viable_cells
    dxd_dt = kd * viable_cells

    return dxv_dt, dxd_dt
