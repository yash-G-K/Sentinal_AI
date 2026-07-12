# Sentinel AI

## Project Overview
Sentinel AI is an enterprise-grade AI-Powered Web Application Firewall (WAF) & Threat Intelligence Platform. It leverages machine learning to continuously monitor HTTP/HTTPS traffic, identify malicious requests, and autonomously protect web applications from evolving threats.

## Architecture
- **Backend**: Python FastAPI with Uvicorn, SQLAlchemy, Loguru.
- **Frontend**: React (Vite) with Tailwind CSS, React Router, Recharts.
- **Database**: MySQL.
- **Proxy**: Nginx (planned).
- **AI Engine**: Ollama / Qwen 2.5 integration (planned).

## Folder Structure
```
Sentinel-AI/
├── backend/          # FastAPI server and core WAF logic
├── frontend/         # React dashboard
├── nginx/            # Reverse proxy configurations
├── mysql/            # Database scripts
├── docs/             # Documentation
├── docker/           # Dockerfiles and assets
├── scripts/          # Utility scripts
└── attack_simulator/ # Tools for simulating attacks
```

## Technology Stack
- **Backend**: Python 3.12+, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, PyMySQL, HTTPX, Loguru, APScheduler.
- **Frontend**: React, Vite, Tailwind CSS, React Router, Axios, Recharts, Framer Motion, React Icons.
- **Database**: MySQL.
- **Infrastructure**: Docker, Nginx.

## Installation Instructions

### Backend
1. Navigate to the `backend` directory.
2. Create a virtual environment: `python -m venv venv`
3. Activate the virtual environment.
4. Install dependencies: `pip install -r requirements.txt`
5. Copy `.env.example` to `.env` and configure settings.
6. Run the server: `python main.py` or `uvicorn backend.main:app --reload`

### Frontend
1. Navigate to the `frontend` directory.
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`

## Future Phases
- Attack detection and AI logic implementation.
- Firewall rules and IP reputation management.
- Authentication and Business logic.
- Real-time Threat Intelligence Dashboard.
