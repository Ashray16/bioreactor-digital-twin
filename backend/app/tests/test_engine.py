import pytest
from app.models.config import BioreactorConfig
from app.simulation.engine import SimulationEngine


def test_engine_initialization():
    config = BioreactorConfig(initial_cell_density=1.0e6, reactor_volume=2.0)
    engine = SimulationEngine(config)
    
    state = engine.current_state
    assert state.simulation_time == 0.0
    assert state.viable_cell_density == 0.98e6
    assert state.nonviable_cell_density == pytest.approx(0.02e6)
    assert len(engine.history) == 1
    assert engine.history[0].time == 0.0


def test_engine_single_step():
    config = BioreactorConfig(timestep=0.5, max_growth_rate=0.04)
    engine = SimulationEngine(config)
    
    initial_cell_density = engine.current_state.viable_cell_density
    next_state = engine.step(dt=0.5)

    assert next_state.simulation_time == 0.5
    # Cell density should increase under favorable initial conditions
    assert next_state.viable_cell_density > initial_cell_density
    assert len(engine.history) == 2


def test_engine_run_full_simulation():
    config = BioreactorConfig(simulation_duration=24.0, timestep=0.5)
    engine = SimulationEngine(config)
    
    response = engine.run_full_simulation(config)
    assert response.current_state.simulation_time == 24.0
    assert len(response.history) == 49  # t=0 to t=24 in steps of 0.5 -> 49 items
    
    summary = response.summary_metrics
    assert "final_viable_cell_density" in summary
    assert "maximum_fouling_index" in summary
    assert summary["total_simulated_hours"] == 24.0


def test_engine_physical_constraints_non_negativity():
    # Extreme consumption / low feed config
    config = BioreactorConfig(
        initial_nutrient=0.1,
        feed_nutrient_concentration=0.1,
        cell_nutrient_consumption_rate=1.0e-7,
        simulation_duration=48.0,
        timestep=1.0,
    )
    engine = SimulationEngine(config)
    response = engine.run_full_simulation(config)

    for item in response.history:
        assert item.viable_cell_density >= 0.0
        assert item.nonviable_cell_density >= 0.0
        assert item.nutrient_concentration >= 0.0
        assert item.metabolite_concentration >= 0.0
        assert 0.0 <= item.cell_viability <= 100.0
        assert 0.0 <= item.fouling_index <= 100.0


def test_engine_reproducibility():
    config = BioreactorConfig(simulation_duration=12.0, timestep=0.5)
    
    engine1 = SimulationEngine(config)
    res1 = engine1.run_full_simulation(config)
    
    engine2 = SimulationEngine(config)
    res2 = engine2.run_full_simulation(config)

    assert res1.current_state.viable_cell_density == res2.current_state.viable_cell_density
    assert res1.current_state.fouling_index == res2.current_state.fouling_index
