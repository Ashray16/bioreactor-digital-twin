from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.models.config import BioreactorConfig
from app.models.state import BioreactorState, SimulationResponse
from app.simulation.engine import SimulationEngine
from app.simulation.scenario import ScenarioEngine, ScenarioComparisonResponse
from app.simulation.faults import FaultConfig, FaultManager
from app.control.rule_based import RuleBasedController

router = APIRouter(prefix="/api/v1/simulation", tags=["Simulation"])

# Stateful active digital twin session singleton
global_engine = SimulationEngine()
global_controller = RuleBasedController()
global_fault_manager = FaultManager()


class ControlSettingsPayload(BaseModel):
    enabled: bool = Field(default=True, description="Enable or disable automated controller")
    mode: str = Field(default="rule_based", description="Control strategy mode")
    min_perfusion_rate: Optional[float] = Field(default=None, ge=0.0, le=5.0)
    max_perfusion_rate: Optional[float] = Field(default=None, gt=0.0, le=10.0)
    nutrient_threshold_low: Optional[float] = Field(default=None, gt=0.0)
    metabolite_threshold_high: Optional[float] = Field(default=None, gt=0.0)
    fouling_threshold_high: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    step_increment_vvd: Optional[float] = Field(default=None, gt=0.0, le=2.0)
    deadband_hours: Optional[float] = Field(default=None, ge=0.0, le=24.0)



class SimulationStepPayload(BaseModel):
    dt: Optional[float] = Field(default=None, gt=0.0, le=6.0, description="Step duration (hours)")
    perfusion_rate_override: Optional[float] = Field(default=None, ge=0.0, le=10.0, description="Manual perfusion override (VVD)")


@router.get("/config/default", response_model=BioreactorConfig)
def get_default_configuration():
    """Retrieve standard baseline configuration parameters."""
    return BioreactorConfig()


@router.post("/config/validate")
def validate_configuration(config: BioreactorConfig):
    """Validate configuration parameters against physical and biological bounds."""
    return {
        "valid": True,
        "message": "Configuration parameters are valid and within physical bounds.",
        "config": config,
    }


@router.post("/start", response_model=BioreactorState)
@router.post("/initialize", response_model=BioreactorState)
def start_simulation(config: Optional[BioreactorConfig] = None):
    """Start or re-initialize the active digital twin simulation engine state."""
    cfg = config or BioreactorConfig()
    global global_engine, global_fault_manager
    global_engine = SimulationEngine(cfg)
    global_fault_manager = FaultManager(None)
    return global_engine.current_state


@router.get("/state", response_model=BioreactorState)
def get_current_state():
    """Retrieve current instantaneous state of the digital twin bioreactor."""
    return global_engine.current_state


@router.post("/step", response_model=BioreactorState)
def step_simulation(payload: Optional[SimulationStepPayload] = None):
    """Advance active simulation state by a single timestep dt."""
    global global_engine, global_controller, global_fault_manager

    dt = payload.dt if payload else None
    if payload and payload.perfusion_rate_override is not None:
        global_engine.current_state.perfusion_rate = payload.perfusion_rate_override

    active_fault = global_fault_manager.apply_fault(global_engine)
    new_state = global_engine.step(
        dt=dt,
        controller=global_controller if global_engine.config.control_enabled else None,
        active_fault=active_fault,
    )
    return new_state


@router.post("/run", response_model=SimulationResponse)
def run_full_simulation(config: Optional[BioreactorConfig] = None):
    """Run a complete trajectory simulation from t=0 to t=simulation_duration."""
    cfg = config or BioreactorConfig()
    engine = SimulationEngine(cfg)
    controller = RuleBasedController() if cfg.control_enabled else None
    return engine.run_full_simulation(cfg, controller=controller)


@router.get("/control")
def get_control_settings():
    """Retrieve current automated controller configuration, thresholds, and recorded actions."""
    global global_engine, global_controller
    return {
        "enabled": global_engine.config.control_enabled,
        "mode": "rule_based",
        "min_perfusion_rate": global_engine.config.min_perfusion_rate,
        "max_perfusion_rate": global_engine.config.max_perfusion_rate,
        "nutrient_threshold_low": getattr(global_controller, 'nutrient_threshold_low', 1.5),
        "metabolite_threshold_high": getattr(global_controller, 'metabolite_threshold_high', 3.5),
        "fouling_threshold_high": getattr(global_controller, 'fouling_threshold_high', 70.0),
        "step_increment_vvd": getattr(global_controller, 'step_increment_vvd', 0.3),
        "deadband_hours": getattr(global_controller, 'deadband_hours', 1.0),
        "controller_actions": global_engine.controller_actions,
    }


