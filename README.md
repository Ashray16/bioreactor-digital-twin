# BB 04 — Digital Twin Bioreactor Platform

A production-quality, hackathon-ready **Digital Twin of a Mammalian Cell Perfusion Bioreactor** for high-density cell culture control, nutrient/metabolite dynamics simulation, and filter fouling risk prediction.

## Architecture

* **Backend**: Python 3.10+ (FastAPI, Pydantic, NumPy, SciPy)
* **Frontend**: React 18+, Vite, TypeScript, Tailwind CSS, Recharts, Lucide Icons

## Getting Started

### Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Features
- **Mechanistic Biological Model**: Viable cell growth, nutrient consumption (glucose), metabolite accumulation (lactate), and viability kinetics.
- **Perfusion Engine**: Dynamic media exchange, nutrient replenishment, and metabolite washout.
- **Fouling Risk Index**: Real-time 0–100 normalized filter clogging risk model based on biomass load, cell density, and operating duration.
- **Automated Control**: Rule-based adaptive perfusion controller balancing cell density target (>10⁸ cells/mL) vs filter fouling.
- **Controlled vs Uncontrolled Scenario Comparison**: Real-time side-by-side trajectory evaluation.
- **Fault Injection & Recovery**: Disturbances such as nutrient feed drop, increased cell mortality, or filter fouling surge.
