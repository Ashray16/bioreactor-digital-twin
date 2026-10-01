from pydantic import BaseModel, Field, model_validator
from typing import Optional, Literal


class BioreactorConfig(BaseModel):
    """Configuration parameters for the mammalian perfusion bioreactor digital twin."""

    # Bioreactor Geometry & Operations
    reactor_volume: float = Field(
        default=2.0,
        gt=0,
        le=1000.0,
        description="Working volume of the bioreactor in Liters (L)",
    )
    initial_cell_density: float = Field(
        default=0.5e6,
        gt=0,
        le=5.0e8,
        description="Initial viable cell density (cells/mL)",
    )
    target_cell_density: float = Field(
        default=1.0e8,
        gt=0,
        le=5.0e8,
        description="Target cell density goal (cells/mL). Default: >10^8 cells/mL",
    )
    initial_viability: float = Field(
        default=98.0,
        ge=0.0,
        le=100.0,
        description="Initial cell viability percentage (%)",
    )

    # Cell Growth Kinetics (Monod / Contois kinetics assumptions)
    max_growth_rate: float = Field(
        default=0.035,
        gt=0,
        le=0.2,
        description="Maximum specific cell growth rate mu_max (1/hour)",
    )
    death_rate_base: float = Field(
        default=0.002,
        ge=0,
        le=0.05,
        description="Baseline cell death rate k_d (1/hour)",
    )
    max_sustainable_density: float = Field(
        default=1.5e8,
        gt=1.0e6,
        le=1.0e9,
        description="Maximum carrying capacity / sustainable cell density (cells/mL)",
    )

    # Nutrient (Glucose) Kinetics
    initial_nutrient: float = Field(
        default=3.0,
        ge=0,
        le=50.0,
        description="Initial glucose concentration (g/L)",
    )
    feed_nutrient_concentration: float = Field(
        default=7.0,
        gt=0,
        le=100.0,
        description="Nutrient concentration in fresh perfusion media feed (g/L)",
    )
    cell_nutrient_consumption_rate: float = Field(
        default=5.0e-9,
        gt=0,
        description="Specific glucose consumption rate q_s (g/L/hr per cell/mL)",
    )
    monod_constant_nutrient: float = Field(
        default=0.5,
        gt=0,
        description="Monod substrate saturation constant K_s (g/L)",
    )

    # Metabolite (Lactate) Kinetics
    initial_metabolite: float = Field(
        default=0.2,
        ge=0,
        le=20.0,
        description="Initial lactate concentration (g/L)",
    )
    cell_metabolite_yield: float = Field(
        default=4.0e-9,
        ge=0,
        description="Specific lactate yield rate q_p (g/L/hr per cell/mL)",
    )
    metabolite_inhibition_constant: float = Field(
        default=4.0,
        gt=0,
        description="Lactate threshold for 50% cell growth inhibition K_i (g/L)",
    )

    # Product (Titer / mAb) Formation Kinetics
    initial_product: float = Field(
        default=0.0,
        ge=0,
        le=50.0,
        description="Initial product concentration / titer (g/L)",
    )
    specific_productivity_qp: float = Field(
        default=1.0e-9,
        ge=0,
        le=1.0e-7,
        description="Specific product productivity q_p (g/L/h per cell/mL, assumed ~24 pg/cell/day)",
    )

    # Perfusion System Config
    perfusion_rate: float = Field(
        default=0.4,
        ge=0.0,
        le=10.0,
        description="Initial perfusion rate in Vessel Volumes per Day (VVD)",
    )
    min_perfusion_rate: float = Field(
        default=0.2,
        ge=0.0,
        le=5.0,
        description="Minimum allowed controller perfusion rate (VVD)",
    )
    max_perfusion_rate: float = Field(
        default=4.0,
        gt=0.0,
        le=10.0,
        description="Maximum allowed controller perfusion rate (VVD)",
    )

    # Filter Fouling Parameters
    filter_area: float = Field(
        default=0.1,
        gt=0,
        description="Filter membrane surface area (m^2)",
    )
    fouling_sensitivity: float = Field(
        default=1.0,
        gt=0,
        le=10.0,
        description="Fouling sensitivity scaling factor",
    )
    fouling_warning_threshold: float = Field(
        default=70.0,
        ge=0,
        le=100.0,
        description="Fouling index warning threshold (0-100)",
    )

    # Adaptive Controller Thresholds & Gain
    nutrient_threshold_low: float = Field(
        default=2.0,
        gt=0.0,
        le=10.0,
        description="Critical low glucose limit triggering perfusion increase (g/L)",
    )
    metabolite_threshold_high: float = Field(
        default=3.5,
        gt=0.0,
        le=20.0,
        description="Upper lactate toxicity limit triggering perfusion increase (g/L)",
    )
    fouling_threshold_high: float = Field(
        default=70.0,
        ge=0.0,
        le=100.0,
        description="Membrane fouling risk threshold triggering perfusion reduction (0-100)",
    )
    step_increment_vvd: float = Field(
        default=0.3,
        gt=0.0,
        le=2.0,
        description="Perfusion step size increment on nutrient/metabolite triggers (VVD)",
    )

    # Operating Environment Parameters
    temperature: float = Field(
        default=37.0,
        ge=30.0,
        le=42.0,
        description="Culture temperature (°C)",
    )
    ph: float = Field(
        default=7.2,
        ge=6.0,
        le=8.5,
        description="Culture pH",
    )

    # Simulation Execution Controls
    simulation_duration: float = Field(
        default=240.0,
        gt=0,
        le=720.0,
        description="Total simulation duration (hours, e.g. 240h = 10 days)",
    )
    timestep: float = Field(
        default=0.5,
        gt=0.01,
        le=6.0,
        description="Simulation integration timestep dt (hours)",
    )
    control_enabled: bool = Field(
        default=False,
        description="Whether automated adaptive controller is enabled",
    )
    control_mode: Literal["rule_based", "pid", "uncontrolled"] = Field(
        default="rule_based",
        description="Control mode strategy",
    )


    @model_validator(mode="after")
    def validate_bounds_and_perfusion(self):
        if self.min_perfusion_rate > self.max_perfusion_rate:
            raise ValueError("min_perfusion_rate cannot be greater than max_perfusion_rate")
        if self.perfusion_rate < self.min_perfusion_rate or self.perfusion_rate > self.max_perfusion_rate:
            self.perfusion_rate = max(self.min_perfusion_rate, min(self.perfusion_rate, self.max_perfusion_rate))
        return self
