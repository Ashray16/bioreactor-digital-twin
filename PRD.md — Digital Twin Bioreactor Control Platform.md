# Product Requirements Document
## BB 04 — Digital Twin of a Bioreactor

**Project Type:** Intra-Department Hackathon (IDH 2026)  
**Problem Statement:** BB 04  
**Domain:** BioE3 & Biomanufacturing  
**Primary Focus:** Digital Twin + Bioprocess Simulation + Automated Control  
**Document Version:** 1.0

---

## 1. Problem Statement

Design a **digital twin simulation or automated perfusion bioreactor control loop** capable of maintaining high mammalian cell density, with the stated target of **>10⁸ cells/mL**, while reducing or preventing filter clogging.

The official problem statement specifically calls for maintaining high mammalian cell density in a perfusion bioreactor without filter clogging.

The proposed solution will be a software-based digital twin that models the major biological and engineering variables of a perfusion bioreactor and provides predictive monitoring and control recommendations.

---

## 2. Product Vision

Create an interactive **Digital Twin of a Mammalian Cell Perfusion Bioreactor** that allows users to:

1. Configure a virtual bioreactor.
2. Simulate mammalian cell growth.
3. Model nutrient consumption and metabolite accumulation.
4. Model perfusion and media exchange.
5. Monitor viable cell density.
6. Predict conditions associated with filter fouling/clogging.
7. Automatically adjust operating parameters.
8. Compare controlled and uncontrolled operation.
9. Visualize the complete process through a real-time dashboard.

The system should demonstrate that computational control can maintain high cell density while keeping the filtration system within an acceptable operating range.

---

## 3. Hackathon Objective

The objective is **not to build a physical industrial bioreactor**.

The hackathon prototype should demonstrate a credible digital representation of the process and show how a control system can respond to changing bioreactor conditions.

The MVP should be capable of running a simulated bioreactor continuously and displaying the effect of control decisions.

---

## 4. Target Users

### Primary User
Bioprocess engineering student/researcher who wants to simulate and understand perfusion bioreactor operation.

### Secondary Users
- Bioprocess engineers
- Biotechnology researchers
- Biomanufacturing companies
- Academic laboratories
- Students learning bioreactor control

---

## 5. Core Product Concept

The system consists of five major layers:

```text
                 DIGITAL TWIN
                     │
        ┌────────────┴────────────┐
        │                         │
  Biological Model          Engineering Model
        │                         │
 Cell growth              Perfusion / filtration
 Nutrient consumption     Flow / pressure
 Metabolites              Fouling tendency
        │                         │
        └────────────┬────────────┘
                     │
               STATE ESTIMATION
                     │
              CONTROL ALGORITHM
                     │
          ┌──────────┴──────────┐
          │                     │
   Feed/perfusion rate     Control strategy
          │                     │
          └──────────┬──────────┘
                     │
                 SIMULATION
                     │
                 DASHBOARD
```

---

# 6. Functional Requirements

## FR-01 — Bioreactor Configuration

The application shall allow users to configure:

- Initial viable cell density
- Maximum/target cell density
- Working volume
- Initial nutrient concentration
- Perfusion rate
- Feed concentration
- Oxygen availability parameter
- Temperature
- pH
- Filter capacity/fouling parameter
- Simulation duration
- Control mode

The application shall provide sensible default values so the simulation can be started immediately.

---

## FR-02 — Cell Growth Model

The digital twin shall simulate mammalian cell growth over time.

The model should account for:

- Initial cell density
- Growth rate
- Nutrient availability
- Cell death
- Maximum sustainable cell density

The model should produce:

- Viable cell density
- Non-viable cell density
- Growth rate
- Total cell population

The architecture must allow the growth model to be replaced or improved later without rewriting the dashboard.

---

## FR-03 — Nutrient and Metabolite Model

The simulation shall model the relationship between:

```text
Cell density
      ↓
Nutrient consumption
      ↓
Metabolite production
      ↓
Cell growth / viability
```

At minimum, the model should include one limiting nutrient and one inhibitory metabolite.

Examples:

- Glucose
- Lactate

The system should visualize their concentration over time.

---

## FR-04 — Perfusion Model

The digital twin shall simulate continuous media exchange.

Variables include:

- Perfusion rate
- Reactor volume
- Media inflow
- Waste/outflow
- Nutrient replenishment
- Metabolite removal

The user shall be able to change the perfusion rate during simulation.

---

## FR-05 — Filtration/Fouling Model

The system shall include a simplified representation of filter fouling.

The purpose is not to claim an experimentally validated industrial fouling model.

Instead, the MVP should create a **computational fouling-risk index** based on relevant simulated variables such as:

- Cell density
- Biomass concentration
- Filtration load
- Flow/perfusion rate
- Operating duration

The output should be represented as:

```text
Fouling Risk
0 ─────────────── 100
Low     Medium     High
```

The model should trigger a warning when the simulated filter approaches an unsafe operating region.

---

