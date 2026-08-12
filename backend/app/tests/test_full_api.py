from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_api_start_and_get_state():
    response = client.post("/api/v1/simulation/start", json={"reactor_volume": 3.0})
    assert response.status_code == 200
    data = response.json()
    assert data["simulation_time"] == 0.0
    assert data["reactor_volume"] == 3.0

    state_resp = client.get("/api/v1/simulation/state")
    assert state_resp.status_code == 200
    assert state_resp.json()["simulation_time"] == 0.0


def test_api_step_simulation():
    client.post("/api/v1/simulation/start", json={})
    step_resp = client.post("/api/v1/simulation/step", json={"dt": 1.0})
    assert step_resp.status_code == 200
    data = step_resp.json()
    assert data["simulation_time"] == 1.0


def test_api_run_full_simulation():
    payload = {"simulation_duration": 12.0, "timestep": 0.5}
    response = client.post("/api/v1/simulation/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["history"]) == 25
    assert "summary_metrics" in data


def test_api_control_settings_update():
    response = client.post(
        "/api/v1/simulation/control",
        json={"enabled": True, "min_perfusion_rate": 0.5, "max_perfusion_rate": 4.0},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["control_enabled"] is True


def test_api_scenario_comparison():
    response = client.post(
        "/api/v1/simulation/scenario",
        json={"simulation_duration": 12.0, "timestep": 0.5},
    )
    assert response.status_code == 200
    data = response.json()
    assert "uncontrolled_scenario" in data
    assert "controlled_scenario" in data
    assert len(data["comparison_table"]) == 6


def test_api_demo_scenario():
    response = client.post("/api/v1/simulation/demo")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "demo_executed"
    assert "comparison_result" in data
    assert len(data["comparison_result"]["comparison_table"]) == 6


def test_api_fault_injection():
    fault_payload = {
        "fault_type": "nutrient_reduction",
        "severity": 0.8,
        "start_time": 0.0,
        "duration": 5.0,
    }
    resp = client.post("/api/v1/simulation/fault", json=fault_payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "fault_injected"

    # Step simulation during active fault window
    step_resp = client.post("/api/v1/simulation/step", json={"dt": 1.0})
    assert step_resp.status_code == 200
    assert step_resp.json()["active_fault"] is not None


