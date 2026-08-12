from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "Digital Twin Bioreactor" in data["service"]


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["engine"] == "ready"
    assert "models" in data
    assert "cell_growth" in data["models"]


def test_api_v1_health_check():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_system_info():
    response = client.get("/api/v1/info")
    assert response.status_code == 200
    data = response.json()
    assert data["target_density_cells_per_ml"] == 1.0e8
    assert "rule_based" in data["supported_control_modes"]
