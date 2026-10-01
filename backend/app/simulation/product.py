"""Product (Titer / mAb) Formation & Perfusion Washout Kinetics Engine.

Implements specific cellular product synthesis rate q_p and continuous perfusion dilution.

Scientific Formulation:
    dP_t/dt = q_p * X_v - D * P_t

Where:
    - P_t: Product / Titer concentration (g/L)
    - q_p: Specific product productivity (g/L/h per cell/mL)
    - X_v: Viable cell density (cells/mL)
    - D: Perfusion dilution rate (1/hour) = perfusion_rate_vvd / 24.0

Model Assumptions & Limitations:
    - Specific productivity q_p is an assumed model parameter representing cellular mAb formation (~24 pg/cell/day).
      It is not an experimentally measured value for a specific clone.
    - Assumes constant q_p (no growth-rate dependent or nutrient-regulated q_p dynamics).
    - Product formation is directly proportional to viable cell density X_v.
    - Product washout is directly proportional to perfusion dilution D * P_t.
    - No explicit intracellular product pool, retention filter rejection, or degradation term.
"""
from app.models.config import BioreactorConfig
from app.simulation.perfusion import vvd_to_dilution_rate


def calculate_product_derivative(
    product: float,
    viable_cells: float,
    perfusion_rate_vvd: float,
    config: BioreactorConfig,
) -> float:
    """Calculate product/titer concentration rate of change dP_t/dt (g/L/hour).

    dP_t/dt = q_p * X_v - D * P_t

    Args:
        product: Current product concentration P_t (g/L)
        viable_cells: Current viable cell density X_v (cells/mL)
        perfusion_rate_vvd: Current media exchange rate (VVD)
        config: Bioreactor configuration containing specific_productivity_qp

    Returns:
        dP_t/dt in g/L/hour with non-negativity boundary enforcement.
    """
    D = vvd_to_dilution_rate(perfusion_rate_vvd)
    production = config.specific_productivity_qp * viable_cells
    washout = D * product

    dpt_dt = production - washout

    # Non-negativity boundary condition: if product is at or below zero and derivative is negative, prevent sub-zero drift
    if product <= 0.0 and dpt_dt < 0.0:
        return max(0.0, production)

    return dpt_dt
