"""Fault Injection Framework for Digital Twin Bioreactor Platform.

Simulates process disturbances (nutrient feed reduction, cell mortality surge,
filter fouling surge, perfusion pump disruption) to evaluate controller resilience.
"""
from pydantic import BaseModel, Field
from typing import Literal, Optional


class FaultConfig(BaseModel):
    """Configuration schema for injecting a simulated process disturbance."""

    fault_type: Literal[
        "nutrient_reduction",
        "cell_death_surge",
        "fouling_surge",
        "perfusion_disruption",
    ] = Field(description="Type of process disturbance to inject")
    severity: float = Field(
        default=0.5,
        ge=0.1,
        le=1.0,
        description="Disturbance severity factor (0.1 to 1.0)",
    )
    start_time: float = Field(
        default=10.0,
        ge=0.0,
        description="Simulation time (hours) when disturbance begins",
    )
    duration: float = Field(
        default=24.0,
        gt=0.0,
        description="Duration (hours) of active disturbance",
    )


class FaultManager:
    """Manages active process faults during simulation execution."""

    def __init__(self, fault_config: Optional[FaultConfig] = None):
        self.config = fault_config

    def apply_fault(self, engine) -> Optional[str]:
        """Inspect current simulation time and apply fault modifications if within active window."""
        if not self.config:
            return None

        current_time = engine.current_state.simulation_time
        if not (self.config.start_time <= current_time < (self.config.start_time + self.config.duration)):
            return None

        ftype = self.config.fault_type
        severity = self.config.severity

        if ftype == "nutrient_reduction":
            # Reduce feed nutrient concentration (e.g. 50-90% drop)
            reduction_factor = 1.0 - (0.8 * severity)
            engine.config.feed_nutrient_concentration = max(1.0, 10.0 * reduction_factor)
            return f"Nutrient Feed Reduction ({severity*100:.0f}% Severity)"

        elif ftype == "cell_death_surge":
            # Increase cell death rate
            engine.config.death_rate_base = 0.002 + (0.03 * severity)
            return f"Cell Death Rate Surge ({severity*100:.0f}% Severity)"

        elif ftype == "fouling_surge":
            # Increase filter fouling sensitivity multiplier
            engine.config.fouling_sensitivity = 1.0 + (3.0 * severity)
            return f"Filter Fouling Surge ({severity*100:.0f}% Severity)"

        elif ftype == "perfusion_disruption":
            # Reduce perfusion rate significantly
            engine.current_state.perfusion_rate = max(0.2, engine.current_state.perfusion_rate * (1.0 - 0.7 * severity))
            return f"Perfusion Pump Disruption ({severity*100:.0f}% Severity)"

        return None
