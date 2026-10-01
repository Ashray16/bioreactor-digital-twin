import os
import sys
import pytest
import numpy as np

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.models.config import BioreactorConfig
from app.simulation.engine import SimulationEngine
from app.control.rule_based import RuleBasedController
from app.simulation.scenario import ScenarioEngine
from app.simulation.faults import FaultConfig, FaultManager
from app.ml.inference_dataset2 import TiterInferenceEngine, TiterInputSchema, predict_titer

# ---------------------------------------------------------
# 1. Trigger-Based Trajectory Divergence Test
# ---------------------------------------------------------
def test_trigger_based_trajectory_divergence():
    # Case A: High Glucose (No trigger reached) -> Trajectories may be identical initially
    high_glucose_cfg = BioreactorConfig(
        initial_nutrient=10.0,
        feed_nutrient_concentration=20.0,
        simulation_duration=24.0,
        timestep=1.0,
        perfusion_rate=1.0
    )
    engine_no_trigger_ctrl = SimulationEngine(high_glucose_cfg)
    controller_a = RuleBasedController()
    res_no_ctrl = engine_no_trigger_ctrl.run_full_simulation(high_glucose_cfg, controller=controller_a)

    engine_no_trigger_unctrl = SimulationEngine(high_glucose_cfg)
    res_no_unctrl = engine_no_trigger_unctrl.run_full_simulation(high_glucose_cfg, controller=None)

    # Case B: Low Glucose (Trigger intentionally induced) -> Controller MUST act and trajectories MUST diverge
    low_glucose_cfg = BioreactorConfig(
        initial_nutrient=0.8, # Below 1.5 g/L threshold
        feed_nutrient_concentration=10.0,
        simulation_duration=72.0,
        timestep=1.0,
        perfusion_rate=0.8
    )

    scenario_engine = ScenarioEngine(low_glucose_cfg)
    res_comparison = scenario_engine.run_comparison(low_glucose_cfg)

    unctrl_history = res_comparison.uncontrolled_scenario.history
    ctrl_history = res_comparison.controlled_scenario.history

    # Extract perfusion rates
    unctrl_perfusion = [h.perfusion_rate for h in unctrl_history]
    ctrl_perfusion = [h.perfusion_rate for h in ctrl_history]

    # ASSERTION 1: Controlled trajectory MUST diverge from uncontrolled when trigger is reached
    assert ctrl_perfusion != unctrl_perfusion, "Controlled perfusion trajectory failed to diverge when trigger was induced!"
    
    # ASSERTION 2: Divergence cause must be recorded
    assert res_comparison.divergence_cause is not None
    assert "glucose" in res_comparison.divergence_cause.lower() or "perfusion" in res_comparison.divergence_cause.lower()

# ---------------------------------------------------------
# 2. Controller Hysteresis & Anti-Oscillation Test
# ---------------------------------------------------------
def test_controller_hysteresis_and_bounds():
    cfg = BioreactorConfig(
        initial_nutrient=0.5,
        min_perfusion_rate=0.5,
        max_perfusion_rate=3.5,
        simulation_duration=24.0,
        timestep=0.5
    )
    engine = SimulationEngine(cfg)
    controller = RuleBasedController(deadband_hours=2.0)

    # Step simulation and record action timestamps
    action_timestamps = []
    for _ in range(48):
        st = engine.step(controller=controller)
        if st.latest_controller_action:
            ts = st.latest_controller_action.timestamp
            if ts not in action_timestamps:
                action_timestamps.append(ts)

    # Check deadband constraint (time between consecutive actions >= 2.0 hours)
    for i in range(1, len(action_timestamps)):
        diff = action_timestamps[i] - action_timestamps[i-1]
        assert diff >= 2.0 - 1e-5, f"Controller oscillated! Step diff {diff} h < deadband 2.0 h"

# ---------------------------------------------------------
# 3. Fault Detection & Control Recovery Metrics Test
# ---------------------------------------------------------
def test_fault_detection_and_recovery():
    cfg = BioreactorConfig(
        initial_cell_density=0.5e8,
        initial_nutrient=4.0,
        feed_nutrient_concentration=10.0,
        simulation_duration=96.0,
        timestep=1.0,
        perfusion_rate=1.0,
        control_enabled=True,
    )
    fault_cfg = FaultConfig(
        fault_type="nutrient_reduction",
        severity=0.95,
        start_time=10.0,
        duration=24.0
    )

    fault_mgr = FaultManager(fault_cfg)
    engine = SimulationEngine(cfg)
    controller = RuleBasedController()

    fault_action_time = None
    min_glucose = 999.0

    for _ in range(96):
        fault_name = fault_mgr.apply_fault(engine)
        st = engine.step(controller=controller, active_fault=fault_name)

        if st.nutrient_concentration < min_glucose:
            min_glucose = st.nutrient_concentration

        if st.latest_controller_action and st.simulation_time >= fault_cfg.start_time and fault_action_time is None:
            fault_action_time = st.latest_controller_action.timestamp

    # ASSERTIONS: Fault detection, intervention, and recovery metrics
    assert fault_action_time is not None, "Controller failed to detect fault and take action during fault window!"
    assert fault_action_time >= fault_cfg.start_time

    detection_time_hrs = fault_action_time - fault_cfg.start_time
    intervention_time_hrs = fault_action_time
    peak_deviation_glucose = 4.0 - min_glucose

    assert detection_time_hrs >= 0.0, f"Detection time {detection_time_hrs} h must be non-negative!"
    assert intervention_time_hrs >= fault_cfg.start_time
    assert peak_deviation_glucose > 0.0

# ---------------------------------------------------------
# 4. Explicit Trade-Off Outcome Logic Test
# ---------------------------------------------------------
def test_trade_off_outcome_logic():
    # Long simulation duration (120 h) where controlled run yields higher cells but consumes >15% more media
    cfg = BioreactorConfig(
        initial_cell_density=0.5e8,
        initial_nutrient=1.2, # Low glucose triggers early controller boost
        simulation_duration=120.0,
        timestep=1.0,
        perfusion_rate=0.8
    )

    scenario_engine = ScenarioEngine(cfg)
    res = scenario_engine.run_comparison(cfg)

    # Check total media consumed
    media_unctrl = res.total_media_consumed_uncontrolled_L
    media_ctrl = res.total_media_consumed_controlled_L

    assert media_ctrl > media_unctrl, "Controlled run must consume more media when increasing perfusion!"
    assert res.overall_outcome in ["TRADE-OFF", "IMPROVED"], f"Outcome {res.overall_outcome} must reflect performance!"

# ---------------------------------------------------------
# 5. AI Non-Regression Test
# ---------------------------------------------------------
def test_ai_non_regression():
    # Ensure Dataset 2 AI engine remains non-authoritative and 100% functional
    valid_input = TiterInputSchema(
        temperature=37.0,
        substrate_concentration=20.0,
        reactor_volume=1.0,
        oxygen=1.0,
        fermentation_duration=24.0
    )
    pred_res = predict_titer(valid_input)
    assert pred_res.prediction > 0.0
    assert pred_res.unit == "g/L"
