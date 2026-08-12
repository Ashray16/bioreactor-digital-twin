"""Numerical ODE Integration & Digital Twin Simulation Engine.

Executes step-by-step and full-run bioprocess simulation trajectories
using 4th-Order Runge-Kutta (RK4) integration with strict physical constraint enforcement.
"""
from typing import Optional, List, Dict, Any
from app.models.config import BioreactorConfig
from app.models.state import (
    BioreactorState,
    ControllerActionInfo,
    SimulationHistoryItem,
    SimulationResponse,
)
from app.simulation.cell_growth import calculate_cell_density_derivatives
from app.simulation.nutrients import calculate_nutrient_derivative
from app.simulation.metabolites import calculate_metabolite_derivative
from app.simulation.fouling import calculate_fouling_index


class SimulationEngine:
    """Core stateful digital twin simulation engine."""

    def __init__(self, config: Optional[BioreactorConfig] = None):
        self.config = config or BioreactorConfig()
        self.current_state = self._initialize_state()
        self.history: List[SimulationHistoryItem] = []
        self._record_history()

    def _initialize_state(self) -> BioreactorState:
        total = self.config.initial_cell_density
        viable = total * (self.config.initial_viability / 100.0)
        nonviable = total - viable

        fouling_idx, fouling_st = calculate_fouling_index(
            viable_cells=viable,
            total_cells=total,
            perfusion_rate_vvd=self.config.perfusion_rate,
            simulation_time_hours=0.0,
            config=self.config,
        )

        return BioreactorState(
            simulation_time=0.0,
            viable_cell_density=viable,
            nonviable_cell_density=nonviable,
            cell_viability=self.config.initial_viability,
            total_cell_density=total,
            nutrient_concentration=self.config.initial_nutrient,
            metabolite_concentration=self.config.initial_metabolite,
            reactor_volume=self.config.reactor_volume,
            perfusion_rate=self.config.perfusion_rate,
            fouling_index=fouling_idx,
            fouling_state=fouling_st,
            target_cell_density=self.config.target_cell_density,
            target_achieved=viable >= self.config.target_cell_density,
            time_to_target=0.0 if viable >= self.config.target_cell_density else None,
            controller_enabled=self.config.control_enabled,
            latest_controller_action=None,
            active_fault=None,
        )

    def reset(self, config: Optional[BioreactorConfig] = None) -> BioreactorState:
        """Reset simulation engine state back to t=0."""
        if config is not None:
            self.config = config
        self.current_state = self._initialize_state()
        self.history = []
        self._record_history()
        return self.current_state

    def _record_history(self):
        self.history.append(
            SimulationHistoryItem(
                time=round(self.current_state.simulation_time, 2),
                viable_cell_density=round(self.current_state.viable_cell_density, 2),
                nonviable_cell_density=round(self.current_state.nonviable_cell_density, 2),
                cell_viability=round(self.current_state.cell_viability, 2),
                nutrient_concentration=round(self.current_state.nutrient_concentration, 3),
                metabolite_concentration=round(self.current_state.metabolite_concentration, 3),
                perfusion_rate=round(self.current_state.perfusion_rate, 2),
                fouling_index=round(self.current_state.fouling_index, 1),
                controller_enabled=self.current_state.controller_enabled,
                active_fault=self.current_state.active_fault,
            )
        )

    def _compute_derivatives(
        self, Xv: float, Xd: float, S: float, P: float, perfusion: float
    ) -> tuple[float, float, float, float]:
        """Compute state derivatives (dXv/dt, dXd/dt, dS/dt, dP/dt)."""
        dXv, dXd = calculate_cell_density_derivatives(
            viable_cells=Xv,
            nonviable_cells=Xd,
            nutrient=S,
            metabolite=P,
            perfusion_rate_vvd=perfusion,
            config=self.config,
        )
        dS = calculate_nutrient_derivative(
            nutrient=S,
            viable_cells=Xv,
            perfusion_rate_vvd=perfusion,
            config=self.config,
        )
        dP = calculate_metabolite_derivative(
            metabolite=P,
            viable_cells=Xv,
            perfusion_rate_vvd=perfusion,
            config=self.config,
        )
        return dXv, dXd, dS, dP

    def step(
        self,
        dt: Optional[float] = None,
        controller: Optional[Any] = None,
        active_fault: Optional[str] = None,
    ) -> BioreactorState:
        """Advance simulation state by one timestep dt using 4th-Order Runge-Kutta (RK4)."""
        h = dt if dt is not None else self.config.timestep
        state = self.current_state
        perfusion = state.perfusion_rate

        # 1. Controller intervention if active
        if controller and (state.controller_enabled or self.config.control_enabled):
            action_info = controller.evaluate_and_control(state, self.config)
            if action_info:
                perfusion = action_info.current_perfusion
                state.latest_controller_action = action_info

        # 2. RK4 ODE Integration
        Xv0, Xd0, S0, P0 = (
            state.viable_cell_density,
            state.nonviable_cell_density,
            state.nutrient_concentration,
            state.metabolite_concentration,
        )

        # k1
        k1_Xv, k1_Xd, k1_S, k1_P = self._compute_derivatives(Xv0, Xd0, S0, P0, perfusion)

        # k2
        k2_Xv, k2_Xd, k2_S, k2_P = self._compute_derivatives(
            max(0.0, Xv0 + 0.5 * h * k1_Xv),
            max(0.0, Xd0 + 0.5 * h * k1_Xd),
            max(0.0, S0 + 0.5 * h * k1_S),
            max(0.0, P0 + 0.5 * h * k1_P),
            perfusion,
        )

        # k3
        k3_Xv, k3_Xd, k3_S, k3_P = self._compute_derivatives(
            max(0.0, Xv0 + 0.5 * h * k2_Xv),
            max(0.0, Xd0 + 0.5 * h * k2_Xd),
            max(0.0, S0 + 0.5 * h * k2_S),
            max(0.0, P0 + 0.5 * h * k2_P),
            perfusion,
        )

        # k4
        k4_Xv, k4_Xd, k4_S, k4_P = self._compute_derivatives(
            max(0.0, Xv0 + h * k3_Xv),
            max(0.0, Xd0 + h * k3_Xd),
            max(0.0, S0 + h * k3_S),
            max(0.0, P0 + h * k3_P),
            perfusion,
        )

        # Updated states
        new_Xv = max(0.0, Xv0 + (h / 6.0) * (k1_Xv + 2 * k2_Xv + 2 * k3_Xv + k4_Xv))
        new_Xd = max(0.0, Xd0 + (h / 6.0) * (k1_Xd + 2 * k2_Xd + 2 * k3_Xd + k4_Xd))
        new_S = max(0.0, S0 + (h / 6.0) * (k1_S + 2 * k2_S + 2 * k3_S + k4_S))
        new_P = max(0.0, P0 + (h / 6.0) * (k1_P + 2 * k2_P + 2 * k3_P + k4_P))

        total_cells = new_Xv + new_Xd
        viability = (new_Xv / total_cells * 100.0) if total_cells > 0 else 0.0
        new_time = state.simulation_time + h

        # 3. Compute Fouling Risk Index
        fouling_idx, fouling_st = calculate_fouling_index(
            viable_cells=new_Xv,
            total_cells=total_cells,
            perfusion_rate_vvd=perfusion,
            simulation_time_hours=new_time,
            config=self.config,
        )

        # 4. Check Target Achievement Goal (>10^8 cells/mL)
        target_reached = new_Xv >= self.config.target_cell_density
        time_to_target = state.time_to_target
        if target_reached and time_to_target is None:
            time_to_target = new_time

        # Update current state object
        self.current_state = BioreactorState(
            simulation_time=new_time,
            viable_cell_density=new_Xv,
            nonviable_cell_density=new_Xd,
            cell_viability=round(viability, 2),
            total_cell_density=total_cells,
            nutrient_concentration=new_S,
            metabolite_concentration=new_P,
            reactor_volume=self.config.reactor_volume,
            perfusion_rate=perfusion,
            fouling_index=fouling_idx,
            fouling_state=fouling_st,
            target_cell_density=self.config.target_cell_density,
            target_achieved=target_reached,
            time_to_target=time_to_target,
            controller_enabled=state.controller_enabled or self.config.control_enabled,
            latest_controller_action=state.latest_controller_action,
            active_fault=active_fault,
        )

        self._record_history()
        return self.current_state

    def run_full_simulation(
        self,
        config: Optional[BioreactorConfig] = None,
        controller: Optional[Any] = None,
        fault: Optional[Any] = None,
    ) -> SimulationResponse:
        """Execute complete simulation trajectory from t=0 to t=simulation_duration."""
        self.reset(config)
        steps = int(self.config.simulation_duration / self.config.timestep)

        for i in range(steps):
            active_fault_name = None
            if fault:
                active_fault_name = fault.apply_fault(self)
            self.step(controller=controller, active_fault=active_fault_name)

        final_st = self.current_state
        max_fouling = max(h.fouling_index for h in self.history) if self.history else 0.0
        min_nutrient = min(h.nutrient_concentration for h in self.history) if self.history else 0.0
        max_metabolite = max(h.metabolite_concentration for h in self.history) if self.history else 0.0

        summary = {
            "final_viable_cell_density": final_st.viable_cell_density,
            "final_cell_viability": final_st.cell_viability,
            "final_nutrient_concentration": final_st.nutrient_concentration,
            "final_metabolite_concentration": final_st.metabolite_concentration,
            "maximum_fouling_index": max_fouling,
            "final_fouling_index": final_st.fouling_index,
            "final_perfusion_rate": final_st.perfusion_rate,
            "target_achieved": final_st.target_achieved,
            "time_to_target": final_st.time_to_target,
            "total_simulated_hours": final_st.simulation_time,
        }

        return SimulationResponse(
            config=self.config.model_dump(),
            current_state=final_st,
            history=self.history,
            summary_metrics=summary,
        )
