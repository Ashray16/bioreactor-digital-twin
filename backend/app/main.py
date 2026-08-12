from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Digital Twin Bioreactor Platform API",
    description="API server for BB 04 Mammalian Cell Perfusion Bioreactor Digital Twin & Control Platform",
    version="1.0.0",
)

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
def health_check():
    return {
        "status": "healthy",
        "engine": "ready",
        "target_cell_density_goal": "1.0e8 cells/mL",
    }
