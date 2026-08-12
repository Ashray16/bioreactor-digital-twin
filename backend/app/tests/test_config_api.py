from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_default_configuration():
    response = client.get("/api/v1/simulation/config/default")
    assert response.status_code == 200
    data = response.json()
    assert data["target_cell_density"] == 1.0e8
    assert data["reactor_volume"] == 2.0
    assert data["perfusion_rate"] == 1.0


def test_validate_configuration_success():
    payload = {
        "reactor_volume": 5.0,
        "initial_cell_density": 1.0e6,
        "target_cell_density": 1.2e8,
        "max_growth_rate": 0.04,
        "perfusion_rate": 1.5,
        "min_perfusion_rate": 0.5,
        "max_perfusion_rate": 3.5,
    }
    response = client.post("/api/v1/simulation/config/validate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["config"]["reactor_volume"] == 5.0


def test_validate_configuration_rejection_negative_volume():
    payload = {
        "reactor_volume": -2.0,
    }
    response = client.post("/api/v1/simulation/config/validate", json=payload)
    assert response.status_code == 422  # Unprocessable Entity (Pydantic validation failure)


def test_validate_configuration_rejection_invalid_perfusion_bounds():
    payload = {
        "min_perfusion_rate": 4.0,
        "max_perfusion_rate": 1.0,  # min > max violation
    }
    response = client.post("/api/v1/simulation/config/validate", json=payload)
    assert response.status_code == 422


def test_initialize_simulation_default():
    response = client.post("/api/v1/simulation/initialize", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["simulation_time"] == 0.0
    assert data["total_cell_density"] == 0.5e6
    assert data["cell_viability"] == 98.0
    assert data["fouling_index"] <= 5.0
    assert data["fouling_state"] == "LOW"
