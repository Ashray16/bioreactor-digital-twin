"""Process Analytics & Stochastic Statistical Modeling API.

Exposes endpoints for Monte Carlo ensemble simulations (fan chart & final VCC histogram)
and One-at-a-time (OAT) parameter sensitivity tornado analysis.
"""
from typing import Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.models.config import BioreactorConfig
from app.simulation.analytics import (
    run_monte_carlo_batch,
    run_tornado_sensitivity,
    MonteCarloResponse,
    SensitivityResponse,
)

router = APIRouter(prefix="/api/v1/analytics", tags=["Process Analytics"])

# In-memory cache for default baseline Monte Carlo run to provide instant initial load
_cached_default_mc: Optional[MonteCarloResponse] = None
_cached_default_sens: Optional[SensitivityResponse] = None


class MonteCarloRequestPayload(BaseModel):
    config: Optional[BioreactorConfig] = None
    num_runs: int = Field(default=200, ge=10, le=1000, description="Number of stochastic parameter perturbation trajectories")
    seed: Optional[int] = Field(default=42, description="Random seed for reproducibility")


@router.post("/monte-carlo", response_model=MonteCarloResponse)
def execute_monte_carlo(payload: Optional[MonteCarloRequestPayload] = None):
    """Execute stochastic Monte Carlo batch (default 200 runs) and return fan chart & histogram."""
    p = payload or MonteCarloRequestPayload()
    cfg = p.config or BioreactorConfig(
        simulation_duration=120.0,
        timestep=1.0,
        initial_nutrient=2.0,
        perfusion_rate=0.4,
        nutrient_threshold_low=3.0,
        metabolite_threshold_high=3.0,
    )
    return run_monte_carlo_batch(base_config=cfg, num_runs=p.num_runs, seed=p.seed or 42)


@router.get("/monte-carlo/default", response_model=MonteCarloResponse)
def get_default_monte_carlo():
    """Retrieve pre-computed or instant baseline 200-run Monte Carlo distribution."""
    global _cached_default_mc
    if _cached_default_mc is None:
        _cached_default_mc = run_monte_carlo_batch(num_runs=200, seed=42)
    return _cached_default_mc


@router.get("/sensitivity", response_model=SensitivityResponse)
def get_parameter_sensitivity(
    perturbation_pct: float = Query(default=20.0, ge=1.0, le=50.0, description="One-at-a-time parameter variation percentage (+/- %)")
):
    """Compute One-At-A-Time (OAT) Tornado sensitivity analysis on final VCC at 120 h."""
    global _cached_default_sens
    if perturbation_pct == 20.0 and _cached_default_sens is not None:
        return _cached_default_sens

    res = run_tornado_sensitivity(perturbation_pct=perturbation_pct)
    if perturbation_pct == 20.0:
        _cached_default_sens = res
    return res