@router.post("/control")
def update_control_settings(payload: ControlSettingsPayload):
    """Update automated controller settings and operational thresholds."""
    global global_engine, global_controller

    global_engine.config.control_enabled = payload.enabled
    global_engine.current_state.controller_enabled = payload.enabled

    if payload.min_perfusion_rate is not None:
        global_engine.config.min_perfusion_rate = payload.min_perfusion_rate
    if payload.max_perfusion_rate is not None:
        global_engine.config.max_perfusion_rate = payload.max_perfusion_rate
    if payload.nutrient_threshold_low is not None:
        global_controller.nutrient_threshold_low = payload.nutrient_threshold_low
        global_engine.config.nutrient_threshold_low = payload.nutrient_threshold_low
    if payload.metabolite_threshold_high is not None:
        global_controller.metabolite_threshold_high = payload.metabolite_threshold_high
        global_engine.config.metabolite_threshold_high = payload.metabolite_threshold_high
    if payload.fouling_threshold_high is not None:
        global_controller.fouling_threshold_high = payload.fouling_threshold_high
        global_engine.config.fouling_threshold_high = payload.fouling_threshold_high
    if payload.step_increment_vvd is not None:
        global_controller.step_increment_vvd = payload.step_increment_vvd
        global_engine.config.step_increment_vvd = payload.step_increment_vvd
    if payload.deadband_hours is not None:
        global_controller.deadband_hours = payload.deadband_hours

    return {
        "status": "updated",
        "control_enabled": payload.enabled,
        "config": global_engine.config,
    }



class ScenarioComparisonPayload(BaseModel):
    preset: Optional[str] = Field(default="nutrient_stress", description="Scenario challenge preset: nutrient_stress | fouling_surge | cell_death | nominal")
    config: Optional[BioreactorConfig] = None
    fault: Optional[FaultConfig] = None
    simulation_duration: Optional[float] = None
    timestep: Optional[float] = None
    initial_nutrient: Optional[float] = None
    feed_nutrient_concentration: Optional[float] = None
    perfusion_rate: Optional[float] = None


@router.post("/scenario", response_model=ScenarioComparisonResponse)
def run_scenario_comparison(payload: Optional[ScenarioComparisonPayload] = None):
    """Execute side-by-side scenario comparison (Uncontrolled vs Controlled)."""
    p = payload or ScenarioComparisonPayload()

    # Base config
    if p.config:
        cfg = p.config.model_copy()
    else:
        cfg = BioreactorConfig()

    # Overwrite with top-level fields if provided
    if p.simulation_duration is not None:
        cfg.simulation_duration = p.simulation_duration
    if p.timestep is not None:
        cfg.timestep = p.timestep
    if p.initial_nutrient is not None:
        cfg.initial_nutrient = p.initial_nutrient
    if p.feed_nutrient_concentration is not None:
        cfg.feed_nutrient_concentration = p.feed_nutrient_concentration
    if p.perfusion_rate is not None:
        cfg.perfusion_rate = p.perfusion_rate

    # Setup fault based on preset or explicit fault
    fault_mgr = None
    if p.fault:
        fault_mgr = FaultManager(p.fault)
    elif p.preset == "nutrient_stress":
        fault_mgr = FaultManager(FaultConfig(
            fault_type="nutrient_reduction",
            severity=0.9,
            start_time=60.0,
            duration=36.0,
        ))
    elif p.preset == "fouling_surge":
        fault_mgr = FaultManager(FaultConfig(
            fault_type="fouling_surge",
            severity=0.85,
            start_time=72.0,
            duration=40.0,
        ))
    elif p.preset == "cell_death":
        fault_mgr = FaultManager(FaultConfig(
            fault_type="cell_death_surge",
            severity=0.8,
            start_time=60.0,
            duration=30.0,
        ))
    elif p.preset == "nominal":
        fault_mgr = None


    scenario_engine = ScenarioEngine(cfg)
    return scenario_engine.run_comparison(cfg, fault=fault_mgr)



@router.post("/demo")
def run_demo_scenario():
    """Configure and execute the standard reproducible hackathon demo scenario."""
    demo_config = BioreactorConfig(
        reactor_volume=2.0,
        initial_cell_density=0.5e6,
        target_cell_density=1.0e8,
        initial_nutrient=2.0,
        feed_nutrient_concentration=10.0,
        perfusion_rate=1.0,
        min_perfusion_rate=0.5,
        max_perfusion_rate=3.5,
        simulation_duration=120.0,
        timestep=0.5,
        control_enabled=True,
    )
    demo_fault = FaultManager(FaultConfig(
        fault_type="nutrient_reduction",
        severity=0.8,
        start_time=15.0,
        duration=35.0,
    ))
    scenario_engine = ScenarioEngine(demo_config)
    comparison = scenario_engine.run_comparison(demo_config, fault=demo_fault)
    return {
        "status": "demo_executed",
        "story": "High-density perfusion digital twin simulation demonstrating adaptive rule-based control over 120 hours.",
        "demo_config": demo_config,
        "comparison_result": comparison,
    }


@router.post("/fault")
def inject_process_fault(payload: FaultConfig):
    """Inject a simulated process disturbance into the active digital twin."""
    global global_fault_manager
    global_fault_manager = FaultManager(payload)
    return {
        "status": "fault_injected",
        "fault": payload,
        "message": f"Disturbance '{payload.fault_type}' scheduled for t={payload.start_time}h (Duration: {payload.duration}h).",
    }
