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
    overall_outcome: str = Field(description="IMPROVED | TRADE-OFF | NO_SIGNIFICANT_CHANGE | DEGRADED")
    outcome_summary: str = Field(description="Detailed narrative evaluation of the controlled strategy impact")
    divergence_cause: Optional[str] = Field(None, description="Controller action or trigger condition that caused trajectory divergence")


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

    def _evaluate_overall_outcome(
        self,
        st_a: Any,
        st_b: Any,
        max_fouling_a: float,
        max_fouling_b: float,
        media_a: float,
        media_b: float,
        divergence_cause: Optional[str] = None
    ) -> tuple[str, str]:
        """Compute an intelligent evaluation supporting explicit TRADE-OFF classification."""
        density_diff = st_b.viable_cell_density - st_a.viable_cell_density
        viability_diff = st_b.cell_viability - st_a.cell_viability
        lactate_diff = st_b.metabolite_concentration - st_a.metabolite_concentration
        fouling_diff = max_fouling_b - max_fouling_a
        media_diff = media_b - media_a

        reasons = []

        # Check explicit Trade-Off condition: Any key metric improves (e.g. fouling reduced, VCC increased) while another worsens (e.g. media increased, viability drops)
        is_improved_any = (density_diff > 0.5e6) or (viability_diff >= 1.5) or (lactate_diff <= -0.3) or (fouling_diff <= -5.0)
        is_worsened_any = (media_diff > 0.2 and media_diff > 0.05 * max(0.1, media_a)) or (density_diff < -0.5e6) or (viability_diff <= -2.0)

        if is_improved_any and is_worsened_any:
            outcome = "TRADE-OFF"
            trade_details = []
            if fouling_diff <= -5.0:
                trade_details.append(f"membrane fouling risk reduced ({abs(fouling_diff):.1f} pts)")
            if density_diff > 0.5e6:
                trade_details.append(f"higher cell density (+{(density_diff/1e6):.2f}M cells/mL)")
            if media_diff > 0.05:
                trade_details.append(f"increased media consumption (+{media_diff:.2f} L)")

            summary = f"Multi-objective trade-off: Controller achieved {' and '.join(trade_details)}."
            if divergence_cause:
                summary += f" Trajectory divergence caused by: {divergence_cause}."
            return outcome, summary

        # Score calculation
        score = 0
        if density_diff > 0.5e6:
            score += 2
            reasons.append(f"Cell density increased by +{(density_diff/1e6):.2f}M cells/mL")
        elif density_diff < -0.5e6:
            score -= 2

        if viability_diff >= 2.0:
            score += 1
            reasons.append(f"Cell viability maintained +{viability_diff:.1f}% higher")
        elif viability_diff <= -2.0:
            score -= 1

        if lactate_diff <= -0.3:
            score += 1
            reasons.append(f"Toxic lactate reduced by {abs(lactate_diff):.2f} g/L")

        if fouling_diff <= -8.0:
            score += 1
            reasons.append(f"Membrane fouling risk reduced by {abs(fouling_diff):.1f} pts")

        if score >= 2:
            outcome = "IMPROVED"
            summary = "Adaptive controller successfully stabilized bioprocess state: " + ", ".join(reasons) + "."
        elif score <= -2:
            outcome = "DEGRADED"
            summary = "Controlled strategy resulted in sub-optimal operating conditions under aggressive parameters."
        else:
            outcome = "NO_SIGNIFICANT_CHANGE"
            summary = "Performance metrics between controlled and uncontrolled runs remain comparable under current operating bounds."

        if divergence_cause and outcome != "NO_SIGNIFICANT_CHANGE":
            summary += f" Divergence trigger: {divergence_cause}."

        return outcome, summary

    def run_comparison(
        self,
        config: Optional[BioreactorConfig] = None,
        fault: Optional[Any] = None,
    ) -> ScenarioComparisonResponse:
        cfg = config or self.config

        # 1. Scenario A — Uncontrolled (Fixed baseline perfusion rate)
        uncontrolled_cfg = cfg.model_copy(update={
            "control_enabled": False,
            "perfusion_rate": cfg.perfusion_rate,
        })
        engine_a = SimulationEngine(uncontrolled_cfg)
        from app.simulation.faults import FaultManager
        fault_mgr_a = FaultManager(fault.config.model_copy()) if fault and getattr(fault, 'config', None) else None
        res_a = engine_a.run_full_simulation(uncontrolled_cfg, controller=None, fault=fault_mgr_a)

        # 2. Scenario B — Controlled (Adaptive Rule-Based Controller enabled)
        controlled_cfg = cfg.model_copy(update={
            "control_enabled": True,
            "perfusion_rate": cfg.perfusion_rate,
        })
        engine_b = SimulationEngine(controlled_cfg)
        controller_b = RuleBasedController(
            nutrient_threshold_low=controlled_cfg.nutrient_threshold_low,
            metabolite_threshold_high=controlled_cfg.metabolite_threshold_high,
            fouling_threshold_high=controlled_cfg.fouling_threshold_high,
            step_increment_vvd=controlled_cfg.step_increment_vvd,
        )
        fault_mgr_b = FaultManager(fault.config.model_copy()) if fault and getattr(fault, 'config', None) else None
        res_b = engine_b.run_full_simulation(controlled_cfg, controller=controller_b, fault=fault_mgr_b)



        # Total media calculations
        media_a = self._calculate_total_media_consumed(res_a.history, cfg.reactor_volume, cfg.timestep)
        media_b = self._calculate_total_media_consumed(res_b.history, cfg.reactor_volume, cfg.timestep)

        st_a = res_a.current_state
        st_b = res_b.current_state

        max_fouling_a = res_a.summary_metrics["maximum_fouling_index"]
        max_fouling_b = res_b.summary_metrics["maximum_fouling_index"]

        # Identify controller divergence cause
        divergence_cause = None
        for item in res_b.history:
            # Look for history items where controller took an action
            if res_b.current_state.latest_controller_action:
                divergence_cause = res_b.current_state.latest_controller_action.reason
                break

        overall_outcome, outcome_summary = self._evaluate_overall_outcome(
            st_a, st_b, max_fouling_a, max_fouling_b, media_a, media_b, divergence_cause
        )

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
                metric_name="Final Product Titer",
                uncontrolled_val=round(st_a.product_concentration, 2),
                controlled_val=round(st_b.product_concentration, 2),
                unit="g/L",
                improved=st_b.product_concentration >= st_a.product_concentration,
                difference=round(st_b.product_concentration - st_a.product_concentration, 2),
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
                improved=(media_b - media_a) < -0.05,
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
            divergence_cause=divergence_cause,
        )