## FR-06 — Digital Twin State

The application shall maintain a virtual state of the bioreactor containing:

- Cell density
- Viability
- Nutrient concentration
- Metabolite concentration
- Reactor volume
- Perfusion rate
- Filter/fouling state
- Operating conditions
- Current simulation time

The state shall update continuously as the simulation progresses.

---

## FR-07 — Control System

The system shall include an automated controller.

The controller shall monitor the digital twin and modify selected process parameters.

Primary control variable:

**Perfusion rate**

Possible control strategies:

- Rule-based control for MVP
- PID control
- Model Predictive Control as an advanced feature

Example:

```text
IF nutrient concentration is low
    increase perfusion

IF metabolite concentration is high
    increase perfusion

IF fouling risk is high
    reduce/adjust operating load

IF cell density approaches target
    stabilize perfusion
```

---

## FR-08 — Target Cell Density

The system shall display progress toward the problem-statement target:

**>10⁸ cells/mL**

The dashboard shall clearly indicate:

- Current cell density
- Target cell density
- Percentage of target achieved
- Time required to reach target

---

## FR-09 — Scenario Comparison

The user shall be able to compare at least two operating strategies:

### Scenario A — Uncontrolled

Fixed operating conditions.

### Scenario B — Controlled

Automated controller adjusts operating conditions.

The application shall compare:

- Final cell density
- Cell viability
- Nutrient levels
- Metabolite accumulation
- Fouling risk
- Perfusion usage
- Time to target

This comparison is a core part of the hackathon demonstration.

---

## FR-10 — Dashboard

The dashboard shall contain:

### Main KPIs
- Viable Cell Density
- Cell Viability
- Nutrient Concentration
- Metabolite Concentration
- Perfusion Rate
- Fouling Risk
- Target Achievement

### Charts
- Cell density vs time
- Viability vs time
- Nutrient vs time
- Metabolite vs time
- Perfusion rate vs time
- Fouling risk vs time

### System Status

```text
BIOREACTOR STATUS: RUNNING

Cell Density:       1.02 × 10⁸ cells/mL
Viability:          94%
Perfusion:          1.8 VVD
Fouling Risk:       LOW
Controller:         ACTIVE
Target:             ACHIEVED
```

---

# 7. Advanced Features

These are optional and should only be implemented after the MVP is stable.

## AF-01 — PID Controller

Implement PID control for maintaining a selected process variable.

## AF-02 — Model Predictive Control

Use the digital twin to predict future states and select the best control action.

## AF-03 — Fault Injection

Allow the user to introduce simulated problems:

- Reduced nutrient feed
- Increased cell death
- Increased fouling
- Pump failure
- Sudden increase in metabolite concentration

The controller should respond to the fault.

## AF-04 — What-if Analysis

Allow users to ask:

- What happens if perfusion is increased?
- What happens if growth rate decreases?
- What happens if the filter begins fouling?
- What happens if nutrient concentration decreases?

## AF-05 — Optimization

Find operating conditions that maximize:

- Cell density
- Viability
- Productivity

while minimizing:

- Fouling risk
- Media consumption
- Operating cost

---

# 8. Non-Functional Requirements

## Performance

- Dashboard should update smoothly.
- Simulation should run faster than real time.
- A complete simulated process should be executable within seconds.

## Usability

- No specialist programming knowledge should be required.
- Default parameters should allow one-click simulation.
- Graphs should be understandable without inspecting source code.

## Reliability

- Invalid parameter values should be rejected.
- Simulation failures should produce understandable error messages.
- The system should prevent impossible parameter combinations.

## Modularity

The following components should remain independent:

```text
Biological Model
Engineering Model
Fouling Model
Controller
Simulation Engine
API
Dashboard
```

---

# 9. Proposed Technical Architecture

## Frontend

Recommended:

- React
- Vite
- TypeScript
- Tailwind CSS
- Recharts or Plotly

## Backend

Recommended:

- Python
- FastAPI
- NumPy
- SciPy
- Pydantic

## Simulation

The simulation engine should be implemented independently from the API.

```text
simulation/
├── cell_model.py
├── nutrient_model.py
├── metabolite_model.py
├── perfusion_model.py
├── fouling_model.py
├── controller.py
└── simulation_engine.py
```

## Data Flow

```text
User Configuration
        ↓
Frontend
        ↓
FastAPI
        ↓
Simulation Engine
        ↓
Biological + Engineering Models
        ↓
Controller
        ↓
Updated State
        ↓
API
        ↓
Dashboard
```

---

# 10. API Requirements

### POST `/simulation/start`

Starts a simulation using supplied parameters.

### POST `/simulation/step`

Advances the simulation by one time step.

### POST `/simulation/run`

Runs a complete simulation.

### GET `/simulation/state`

Returns the current digital twin state.

### POST `/simulation/control`

Changes controller settings.

### POST `/simulation/scenario`

Runs a scenario comparison.

### POST `/simulation/fault`

Injects a simulated fault.

---

