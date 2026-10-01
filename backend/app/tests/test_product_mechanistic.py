"""Unit and Integration Tests for Mechanistic CHO Product Concentration (Titer) Kinetics.

Validates the ODE formulation:
    dP_t/dt = q_p * X_v - D * P_t

Tests:
    - Initial condition defaults and customization
    - Non-negativity preservation at boundaries
    - Monotonic increase with positive q_p under batch/perfusion
    - Zero q_p behavior (no product synthesis)
    - Perfusion washout dynamics (dilution rate D * P_t)
    - Response to viable cell density (VCC) scaling
    - 4th-Order Runge-Kutta (RK4) numerical integration consistency
    - Engine reset restoring initial product state
    - FastAPI endpoints exposing product_concentration in state and history
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.config import BioreactorConfig
from app.simulation.engine import SimulationEngine
from app.simulation.product import calculate_product_derivative
from app.simulation.perfusion import vvd_to_dilution_rate


@pytest.fixture
def client():
    return TestClient(app)


def test_product_initial_condition():
    """Verify that product concentration initializes according to config."""
    # Default initial product is 0.0 g/L
    engine_default = SimulationEngine()
    assert engine_default.current_state.product_concentration == 0.0
    assert len(engine_default.history) == 1
    assert engine_default.history[0].product_concentration == 0.0

    # Custom initial product
    custom_cfg = BioreactorConfig(initial_product=2.5)
    engine_custom = SimulationEngine(custom_cfg)
    assert engine_custom.current_state.product_concentration == 2.5
    assert engine_custom.history[0].product_concentration == 2.5


def test_product_non_negative():
    """Verify that derivative and state never become negative even with zero or sub-zero product."""
    cfg = BioreactorConfig(specific_productivity_qp=0.0)
    # With q_p=0 and product=0, derivative should be >= 0.0
    dpt = calculate_product_derivative(product=0.0, viable_cells=1e7, perfusion_rate_vvd=2.0, config=cfg)
    assert dpt >= 0.0

    # With negative initial condition boundary protection
    dpt_neg = calculate_product_derivative(product=-1.0, viable_cells=1e7, perfusion_rate_vvd=2.0, config=cfg)
    assert dpt_neg >= 0.0


def test_product_increases_with_positive_qp():
    """Verify product accumulates over time when specific productivity q_p > 0."""
    cfg = BioreactorConfig(
        initial_product=0.0,
        specific_productivity_qp=1.0e-9,
        initial_cell_density=1.0e7,
        perfusion_rate=1.0,
        simulation_duration=24.0,
        timestep=0.5,
    )
    engine = SimulationEngine(cfg)
    initial_product = engine.current_state.product_concentration

    res = engine.run_full_simulation(cfg)
    assert res.current_state.product_concentration > initial_product
    assert res.current_state.product_concentration > 0.0
    # Check history trajectory increases
    assert res.history[-1].product_concentration > res.history[0].product_concentration


def test_product_zero_qp():
    """Verify no product is formed when specific productivity q_p = 0."""
    cfg = BioreactorConfig(
        initial_product=0.0,
        specific_productivity_qp=0.0,
        initial_cell_density=1.0e7,
        perfusion_rate=1.0,
        simulation_duration=24.0,
        timestep=0.5,
    )
    engine = SimulationEngine(cfg)
    res = engine.run_full_simulation(cfg)
    assert res.current_state.product_concentration == 0.0
    for item in res.history:
        assert item.product_concentration == 0.0


def test_product_perfusion_washout():
    """Verify higher perfusion rate increases dilution washout D * P_t."""
    # When cells are zero or very low and product is high, higher perfusion should wash out product faster
    cfg_low_d = BioreactorConfig(
        initial_product=10.0,
        specific_productivity_qp=0.0,
        initial_cell_density=0.1,
        perfusion_rate=0.5, # 0.5 VVD
        simulation_duration=24.0,
        timestep=0.5,
    )
    cfg_high_d = BioreactorConfig(
        initial_product=10.0,
        specific_productivity_qp=0.0,
        initial_cell_density=0.1,
        perfusion_rate=3.0, # 3.0 VVD
        simulation_duration=24.0,
        timestep=0.5,
    )

    engine_low = SimulationEngine(cfg_low_d)
    res_low = engine_low.run_full_simulation(cfg_low_d)

    engine_high = SimulationEngine(cfg_high_d)
    res_high = engine_high.run_full_simulation(cfg_high_d)

    # Product should wash out significantly more under higher perfusion rate
    assert res_high.current_state.product_concentration < res_low.current_state.product_concentration
    # Analytical check: P(t) = P0 * exp(-D * t)
    D_high = vvd_to_dilution_rate(3.0)
    expected_high = 10.0 * (2.718281828459045 ** (-D_high * 24.0))
    assert abs(res_high.current_state.product_concentration - expected_high) < 0.05


def test_product_response_to_vcc():
    """Verify product formation rate is directly proportional to viable cell density X_v."""
    cfg = BioreactorConfig(
        specific_productivity_qp=1.0e-9,
        perfusion_rate=0.0, # Batch mode (no washout)
    )
    dpt_low_vcc = calculate_product_derivative(product=0.0, viable_cells=1.0e6, perfusion_rate_vvd=0.0, config=cfg)
    dpt_high_vcc = calculate_product_derivative(product=0.0, viable_cells=1.0e7, perfusion_rate_vvd=0.0, config=cfg)

    # 10x cell density must yield exactly 10x product derivative rate
    assert abs(dpt_high_vcc - 10.0 * dpt_low_vcc) < 1e-12


def test_product_rk4_integration():
    """Verify RK4 single step updates product concentration correctly."""
    cfg = BioreactorConfig(
        initial_product=1.0,
        specific_productivity_qp=1.0e-9,
        initial_cell_density=1.0e7,
        perfusion_rate=1.0,
        timestep=0.5,
    )
    engine = SimulationEngine(cfg)
    p0 = engine.current_state.product_concentration
    next_state = engine.step(dt=0.5)

    assert next_state.product_concentration > 0.0
    assert next_state.product_concentration != p0
    assert len(engine.history) == 2
    assert engine.history[1].product_concentration == round(next_state.product_concentration, 3)


def test_product_reset():
    """Verify engine reset reinitializes product concentration back to config."""
    cfg = BioreactorConfig(
        initial_product=3.0,
        specific_productivity_qp=1.0e-9,
        simulation_duration=24.0,
    )
    engine = SimulationEngine(cfg)
    engine.run_full_simulation(cfg)
    assert engine.current_state.simulation_time == 24.0

    # Reset
    st_reset = engine.reset()
    assert st_reset.simulation_time == 0.0
    assert st_reset.product_concentration == 3.0
    assert len(engine.history) == 1
    assert engine.history[0].product_concentration == 3.0


def test_api_product_state(client):
    """Verify FastAPI simulation endpoints return product_concentration in state and history."""
    # 1. Start/initialize endpoint
    init_resp = client.post("/api/v1/simulation/start", json={"initial_product": 1.5})
    assert init_resp.status_code == 200
    init_data = init_resp.json()
    assert "product_concentration" in init_data
    assert init_data["product_concentration"] == 1.5

    # 2. Step endpoint
    step_resp = client.post("/api/v1/simulation/step", json={"dt": 0.5})
    assert step_resp.status_code == 200
    step_data = step_resp.json()
    assert "product_concentration" in step_data
    assert step_data["product_concentration"] >= 0.0

    # 3. Run full simulation endpoint
    run_resp = client.post("/api/v1/simulation/run", json={"simulation_duration": 12.0, "initial_product": 0.0})
    assert run_resp.status_code == 200
    run_data = run_resp.json()
    assert "current_state" in run_data
    assert "product_concentration" in run_data["current_state"]
    assert "history" in run_data
    assert len(run_data["history"]) > 0
    assert "product_concentration" in run_data["history"][0]
    assert "summary_metrics" in run_data
    assert "final_product_concentration" in run_data["summary_metrics"]
