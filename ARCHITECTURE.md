# Architecture & Data Specification
## BB 04 — Digital Twin Bioreactor Control Platform

## 1. Executive System Architecture

The application implements a decoupled, event-driven web-based digital twin of a mammalian cell perfusion bioreactor.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React + Vite + TS)                  │
│  - Bioreactor Dashboard  - Real-time KPIs  - Recharts Visualizations      │
│  - Scenario Comparison   - Control Panel   - Interactive Flow Diagram   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ REST API (JSON)
┌────────────────────────────────────▼────────────────────────────────────┐
│                           FASTAPI BACKEND SERVICE                      │
│  - Input Validation (Pydantic)  - CORS & Security Boundary Layer        │
│  - Simulation Control API       - Scenario Comparison Router            │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Direct In-Memory Invocation
┌────────────────────────────────────▼────────────────────────────────────┐
│                           SIMULATION ENGINE                             │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────┐  │
│  │ Biological Growth     │  │ Nutrient & Metabolite │  │ Perfusion   │  │
│  │ Monod/Contois ODEs    │  │ Glucose / Lactate     │  │ Exchange    │  │
│  └───────────┬───────────┘  └───────────┬───────────┘  └──────┬──────┘  │
│              │                          │                     │         │
│              └──────────────────────────┼─────────────────────┘         │
│                                         ▼                               │
│                             ┌───────────────────────┐                   │
│                             │ Fouling Risk Index    │                   │
│                             │ 0–100 Normalized      │                   │
│                             └───────────┬───────────┘                   │
│                                         ▼                               │
│                             ┌───────────────────────┐                   │
│                             │ Automated Controller  │                   │
│                             │ Rule-based Adaptive   │                   │
│                             └───────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Model Data Specifications

### `BioreactorConfig`
- `reactor_volume`: Working liquid volume in Liters ($L$).
- `initial_cell_density`: Initial viable biomass concentration ($\text{cells/mL}$).
- `target_cell_density`: High-density goal ($\ge 1.0 \times 10^8 \text{ cells/mL}$).
- `max_growth_rate`: Maximum specific growth velocity $\mu_{max}$ ($\text{hr}^{-1}$).
- `death_rate_base`: Baseline cell mortality rate $k_d$ ($\text{hr}^{-1}$).
- `max_sustainable_density`: Biological carrying capacity $X_{max}$ ($\text{cells/mL}$).
- `initial_nutrient`: Initial glucose concentration ($g/L$).
- `feed_nutrient_concentration`: Fresh perfusion media glucose ($g/L$).
- `cell_nutrient_consumption_rate`: Specific glucose consumption $q_s$ ($g/\text{cell}/\text{hr}$).
- `monod_constant_nutrient`: Substrate half-saturation constant $K_s$ ($g/L$).
- `initial_metabolite`: Initial lactate concentration ($g/L$).
- `cell_metabolite_yield`: Specific lactate production $q_p$ ($g/\text{cell}/\text{hr}$).
- `metabolite_inhibition_constant`: Lactate 50% growth inhibition constant $K_i$ ($g/L$).
- `perfusion_rate`: Media exchange velocity in Vessel Volumes per Day ($\text{VVD}$).
- `min_perfusion_rate` & `max_max_perfusion_rate`: Adaptive control boundaries.
- `fouling_sensitivity` & `fouling_warning_threshold`: Filter clogging parameters.
- `simulation_duration` & `timestep`: Numerical integration limits.

### `BioreactorState`
- `simulation_time`: Time step marker ($hr$).
- `viable_cell_density` & `nonviable_cell_density`: Cell counts ($\text{cells/mL}$).
- `cell_viability`: Percentage viable ($0–100\%$).
- `nutrient_concentration` & `metabolite_concentration`: Chemical levels ($g/L$).
- `perfusion_rate`: Current VVD.
- `fouling_index`: Filter Clogging Risk ($0–100$).
- `fouling_state`: `LOW` ($0-30$), `MODERATE` ($31-70$), `HIGH` ($71-90$), `CRITICAL` ($91-100$).
- `target_achieved` & `time_to_target`: Target benchmark tracking.
- `latest_controller_action`: Audit log for controller decisions.

---

## 3. Scientific Integrity & Model Assumptions

1. **Simulation vs Experiment**: All output represents mathematical numerical integration of biological kinetics (Monod substrate limitation + non-competitive metabolite inhibition + normalized membrane load fouling proxy).
2. **Assumption Labelling**: Model equations use literature-inspired standard parameters for CHO (Chinese Hamster Ovary) mammalian cell lines, labeled internally as `Model Assumption`.
3. **Physical Constraints**: Integrators enforce strictly non-negative cell densities ($X_v \ge 0$), non-negative nutrient levels ($S \ge 0$), bounded viability ($0 \le V \le 100\%$), and bounded fouling ($0 \le F \le 100$).

---

## 4. API Endpoints

- `GET /health` — Service readiness & target density goal verification.
- `POST /simulation/start` — Initializes a new virtual bioreactor state with valid config.
- `POST /simulation/step` — Executes one numerical integration timestep $dt$.
- `POST /simulation/run` — Executes a complete simulation trajectory from $t=0$ to $t=T_{max}$.
- `GET /simulation/state` — Retrieves the current active digital twin state.
- `POST /simulation/control` — Toggles controller mode and updates thresholds.
- `POST /simulation/scenario` — Runs twin simulations (Uncontrolled vs Controlled) for side-by-side comparison.
- `POST /simulation/fault` — Injects process disturbances (e.g. nutrient feed drop, mortality surge).

---

## 5. Security & Validation Rules

1. **Input Bounds**: All numerical fields are validated via Pydantic (`gt`, `ge`, `le`).
2. **Resource Exhaustion Guard**: `simulation_duration` $\le 720\text{ hours}$ and `timestep` $\ge 0.05\text{ hours}$ to restrict step iteration count to a maximum of $14,400$ steps per call.
3. **No Dynamic Execution**: Simulation math uses compiled Python/NumPy logic; no `eval()` or dynamic string execution.
