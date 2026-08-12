"""Metabolite (Lactate) Accumulation & Washout Engine.

Implements cellular lactate production kinetics and continuous perfusion washout.
"""
from app.models.config import BioreactorConfig
from app.simulation.perfusion import vvd_to_dilution_rate


def calculate_metabolite_derivative(
    metabolite: float,
    viable_cells: float,
    perfusion_rate_vvd: float,
    config: BioreactorConfig,
) -> float:
    """Calculate lactate concentration change rate dP/dt (g/L/hour).

    dP/dt = q_p * X_v - D * P

    Model Assumptions:
    - Lactate is produced continuously as a byproduct of cell metabolic activity.
    - Lactate is continuously washed out through filter permeate outflow D * P.
    """
    D = vvd_to_dilution_rate(perfusion_rate_vvd)
    production = config.cell_metabolite_yield * viable_cells
    washout = D * metabolite

    dp_dt = production - washout

    if metabolite <= 0.0 and dp_dt < 0.0:
        return max(0.0, production)

    return dp_dt
