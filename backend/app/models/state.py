from pydantic import BaseModel, Field
from typing import Optional, List, Literal


class ControllerActionInfo(BaseModel):
    """Details regarding recent automated control interventions."""

    timestamp: float = Field(description="Time of action in hours")
    action_type: str = Field(description="Type of action (e.g. INCREASE_PERFUSION, STABILIZE)")
    reason: str = Field(description="Scientific/operational rationale for action")
    previous_perfusion: float = Field(description="Previous perfusion rate (VVD)")
    current_perfusion: float = Field(description="Updated perfusion rate (VVD)")


class BioreactorState(BaseModel):
    """Instantaneous snapshot state of the virtual mammalian perfusion bioreactor."""

    simulation_time: float = Field(ge=0, description="Current simulation time (hours)")
    viable_cell_density: float = Field(ge=0, description="Viable cell density (cells/mL)")
    nonviable_cell_density: float = Field(ge=0, description="Dead/nonviable cell density (cells/mL)")
    cell_viability: float = Field(ge=0.0, le=100.0, description="Cell viability percentage (%)")
    total_cell_density: float = Field(ge=0, description="Total cell density (viable + nonviable) (cells/mL)")
    
    nutrient_concentration: float = Field(ge=0, description="Glucose concentration (g/L)")
    metabolite_concentration: float = Field(ge=0, description="Lactate concentration (g/L)")
    product_concentration: float = Field(default=0.0, ge=0.0, description="Product / Titer concentration (g/L)")
    
    reactor_volume: float = Field(gt=0, description="Current working volume (L)")
    perfusion_rate: float = Field(ge=0, description="Current media exchange rate (VVD)")
    
    fouling_index: float = Field(ge=0.0, le=100.0, description="Filter Fouling Risk Index (0-100 normalized)")
    fouling_state: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"] = Field(
        default="LOW",
        description="Categorical fouling risk status",
    )
    
    target_cell_density: float = Field(default=1.0e8, description="Target cell density benchmark (cells/mL)")
    target_achieved: bool = Field(default=False, description="Whether target cell density is reached")
    time_to_target: Optional[float] = Field(default=None, description="Time taken to reach target density (hours)")
    
    controller_enabled: bool = Field(default=False, description="Whether automated controller is active")
    latest_controller_action: Optional[ControllerActionInfo] = Field(
        default=None,
        description="Latest controller intervention details",
    )
    
    active_fault: Optional[str] = Field(
        default=None,
        description="Currently active simulated disturbance/fault if any",
    )
    controller_actions: List[ControllerActionInfo] = Field(
        default_factory=list,
        description="Audit trail of all automated controller interventions in current run",
    )


class SimulationHistoryItem(BaseModel):
    """Historical time-point entry in simulation trajectory."""

    time: float
    viable_cell_density: float
    nonviable_cell_density: float
    cell_viability: float
    nutrient_concentration: float
    metabolite_concentration: float
    product_concentration: float = 0.0
    perfusion_rate: float
    fouling_index: float
    controller_enabled: bool
    active_fault: Optional[str] = None


class SimulationResponse(BaseModel):
    """Full trajectory result returned by simulation runs."""

    config: dict
    current_state: BioreactorState
    history: List[SimulationHistoryItem]
    summary_metrics: dict
    controller_actions: List[ControllerActionInfo] = Field(default_factory=list)

