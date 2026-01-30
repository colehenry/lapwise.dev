# lapwise.dev

A production-ready Formula 1 analytics platform visualizing race data, standings, and statistics.

## Features

- **Comprehensive Race Data**: 2025-2018 F1 season results with full telemetry
- **Driver & Constructor Profiles**: Career statistics, championship history, and performance trends
- **Interactive Visualizations**: Points progression graphs with team colors (Recharts)
- **Sprint Race Support**: Dedicated endpoints for sprint qualifying and races
- **Circuit Information**: Track layouts, locations, and historical race data
- **Upcoming Events**: Real-time schedule with preseason testing and race weekends
- **Auto-generated API Docs**: Interactive Swagger UI at `/docs`

## Tech Stack

### Frontend
- **Framework**: Next.js 15.1.6 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **State/Fetching**: React Query 5
- **Visualization**: Recharts 3.6
- **Linting**: Biome.js 2.2

### Backend
- **Framework**: FastAPI 0.104
- **Language**: Python 3.11
- **ORM**: SQLAlchemy 2.0 (Async)
- **Migrations**: Alembic
- **Validation**: Pydantic 2.5
- **Data Source**: FastF1 3.6

### Database
- **Neon PostgreSQL**: Cloud-managed PostgreSQL
- **Environments**: Dev and Production branches
- **Connection**: Pooler endpoint with SSL required

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11
- Neon DB credentials (ask team for access)

### Installation

1. **Set up the backend**
```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Ensure .env has DEV database URL
# DATABASE_URL=postgresql+asyncpg://...-pooler.../neondb?ssl=require

# Run migrations
alembic upgrade head
```

2. **Ingest F1 data** (optional, dev database already has data)
```bash
PYTHONPATH=$PWD python scripts/ingest_season.py 2024
```

3. **Start the backend server**
```bash
uvicorn app.main:app --reload
```
API will be available at http://localhost:8000 (docs at `/docs`)

4. **Set up the frontend** (in a new terminal)
```bash
cd frontend
npm install
npm run dev
```
App will be available at http://localhost:3000

## Project Structure

```
lapwise.dev/
├── frontend/                    # Next.js 15 application
│   ├── app/                     # App Router (file-based routing)
│   │   ├── drivers/[driverCode]/page.tsx
│   │   ├── results/[season]/page.tsx
│   │   └── circuits/page.tsx
│   ├── components/             # React components
│   │   ├── ui/                 # Reusable UI components
│   │   ├── Navigation.tsx
│   │   └── QueryProvider.tsx
│   └── lib/                    # Utilities, API client
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── main.py            # FastAPI entrypoint
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── routers/           # API endpoints
│   │   ├── schemas/           # Pydantic response models
│   │   └── services/          # Business logic layer (NEW)
│   │       ├── results_service.py
│   │       ├── driver_service.py
│   │       ├── constructor_service.py
│   │       ├── circuit_service.py
│   │       └── event_service.py
│   ├── scripts/
│   │   ├── ingest_season.py  # Main ingestion orchestrator
│   │   └── ingest/           # Modular ingestion components (NEW)
│   │       ├── circuits.py
│   │       ├── sessions.py
│   │       ├── participants.py
│   │       ├── results.py
│   │       ├── telemetry.py
│   │       └── utils.py
│   └── alembic/              # Database migrations
└── README.md
```

## Architecture Highlights

### Services Layer Pattern
The backend now uses a **services layer** for clean separation of concerns:

- **Routers** (`app/routers/`): Handle HTTP requests/responses, validation, and status codes
- **Services** (`app/services/`): Contain all business logic and database queries
- **Models** (`app/models/`): SQLAlchemy ORM definitions
- **Schemas** (`app/schemas/`): Pydantic request/response models

**Benefits:**
- Improved testability (services can be unit tested independently)
- Cleaner code organization (routers are now <150 lines each)
- Easier maintenance (business logic changes don't affect routing)
- Reusable logic across endpoints

### Modular Data Ingestion
The data ingestion pipeline (`scripts/ingest_season.py`) is now modularized:

- **Main orchestrator**: Coordinates ingestion workflow
- **Specialized modules**:
  - `circuits.py`: Circuit/track data
  - `sessions.py`: Session metadata
  - `participants.py`: Drivers and teams
  - `results.py`: Race and qualifying results
  - `telemetry.py`: Lap times, weather, track status
  - `utils.py`: Shared helpers and retry logic

**Benefits:**
- Easier to debug specific ingestion steps
- Improved code reusability
- Better error isolation
- Cleaner testing surface

## API Endpoints

All endpoints require `X-API-Key` header for authentication.

### Season Results
- `GET /api/results/{season}` - All race results for a season
- `GET /api/results/{season}/{round}` - Specific race results
- `GET /api/results/{season}/{round}/sprint` - Sprint race results
- `GET /api/seasons` - List all available seasons
- `GET /api/latest` - Latest race podium

### Drivers
- `GET /api/drivers/{driver_code}` - Driver profile with career stats
- `GET /api/drivers/{driver_code}/season-history` - Points by season
- `GET /api/drivers/{driver_code}/race-history` - All race results

### Constructors
- `GET /api/constructors/{team_name}` - Constructor profile
- `GET /api/constructors/{team_name}/season-history` - Points by season
- `GET /api/constructors/{team_name}/race-history` - All race results

### Circuits
- `GET /api/circuits` - List all F1 circuits with stats
- `GET /api/circuits/{circuit_id}` - Detailed circuit information

### Events
- `GET /api/events/upcoming` - Next race events (limit parameter)

### Health
- `GET /health` - API health check (no auth required)

## Development

### Code Quality

**Frontend (Biome.js):**
```bash
cd frontend
npx biome check --write .
```

**Backend (Black + Flake8):**
```bash
cd backend
black .
flake8
```

### Testing
```bash
cd backend
pytest
```

## Deployment

- **Frontend**: Netlify (auto-deploy from `main` branch)
- **Backend**: Railway (deploys via GitHub Actions)
- **Database**: Neon PostgreSQL (managed cloud)

## License

MIT License - Not affiliated with Formula 1
