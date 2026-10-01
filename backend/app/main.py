from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import simulation, ai, analytics

app = FastAPI(
    title="Digital Twin Bioreactor Platform API",
    description="API server for BB 04 Mammalian Cell Perfusion Bioreactor Digital Twin & Control Platform",
    version="1.0.0",
)

app.include_router(simulation.router)
app.include_router(ai.router)
app.include_router(analytics.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "BB 04 Digital Twin Bioreactor API",
        "version": "1.0.0",
    }


@app.get("/health")
@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "engine": "ready",
        "target_cell_density_goal": "1.0e8 cells/mL",
        "models": {
            "cell_growth": "Monod / Contois kinetic growth with viability loss",
            "nutrients": "Glucose consumption & perfusion feed replenishment",
            "metabolites": "Lactate accumulation & perfusion clearance",
            "perfusion": "Continuous liquid volume & exchange engine",
            "fouling": "0-100 Normalized membrane clogging risk proxy",
            "controller": "Rule-based adaptive perfusion controller",
        },
    }


@app.get("/api/v1/info")
def system_info():
    return {
        "app_name": "BB 04 Digital Twin Bioreactor Platform",
        "version": "1.0.0",
        "domain": "BioE3 & Biomanufacturing",
        "target_density_cells_per_ml": 1.0e8,
        "default_working_volume_L": 2.0,
        "supported_control_modes": ["rule_based", "pid", "uncontrolled"],
    }

