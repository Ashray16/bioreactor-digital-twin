import pytest
from app.models.config import BioreactorConfig
from app.simulation.scenario import ScenarioEngine


def test_scenario_comparison_execution():
    config = BioreactorConfig(
        simulation_duration=24.0,
        timestep=0.5,
        initial_nutrient=2.0,  # Low initial glucose to trigger adaptive control
    )
    scenario_engine = ScenarioEngine(config)
    res = scenario_engine.run_comparison(config)

    assert res.uncontrolled_scenario is not None
    assert res.controlled_scenario is not None
    assert len(res.comparison_table) == 6
    assert res.total_media_consumed_uncontrolled_L > 0.0
    assert res.total_media_consumed_controlled_L > 0.0

    assert res.overall_outcome in ["IMPROVED", "NO_SIGNIFICANT_CHANGE", "DEGRADED"]
    assert len(res.outcome_summary) > 0



def test_scenario_controlled_outperforms_uncontrolled_under_nutrient_stress():
    # Low nutrient feed config where uncontrolled system runs out of glucose
    config = BioreactorConfig(
        initial_nutrient=1.0,
        feed_nutrient_concentration=5.0,
        perfusion_rate=0.5,  # Low fixed perfusion for uncontrolled
        simulation_duration=36.0,
        timestep=0.5,
    )
    scenario_engine = ScenarioEngine(config)
    res = scenario_engine.run_comparison(config)

    st_uncontrolled = res.uncontrolled_scenario.current_state
    st_controlled = res.controlled_scenario.current_state

    # Controlled system should adaptively boost perfusion to prevent severe glucose starvation
    assert st_controlled.viable_cell_density > st_uncontrolled.viable_cell_density
    assert st_controlled.cell_viability >= st_uncontrolled.cell_viability
