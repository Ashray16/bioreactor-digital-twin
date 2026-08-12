"""Scenario Engine & Comparative Bioprocess Analysis.

Executes side-by-side twin simulations (Uncontrolled vs Controlled)
and computes comparative performance metrics and trajectory datasets.
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from app.models.config import BioreactorConfig
from app.models.state import SimulationResponse, SimulationHistoryItem
from app.simulation.engine import SimulationEngine
from app.control.rule_based import RuleBasedController


class ScenarioComparisonItem(BaseModel):
    metric_name: str
    uncontrolled_val: float
    controlled_val: float
    unit: str
    improved: bool
    difference: float


class ScenarioComparisonResponse(BaseModel):
    config: Dict[str, Any]
    uncontrolled_scenario: SimulationResponse
    controlled_scenario: SimulationResponse
    comparison_table: List[ScenarioComparisonItem]
    total_media_consumed_uncontrolled_L: float
    total_media_consumed_controlled_L: float
    overall_outcome: str = Field(description="IMPROVED | NO_SIGNIFICANT_CHANGE | DEGRADED")
    outcome_summary: str = Field(description="Detailed narrative evaluation of the controlled strategy impact")


class ScenarioEngine:
    """Twin simulation engine for side-by-side strategy evaluation."""

    def __init__(self, config: Optional[BioreactorConfig] = None):
        self.config = config or BioreactorConfig()

    def _calculate_total_media_consumed(self, history: List[SimulationHistoryItem], reactor_volume_L: float, timestep_hrs: float) -> float:
        """Calculate cumulative total media consumed in Liters over the simulation."""
        total_liters = 0.0
        for item in history:
            D = item.perfusion_rate / 24.0
            step_liters = D * reactor_volume_L * timestep_hrs
            total_liters += step_liters
        return round(total_liters, 2)

    def _evaluate_overall_outcome(self, st_a: Any, st_b: Any, max_fouling_a: float, max_fouling_b: float) -> tuple[str, str]:
        """Compute an intelligent weighted evaluation comparing controlled vs uncontrolled performance."""
        density_diff = st_b.viable_cell_density - st_a.viable_cell_density
        viability_diff = st_b.cell_viability - st_a.cell_viability
        lactate_diff = st_b.metabolite_concentration - st_a.metabolite_concentration
        fouling_diff = max_fouling_b - max_fouling_a

        # Performance score calculation
        score = 0
        reasons = []

        if density_diff > 0.1e8:
            score += 2
            reasons.append(f"Cell density increased by +{(density_diff/1e8):.2f}×10⁸ cells/mL")
        elif density_diff < -0.1e8:
            score -= 2

        if viability_diff >= 3.0:
            score += 1
            reasons.append(f"Cell viability maintained +{viability_diff:.1f}% higher")
        elif viability_diff <= -3.0:
            score -= 1

        if lactate_diff <= -0.5:
            score += 1
            reasons.append(f"Toxic lactate reduced by {abs(lactate_diff):.2f} g/L")

        if fouling_diff <= -10.0:
            score += 1
            reasons.append(f"Membrane fouling risk reduced by {abs(fouling_diff):.1f} pts")

        if score >= 2:
            outcome = "IMPROVED"
            summary = "Adaptive controller successfully stabilized bioprocess state: " + ", ".join(reasons) + "."
        elif score <= -2:
            outcome = "DEGRADED"
            summary = "Controlled strategy resulted in sub-optimal operating conditions."
        else:
            outcome = "NO_SIGNIFICANT_CHANGE"
            summary = "Performance metrics between controlled and uncontrolled runs remain comparable under current operating bounds."

        return outcome, summary

    def run_comparison(
        self, config: Optional[BioreactorConfig] = None
    ) -> ScenarioComparisonResponse:
        cfg = config or self.config

        # 1. Scenario A — Uncontrolled (Fixed low perfusion rate baseline: 0.8 VVD)
        uncontrolled_cfg = cfg.model_copy(update={
            "control_enabled": False,
            "perfusion_rate": 0.8,
        })
        engine_a = SimulationEngine(uncontrolled_cfg)
        res_a = engine_a.run_full_simulation(uncontrolled_cfg, controller=None)

        # 2. Scenario B — Controlled (Adaptive Rule-Based Controller enabled)
        controlled_cfg = cfg.model_copy(update={
            "control_enabled": True,
            "perfusion_rate": 0.8,
        })
        engine_b = SimulationEngine(controlled_cfg)
        controller_b = RuleBasedController()
        res_b = engine_b.run_full_simulation(controlled_cfg, controller=controller_b)

        # Total media calculations
        media_a = self._calculate_total_media_consumed(res_a.history, cfg.reactor_volume, cfg.timestep)
        media_b = self._calculate_total_media_consumed(res_b.history, cfg.reactor_volume, cfg.timestep)

        st_a = res_a.current_state
        st_b = res_b.current_state

        max_fouling_a = res_a.summary_metrics["maximum_fouling_index"]
        max_fouling_b = res_b.summary_metrics["maximum_fouling_index"]

        overall_outcome, outcome_summary = self._evaluate_overall_outcome(st_a, st_b, max_fouling_a, max_fouling_b)

        table = [
            ScenarioComparisonItem(
                metric_name="Final Viable Cell Density",
                uncontrolled_val=round(st_a.viable_cell_density / 1e8, 3),
                controlled_val=round(st_b.viable_cell_density / 1e8, 3),
                unit="×10⁸ cells/mL",
                improved=st_b.viable_cell_density > st_a.viable_cell_density,
                difference=round((st_b.viable_cell_density - st_a.viable_cell_density) / 1e8, 3),
            ),
            ScenarioComparisonItem(
                metric_name="Final Cell Viability",
                uncontrolled_val=st_a.cell_viability,
                controlled_val=st_b.cell_viability,
                unit="%",
                improved=st_b.cell_viability >= st_a.cell_viability,
                difference=round(st_b.cell_viability - st_a.cell_viability, 2),
            ),
            ScenarioComparisonItem(
                metric_name="Final Glucose Concentration",
                uncontrolled_val=st_a.nutrient_concentration,
                controlled_val=st_b.nutrient_concentration,
                unit="g/L",
                improved=st_b.nutrient_concentration >= 1.0,
                difference=round(st_b.nutrient_concentration - st_a.nutrient_concentration, 2),
            ),
            ScenarioComparisonItem(
                metric_name="Final Lactate Concentration",
                uncontrolled_val=st_a.metabolite_concentration,
                controlled_val=st_b.metabolite_concentration,
                unit="g/L",
                improved=st_b.metabolite_concentration <= st_a.metabolite_concentration,
                difference=round(st_b.metabolite_concentration - st_a.metabolite_concentration, 2),
            ),
            ScenarioComparisonItem(
                metric_name="Maximum Fouling Risk Index",
                uncontrolled_val=max_fouling_a,
                controlled_val=max_fouling_b,
                unit="0–100",
                improved=max_fouling_b <= max_fouling_a,
                difference=round(max_fouling_b - max_fouling_a, 1),
            ),
            ScenarioComparisonItem(
                metric_name="Total Media Consumed",
                uncontrolled_val=media_a,
                controlled_val=media_b,
                unit="Liters",
                improved=st_b.viable_cell_density > st_a.viable_cell_density,
                difference=round(media_b - media_a, 2),
            ),
        ]

        return ScenarioComparisonResponse(
            config=cfg.model_dump(),
            uncontrolled_scenario=res_a,
            controlled_scenario=res_b,
            comparison_table=table,
            total_media_consumed_uncontrolled_L=media_a,
            total_media_consumed_controlled_L=media_b,
            overall_outcome=overall_outcome,
            outcome_summary=outcome_summary,
        )