# 11. Data Model

```text
BioreactorConfig
├── volume
├── initial_cell_density
├── target_cell_density
├── growth_rate
├── initial_nutrient
├── initial_metabolite
├── perfusion_rate
├── temperature
├── pH
└── simulation_duration

BioreactorState
├── time
├── viable_cell_density
├── nonviable_cell_density
├── viability
├── nutrient_concentration
├── metabolite_concentration
├── perfusion_rate
├── fouling_index
├── productivity
└── controller_action
```

---

# 12. MVP Definition

The minimum viable product must contain:

- [ ] Bioreactor configuration
- [ ] Mammalian cell growth simulation
- [ ] Nutrient consumption model
- [ ] Metabolite accumulation model
- [ ] Perfusion model
- [ ] Simplified fouling-risk model
- [ ] Automated rule-based controller
- [ ] Target cell-density tracking
- [ ] Real-time dashboard
- [ ] At least five process graphs
- [ ] Controlled vs uncontrolled comparison

The MVP must be capable of producing a complete demonstration without requiring physical laboratory equipment.

---

# 13. Hackathon Demonstration

The primary demonstration should follow this sequence:

### Step 1
Start with a low initial cell density.

### Step 2
Run the uncontrolled system.

Show:

- Cell growth
- Nutrient depletion
- Metabolite accumulation
- Increasing fouling risk

### Step 3
Reset the simulation.

### Step 4
Enable the automated controller.

### Step 5
Run the controlled system.

Show:

- Adaptive perfusion
- Better nutrient availability
- Controlled metabolite accumulation
- Lower fouling risk
- High cell density

### Step 6
Introduce a simulated fault.

For example:

```text
Nutrient feed reduction
```

The controller should detect the changing state and adjust the process.

### Step 7
Show final comparison.

```text
                    UNCONTROLLED     CONTROLLED

Cell Density        Lower            Higher
Viability           Lower            Higher
Fouling Risk        Higher           Lower
Perfusion           Fixed            Adaptive
Target Achievement  No/Slow          Yes/Faster
```

---

# 14. Success Metrics

The project will be considered successful if the prototype can demonstrate:

1. A functioning digital representation of a perfusion bioreactor.
2. Dynamic changes in cell density.
3. Dynamic nutrient/metabolite behavior.
4. Dynamic perfusion.
5. A measurable fouling-risk index.
6. Automated process intervention.
7. Achievement or approach toward the >10⁸ cells/mL target within the simulated environment.
8. A measurable improvement between uncontrolled and controlled scenarios.
9. A functional visual dashboard.
10. A clear explanation of how the digital twin could eventually support real bioprocess operations.

---

# 15. Scientific Validation Strategy

The hackathon prototype shall clearly distinguish between:

### Demonstrated by the prototype

- Mathematical simulation
- Dynamic process behavior
- Control logic
- Scenario comparison
- Fouling-risk prediction
- Dashboard visualization

### Proposed future validation

- Calibration using real bioreactor datasets
- Experimental mammalian-cell culture
- Real filtration/fouling experiments
- Controller validation on physical equipment
- Comparison against industrial process data

The project must not present simulated results as experimentally validated biological results.

---

# 16. Future Development

Future versions could incorporate:

- Real bioreactor sensor data
- Historical production datasets
- Machine-learning state estimation
- Model Predictive Control
- Digital-twin calibration
- Cloud deployment
- Multi-reactor monitoring
- Predictive maintenance
- Automated process optimization
- Integration with laboratory/industrial control systems

---

# 17. Key Differentiator

The project should not be presented as merely a "bioreactor simulator."

The central innovation is:

> **A digital twin that understands the simulated biological and engineering state of a high-density perfusion bioreactor and uses that state to make adaptive operating decisions.**

The key story is:

**Predict → Detect → Control → Optimize**

---

# 18. Risks

| Risk | Mitigation |
|---|---|
| Biological model is too complex | Start with a simplified mechanistic model |
| Fouling model lacks experimental data | Clearly define it as a simulated risk index |
| Controller is unstable | Begin with rule-based control |
| Scope becomes too large | Prioritize MVP |
| Simulation does not produce meaningful behavior | Validate individual models before integration |
| Dashboard consumes development time | Build functional charts before visual polish |

---

# 19. Out of Scope for MVP

The MVP will not include:

- Physical bioreactor construction
- Real mammalian cell culture
- Industrial PLC integration
- Real-time hardware control
- Experimentally validated filter-fouling kinetics
- Clinical/industrial deployment
- Full-scale CFD simulation
- Full industrial process digitalization

---

# 20. Final Product Definition

The final hackathon product will be a **web-based digital twin platform for high-density mammalian perfusion bioreactors**.

It will simulate the biological and engineering state of the process, identify changes in operating conditions, estimate fouling risk, and automatically adjust perfusion using a control strategy.

The final demonstration will show that an intelligent digital twin can be used to explore how high-cell-density operation can be maintained while managing filtration-related risks.