"""Rule-Based Adaptive Perfusion Controller Engine.

Monitors digital twin bioreactor state and makes adaptive operational decisions
to maintain cell density while managing metabolite toxicity and filter fouling risk.
"""
from typing import Optional
from app.models.config import BioreactorConfig
from app.models.state import BioreactorState, ControllerActionInfo


class RuleBasedController:
    """Adaptive rule-based bioprocess controller."""

    def __init__(
        self,
        nutrient_threshold_low: float = 1.5,
        metabolite_threshold_high: float = 3.5,
        fouling_threshold_high: float = 70.0,
        step_increment_vvd: float = 0.3,
        step_decrement_vvd: float = 0.2,
        deadband_hours: float = 1.0,
    ):
        self.nutrient_threshold_low = nutrient_threshold_low
        self.metabolite_threshold_high = metabolite_threshold_high
        self.fouling_threshold_high = fouling_threshold_high
        self.step_increment_vvd = step_increment_vvd
        self.step_decrement_vvd = step_decrement_vvd
        self.deadband_hours = deadband_hours
        self.last_action_time: float = -999.0

    def evaluate_and_control(
        self, state: BioreactorState, config: BioreactorConfig
    ) -> Optional[ControllerActionInfo]:
        """Evaluate digital twin state and issue control action if thresholds are breached."""
        # 1. Check deadband timing to prevent high-frequency jitter/oscillation
        if (state.simulation_time - self.last_action_time) < self.deadband_hours:
            return None

        current_perfusion = state.perfusion_rate
        target_perfusion = current_perfusion
        action_type = "NO_ACTION"
        reason = ""

        # Priority 1: High Fouling Risk Management (Safety Critical)
        if state.fouling_index >= self.fouling_threshold_high:
            if current_perfusion > config.min_perfusion_rate:
                target_perfusion = max(
                    config.min_perfusion_rate,
                    current_perfusion - self.step_decrement_vvd,
                )
                action_type = "REDUCE_PERFUSION"
                reason = f"High fouling risk index ({state.fouling_index:.1f}/100 >= {self.fouling_threshold_high:.1f}). Throttling perfusion rate to manage membrane load."

        # Priority 2: Low Nutrient Replenishment
        elif state.nutrient_concentration < self.nutrient_threshold_low:
            if current_perfusion < config.max_perfusion_rate:
                target_perfusion = min(
                    config.max_perfusion_rate,
                    current_perfusion + self.step_increment_vvd,
                )
                action_type = "INCREASE_PERFUSION"
                reason = f"Low glucose concentration ({state.nutrient_concentration:.2f} g/L < {self.nutrient_threshold_low:.2f} g/L). Increasing perfusion rate to restore substrate feed."

        # Priority 3: High Metabolite Clearance
        elif state.metabolite_concentration > self.metabolite_threshold_high:
            if current_perfusion < config.max_perfusion_rate:
                target_perfusion = min(
                    config.max_perfusion_rate,
                    current_perfusion + self.step_increment_vvd,
                )
                action_type = "INCREASE_PERFUSION"
                reason = f"High lactate accumulation ({state.metabolite_concentration:.2f} g/L > {self.metabolite_threshold_high:.2f} g/L). Increasing perfusion rate to enhance metabolite washout."

        # Priority 4: Target High Cell Density Stabilization (>10^8 cells/mL)
        elif state.viable_cell_density >= config.target_cell_density:
            desired_vvd = 2.0  # Optimal high-density steady-state perfusion
            if abs(current_perfusion - desired_vvd) > 0.1:
                target_perfusion = desired_vvd
                action_type = "STABILIZE_PERFUSION"
                reason = f"Target cell density reached ({state.viable_cell_density/1e8:.2f} × 10⁸ cells/mL >= 1.00 × 10⁸ cells/mL). Stabilizing perfusion rate at {desired_vvd:.1f} VVD for steady state."

        # Clamp target perfusion within config safe bounds
        target_perfusion = max(
            config.min_perfusion_rate, min(config.max_perfusion_rate, target_perfusion)
        )

        # If a control action occurred and changed perfusion rate
        if action_type != "NO_ACTION" and abs(target_perfusion - current_perfusion) > 0.01:
            self.last_action_time = state.simulation_time
            return ControllerActionInfo(
                timestamp=round(state.simulation_time, 2),
                action_type=action_type,
                reason=reason,
                previous_perfusion=round(current_perfusion, 2),
                current_perfusion=round(target_perfusion, 2),
            )

        return None
