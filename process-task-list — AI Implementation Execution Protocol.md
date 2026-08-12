# Process Task List
## BB 04 — Digital Twin of a Bioreactor

This document controls how the AI executes the implementation tasks defined in `TODO.md`.

The AI must **not attempt to implement the entire project at once**.

The AI must work through exactly **one subtask at a time**, obtain human approval, test the result, and only then proceed.

---

# 1. Core Execution Rule

For every task:

```text
SELECT ONE SUBTASK
       ↓
UNDERSTAND REQUIREMENT
       ↓
EXPLAIN IMPLEMENTATION PLAN
       ↓
WAIT FOR HUMAN APPROVAL
       ↓
IMPLEMENT
       ↓
RUN TESTS
       ↓
REPORT RESULT
       ↓
WAIT FOR HUMAN APPROVAL
       ↓
COMMIT
       ↓
SELECT NEXT SUBTASK
```

The AI must never silently skip approval.

---

# 2. Task Selection

At the beginning of each execution cycle:

1. Read `PRD.md`.
2. Read `TODO.md`.
3. Read this file.
4. Identify the first incomplete subtask.
5. Work only on that subtask.

Do not start future subtasks unless required to make the current subtask functional.

---

# 3. Task States

Each task has one of these states:

```text
NOT STARTED
    ↓
PLANNED
    ↓
APPROVED
    ↓
IMPLEMENTING
    ↓
TESTING
    ↓
PASSED
    ↓
COMMITTED
```

If testing fails:

```text
TESTING
   ↓
FAILED
   ↓
DEBUG
   ↓
TESTING
```

Do not mark a task complete until its test passes.

---

# 4. Human Approval Gate

Before modifying code, the AI must provide:

### Task

State the exact task being implemented.

### Objective

Explain what the task accomplishes.

### Files

List files that will be created or modified.

### Implementation

Briefly explain the implementation approach.

### Testing

Explain how the result will be tested.

Then ask:

> Approve implementation of this subtask?

The AI must wait for approval.

---

# 5. Implementation Rules

When approval is received:

1. Modify only the necessary files.
2. Do not rewrite unrelated components.
3. Do not introduce unnecessary dependencies.
4. Follow the architecture defined in `PRD.md`.
5. Keep biological models separate from UI code.
6. Keep controller logic separate from simulation logic.
7. Keep API logic separate from simulation models.
8. Write maintainable code.
9. Add comments only where they clarify non-obvious scientific or computational logic.

---

# 6. Scientific Integrity Rules

The project is a **digital twin simulation**, not an experimentally validated industrial bioreactor.

The AI must not:

- Claim simulated results are experimental results.
- Invent experimental datasets.
- Claim that the fouling model is experimentally validated.
- Invent biological constants and present them as validated values.
- Claim industrial readiness without validation.

When parameters are assumptions, label them explicitly as:

```text
Model Assumption
```

When values originate from literature or external datasets, record their source.

---

# 7. Simulation Development Order

The AI must implement the simulation in this order:

```text
1. Configuration
        ↓
2. Cell growth
        ↓
3. Nutrient consumption
        ↓
4. Metabolite production
        ↓
5. Perfusion
        ↓
6. Fouling-risk model
        ↓
7. State management
        ↓
8. Simulation engine
        ↓
9. Controller
        ↓
10. Scenario comparison
        ↓
11. API
        ↓
12. Dashboard
        ↓
13. Fault injection
```

Do not implement the controller before the underlying simulation state is working.

---

# 8. Testing Requirements

Every scientific model must have basic sanity tests.

## Cell Model

Verify:

- Cell density changes with time.
- Favorable conditions produce growth.
- Death conditions reduce viable cells.
- Cell density does not become physically impossible.

## Nutrient Model

Verify:

- Nutrient decreases when cells consume it.
- Perfusion replenishes nutrient.
- Concentration does not become negative.

## Metabolite Model

Verify:

- Metabolite production occurs as cells grow.
- Perfusion removes metabolite.
- Concentration remains within valid limits.

## Perfusion Model

Verify:

- Inflow and outflow are consistent.
- Changing perfusion changes nutrient/metabolite behavior.

## Fouling Model

Verify:

- Fouling risk changes with simulated process load.
- Fouling index remains between 0 and 100.
- Thresholds trigger correctly.

## Controller

Verify:

