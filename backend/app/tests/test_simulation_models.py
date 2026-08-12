import pytest
from app.models.config import BioreactorConfig
from app.simulation.cell_growth import (
    calculate_specific_growth_rate,
    calculate_cell_death_rate,
    calculate_cell_density_derivatives,
)
from app.simulation.nutrients import calculate_nutrient_derivative
from app.simulation.metabolites import calculate_metabolite_derivative
from app.simulation.perfusion import vvd_to_dilution_rate, calculate_flow_rates
from app.simulation.fouling import calculate_fouling_index


@pytest.fixture
def default_config():
    return BioreactorConfig()


def test_cell_growth_monod_and_inhibition(default_config):
    # Favorable conditions
    mu_fav = calculate_specific_growth_rate(
        nutrient=5.0, metabolite=0.2, viable_cells=1.0e6, config=default_config
    )
    assert mu_fav > 0.0

    # Low nutrient condition -> growth velocity must decrease
    mu_low_nut = calculate_specific_growth_rate(
        nutrient=0.1, metabolite=0.2, viable_cells=1.0e6, config=default_config
    )
    assert mu_low_nut < mu_fav

    # High metabolite condition -> growth velocity must decrease
    mu_high_met = calculate_specific_growth_rate(
        nutrient=5.0, metabolite=10.0, viable_cells=1.0e6, config=default_config
    )
    assert mu_high_met < mu_fav

    # Carrying capacity ceiling condition -> growth velocity must drop to 0
    mu_max_density = calculate_specific_growth_rate(
        nutrient=5.0, metabolite=0.2, viable_cells=default_config.max_sustainable_density, config=default_config
    )
    assert mu_max_density == 0.0


def test_cell_death_rate_acceleration(default_config):
    kd_low = calculate_cell_death_rate(metabolite=0.2, config=default_config)
    kd_high = calculate_cell_death_rate(metabolite=10.0, config=default_config)
    assert kd_high > kd_low


def test_nutrient_consumption_and_perfusion(default_config):
    # Low cell density -> replenishment > consumption -> dS/dt > 0
    ds_low = calculate_nutrient_derivative(
        nutrient=2.0, viable_cells=1.0e6, perfusion_rate_vvd=2.0, config=default_config
    )
    assert ds_low > 0.0

    # High cell density -> consumption > replenishment -> dS/dt < 0
    ds_high = calculate_nutrient_derivative(
        nutrient=5.0, viable_cells=1.0e8, perfusion_rate_vvd=0.5, config=default_config
    )
    assert ds_high < 0.0


def test_metabolite_production_and_washout(default_config):
    # High perfusion -> washout increases
    dp_low_perf = calculate_metabolite_derivative(
        metabolite=3.0, viable_cells=5.0e7, perfusion_rate_vvd=0.5, config=default_config
    )
    dp_high_perf = calculate_metabolite_derivative(
        metabolite=3.0, viable_cells=5.0e7, perfusion_rate_vvd=3.0, config=default_config
    )
    assert dp_high_perf < dp_low_perf


def test_perfusion_conversion():
    D = vvd_to_dilution_rate(24.0)
    assert D == 1.0
    inflow, outflow = calculate_flow_rates(perfusion_rate_vvd=1.0, reactor_volume_L=2.0)
    assert inflow == pytest.approx(2.0 / 24.0)
    assert outflow == inflow


def test_fouling_risk_index_bounds_and_categorization(default_config):
    # Low load condition
    idx_low, state_low = calculate_fouling_index(
        viable_cells=0.5e6,
        total_cells=0.5e6,
        perfusion_rate_vvd=1.0,
        simulation_time_hours=0.0,
        config=default_config,
    )
    assert 0.0 <= idx_low <= 30.0
    assert state_low == "LOW"

    # High biomass load condition -> fouling index increases
    idx_high, state_high = calculate_fouling_index(
        viable_cells=1.5e8,
        total_cells=1.5e8,
        perfusion_rate_vvd=3.0,
        simulation_time_hours=100.0,
        config=default_config,
    )
    assert idx_high > idx_low
    assert idx_high <= 100.0
    assert state_high in ["HIGH", "CRITICAL"]
