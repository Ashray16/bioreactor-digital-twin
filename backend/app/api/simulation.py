from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError
from app.models.config import BioreactorConfig
from app.models.state import BioreactorState

router = APIRouter(prefix="/api/v1/simulation", tags=["Simulation"])


@router.get("/config/default", response_model=BioreactorConfig)
def get_default_configuration():
    """Retrieve the standard baseline bioreactor configuration parameters."""
    return BioreactorConfig()


@router.post("/config/validate")
def validate_configuration(config: BioreactorConfig):
    """Validate a custom configuration payload against biological and operational bounds."""
    return {
        "valid": True,
        "message": "Configuration parameters are valid and within physical bounds.",
        "config": config,
    }


@router.post("/initialize", response_model=BioreactorState)
def initialize_simulation(config: Optional[BioreactorConfig] = None):
    """Initialize a new virtual bioreactor state (t=0) based on configuration."""
    cfg = config or BioreactorConfig()
    
    total_cells = cfg.initial_cell_density
    viable_cells = total_cells * (cfg.initial_viability / 100.0)
    nonviable_cells = total_cells - viable_cells

    initial_state = BioreactorState(
        simulation_time=0.0,
        viable_cell_density=viable_cells,
        nonviable_cell_density=nonviable_cells,
        cell_viability=cfg.initial_viability,
        total_cell_density=total_cells,
        nutrient_concentration=cfg.initial_nutrient,
        metabolite_concentration=cfg.initial_metabolite,
        reactor_volume=cfg.reactor_volume,
        perfusion_rate=cfg.perfusion_rate,
        fouling_index=0.0,
        fouling_state="LOW",
        target_cell_density=cfg.target_cell_density,
        target_achieved=viable_cells >= cfg.target_cell_density,
        time_to_target=0.0 if viable_cells >= cfg.target_cell_density else None,
        controller_enabled=cfg.control_enabled,
        latest_controller_action=None,
        active_fault=None,
    )

    return initial_state
