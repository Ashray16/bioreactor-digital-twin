import pytest
from app.models.config import BioreactorConfig
from app.models.state import BioreactorState
from app.control.rule_based import RuleBasedController
from app.simulation.engine import SimulationEngine


@pytest.fixture
def default_config():
    return BioreactorConfig(min_perfusion_rate=0.5, max_perfusion_rate=3.5)


def test_controller_low_nutrient_trigger(default_config):
    controller = RuleBasedController()
    state = BioreactorState(
        simulation_time=2.0,
        viable_cell_density=1.0e7,
        nonviable_cell_density=0.1e7,
        cell_viability=90.0,
        total_cell_density=1.1e7,
        nutrient_concentration=1.0,  # < 1.5 g/L -> Low nutrient
        metabolite_concentration=1.0,
        reactor_volume=2.0,
        perfusion_rate=1.0,
        fouling_index=15.0,
        fouling_state="LOW",
        target_cell_density=1.0e8,
    )

    action = controller.evaluate_and_control(state, default_config)
    assert action is not None
    assert action.action_type == "INCREASE_PERFUSION"
    assert action.current_perfusion > action.previous_perfusion
    assert "Low glucose concentration" in action.reason


def test_controller_high_metabolite_trigger(default_config):
    controller = RuleBasedController()
    state = BioreactorState(
        simulation_time=2.0,
        viable_cell_density=2.0e7,
        nonviable_cell_density=0.1e7,
        cell_viability=95.0,
        total_cell_density=2.1e7,
        nutrient_concentration=4.0,
        metabolite_concentration=4.5,  # > 3.5 g/L -> High lactate
        reactor_volume=2.0,
        perfusion_rate=1.0,
        fouling_index=20.0,
        fouling_state="LOW",
        target_cell_density=1.0e8,
    )

    action = controller.evaluate_and_control(state, default_config)
    assert action is not None
    assert action.action_type == "INCREASE_PERFUSION"
    assert action.current_perfusion > action.previous_perfusion
    assert "High lactate accumulation" in action.reason


def test_controller_high_fouling_risk_trigger(default_config):
    controller = RuleBasedController()
    state = BioreactorState(
        simulation_time=50.0,
        viable_cell_density=8.0e7,
        nonviable_cell_density=0.5e7,
        cell_viability=94.0,
        total_cell_density=8.5e7,
        nutrient_concentration=3.0,
        metabolite_concentration=2.0,
        reactor_volume=2.0,
        perfusion_rate=2.5,
        fouling_index=78.0,  # >= 70.0 -> High fouling
        fouling_state="HIGH",
        target_cell_density=1.0e8,
    )

    action = controller.evaluate_and_control(state, default_config)
    assert action is not None
    assert action.action_type == "REDUCE_PERFUSION"
    assert action.current_perfusion < action.previous_perfusion
    assert "High fouling risk" in action.reason


def test_controller_max_perfusion_limit_enforcement():
    config = BioreactorConfig(max_perfusion_rate=3.0)
    controller = RuleBasedController()
    state = BioreactorState(
        simulation_time=10.0,
        viable_cell_density=1.0e7,
        nonviable_cell_density=0.1e7,
        cell_viability=90.0,
        total_cell_density=1.1e7,
        nutrient_concentration=0.5,
        metabolite_concentration=1.0,
        reactor_volume=2.0,
        perfusion_rate=3.0,  # Already at max allowed rate
        fouling_index=15.0,
        fouling_state="LOW",
        target_cell_density=1.0e8,
    )

    action = controller.evaluate_and_control(state, config)
    assert action is None  # Should not exceed max_perfusion_rate


def test_controller_deadband_timing():
    controller = RuleBasedController(deadband_hours=2.0)
    state = BioreactorState(
        simulation_time=1.0,
        viable_cell_density=1.0e7,
        nonviable_cell_density=0.1e7,
        cell_viability=90.0,
        total_cell_density=1.1e7,
        nutrient_concentration=1.0,
        metabolite_concentration=1.0,
        reactor_volume=2.0,
        perfusion_rate=1.0,
        fouling_index=15.0,
        fouling_state="LOW",
        target_cell_density=1.0e8,
    )

    action1 = controller.evaluate_and_control(state, BioreactorConfig())
    assert action1 is not None

    # Immediate next step at t=1.5 (within 2.0 hr deadband)
    state2 = state.model_copy(update={"simulation_time": 1.5, "perfusion_rate": action1.current_perfusion})
    action2 = controller.evaluate_and_control(state2, BioreactorConfig())
    assert action2 is None  # Blocked by deadband

    # Step at t=3.5 (past deadband)
    state3 = state.model_copy(update={"simulation_time": 3.5, "perfusion_rate": action1.current_perfusion})
    action3 = controller.evaluate_and_control(state3, BioreactorConfig())
    assert action3 is not None


def test_engine_integration_with_controller():
    config = BioreactorConfig(
        control_enabled=True,
        initial_nutrient=1.0,  # Low initial glucose
        simulation_duration=24.0,
        timestep=0.5,
    )
    controller = RuleBasedController()
    engine = SimulationEngine(config)

    response = engine.run_full_simulation(config, controller=controller)
    assert response.current_state.controller_enabled is True
    assert len(response.history) > 0
    assert response.current_state.latest_controller_action is not None