- Controller responds to low nutrient.
- Controller responds to high metabolite.
- Controller responds to high fouling risk.
- Controller respects operating limits.
- Controller does not continuously oscillate.

---

# 9. Git Workflow

After a subtask passes testing:

```text
git status
git diff
git add <relevant-files>
git commit -m "<descriptive task message>"
```

Commit messages should describe the completed task.

Examples:

```text
feat: add bioreactor configuration model
feat: implement cell growth simulation
feat: add nutrient consumption model
feat: implement perfusion simulation
feat: add fouling risk model
feat: implement rule based controller
feat: add simulation dashboard
```

Do not make giant commits containing multiple unrelated subtasks.

---

# 10. Error Handling

If an implementation fails:

1. Stop.
2. Identify the error.
3. Explain the likely cause.
4. Propose the smallest fix.
5. Ask for approval if the fix changes the original implementation scope.
6. Apply the fix.
7. Re-run the test.

Do not hide errors or mark the task as complete when tests fail.

---

# 11. Scope Control

The hackathon MVP has priority over advanced functionality.

If time becomes limited, prioritize:

```text
HIGH PRIORITY
├── Cell growth
├── Nutrient model
├── Metabolite model
├── Perfusion
├── Fouling risk
├── Controller
├── Dashboard
└── Controlled vs uncontrolled comparison

MEDIUM PRIORITY
├── Fault injection
└── What-if analysis

LOW PRIORITY
├── PID
├── MPC
├── Machine learning
├── Advanced optimization
└── Hardware integration
```

Never sacrifice a stable MVP to implement an advanced feature.

---

# 12. Dashboard Development Rule

The dashboard should first be functional.

Build in this order:

```text
Data
 ↓
KPI values
 ↓
Basic charts
 ↓
Simulation controls
 ↓
Status indicators
 ↓
Scenario comparison
 ↓
Visual polish
```

Do not spend significant implementation time on animations or visual effects before the simulation works.

---

# 13. Demo Validation

Before the final hackathon demo, execute the complete scenario:

### Scenario 1

Run uncontrolled simulation.

Record:

- Final cell density
- Viability
- Nutrient
- Metabolite
- Fouling risk

### Scenario 2

Run controlled simulation.

Record the same metrics.

### Scenario 3

Introduce a process disturbance.

Verify:

```text
Disturbance
    ↓
Digital Twin detects state change
    ↓
Controller evaluates state
    ↓
Control action generated
    ↓
Bioreactor state changes
    ↓
System recovers
```

The demo is not considered ready until all three scenarios work reliably.

---

# 14. Final Acceptance Criteria

The project is complete when:

- [ ] The simulation runs end-to-end.
- [ ] Cell growth is represented.
- [ ] Nutrient consumption is represented.
- [ ] Metabolite accumulation is represented.
- [ ] Perfusion affects the process.
- [ ] Fouling risk changes dynamically.
- [ ] Automated control changes operating conditions.
- [ ] The target of >10⁸ cells/mL can be represented within the simulation.
- [ ] Controlled and uncontrolled operation can be compared.
- [ ] A disturbance can be introduced.
- [ ] The controller responds to the disturbance.
- [ ] Dashboard visualizations work.
- [ ] Scientific assumptions are documented.
- [ ] Simulated results are clearly identified as simulated.
- [ ] The complete demo can be performed reliably.

---

# 15. AI Behavior

The AI must behave as an implementation partner, not as an autonomous developer.

The AI must:

- Work on one subtask at a time.
- Explain before implementing.
- Wait for approval.
- Test every implementation.
- Report failures honestly.
- Keep the architecture modular.
- Preserve scientific accuracy.
- Avoid unnecessary scope expansion.
- Commit completed work intentionally.

The AI must not:

- Implement multiple TODO items without approval.
- Skip testing.
- Invent validation results.
- Change the project architecture without approval.
- Add advanced features before the MVP is complete.
- Claim that simulated biological behavior has been experimentally validated.

---

# 16. Starting Instruction

When this process begins, the AI should:

1. Read `PRD.md`.
2. Read `TODO.md`.
3. Inspect the existing repository.
4. Identify the first incomplete subtask under **P0 — Project Foundation**.
5. Explain the proposed implementation.
6. Ask for human approval.
7. Wait.

Do not begin implementation until the human explicitly approves the first subtask.