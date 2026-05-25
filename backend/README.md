# Lapwise API

FastAPI backend for Formula 1 race data, telemetry, and historical statistics. Provides a RESTful API for querying F1 session results, driver/constructor standings, and points progressions.

## Tech Stack

- Backend: FastAPI (Python 3.11), SQLAlchemy 2.0, Pydantic v2
- Database: PostgreSQL 15+ (async via asyncpg)
- Data Sources: FastF1 3.6.1 (F1 Live Timing API)
- Infrastructure: Alembic migrations, Docker support

## Features

- Session-based architecture (race, qualifying, sprint race, sprint qualifying)
- Complete 2024 F1 season data with lap times, weather, and race control messages
- Championship standings calculation (drivers and constructors)
- Points progression tracking across race weekends
- Auto-generated API documentation (OpenAPI/Swagger)
- Health check endpoint for deployment monitoring

## API Documentation

Live API docs available at `/docs` when the server is running.

**Base URL:** `http://localhost:8000`

**Key Endpoints:**
- `GET /api/results/seasons` - Available seasons
- `GET /api/results/{season}/standings` - Championship standings
- `GET /api/results/{season}` - All race rounds with podiums
- `GET /api/results/{season}/{round}` - Individual race details
- `GET /api/results/{season}/points-progression` - Cumulative points by round
- `GET /health` - Health check

## Local Development

### Prerequisites

- Python 3.11+
- PostgreSQL 15+

### Setup

```bash
# Clone repository (if not already cloned)
git clone https://github.com/YOUR_USERNAME/f1-analytics.git
cd f1-analytics/backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials and settings

# Run migrations
alembic upgrade head

# Optional: Ingest 2024 season data
PYTHONPATH=$PWD python scripts/ingest_season.py 2024

# Start development server
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

### Environment Variables

Required variables (see `.env.example` for template):

- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - Application secret key
- `DEBUG` - Enable debug mode (True/False)
- `CORS_ORIGINS` - Comma-separated list of allowed frontend URLs
- `FASTF1_CACHE_DIR` - Directory for caching F1 telemetry data

### Database Operations

```bash
# Create a new migration
alembic revision --autogenerate -m "Description of changes"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View current migration
alembic current
```

### Data Ingestion

```bash
# Ingest all session types for 2024
PYTHONPATH=$PWD python scripts/ingest_season.py 2024

# Ingest specific session types
PYTHONPATH=$PWD python scripts/ingest_season.py 2024 race,qualifying

# Available session types: race, qualifying, sprint_race, sprint_qualifying
```

## Testing

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_routes.py

# Run with coverage
pytest --cov=app tests/
```

## Code Quality

```bash
# Format code
black .

# Lint code
flake8
```

## Deployment

### Using Docker

```bash
# Build image
docker build -t f1-analytics-api .

# Run container
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/db" \
  -e SECRET_KEY="your-secret-key" \
  -e DEBUG="False" \
  -e CORS_ORIGINS="https://your-frontend.com" \
  f1-analytics-api
```

### Production Checklist

- [ ] Set `DEBUG=False` in environment variables
- [ ] Use a strong `SECRET_KEY` (generate with: `openssl rand -hex 32`)
- [ ] Configure `CORS_ORIGINS` with actual frontend URL
- [ ] Configure `RATE_LIMIT_STORAGE_URL` with shared production storage
- [ ] Configure `TRUSTED_PROXY_HOSTS` only for known load balancer/proxy peers, and verify spoofed `X-Forwarded-For` values are not recorded
- [ ] Treat `LAPWISE_API_KEY` as a public traffic key, not a secret
- [ ] Use managed PostgreSQL (e.g., Neon, Railway, Supabase)
- [ ] Set up health check monitoring at `/health`
- [ ] Enable HTTPS (handled by deployment platform)
- [ ] Configure database connection pooling if needed

## Database Schema

- **sessions** - Race/qualifying/sprint session metadata (year, round, date, circuit)
- **session_results** - Driver results per session (position, time, points, qualifying times)
- **drivers** - Driver information (name, code, number, country)
- **teams** - Constructor information (year-partitioned for color changes)
- **circuits** - Track information (name, location, country)
- **laps** - Lap-by-lap timing data (sector times, speed traps, tyre compounds)
- **weather** - Weather conditions during sessions (temp, humidity, rainfall)
- **track_status** - Track status changes (yellow flags, red flags, safety car)
- **race_control_messages** - Official race control communications

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application entrypoint
│   ├── config.py            # Settings and environment variables
│   ├── database.py          # Database connection and session
│   ├── models/              # SQLAlchemy models
│   │   ├── session.py
│   │   ├── session_result.py
│   │   ├── driver.py
│   │   ├── team.py
│   │   ├── circuit.py
│   │   ├── lap.py
│   │   ├── weather.py
│   │   ├── track_status.py
│   │   └── race_control_message.py
│   ├── schemas/             # Pydantic request/response models
│   │   └── result.py
│   └── routers/             # API endpoints
│       └── season_results.py
├── scripts/
│   └── ingest_season.py     # Data ingestion from FastF1
├── alembic/                 # Database migrations
│   ├── versions/            # Migration files
│   └── env.py
├── tests/                   # Test files
├── requirements.txt         # Python dependencies
├── Dockerfile               # Production container image
├── .dockerignore            # Files to exclude from Docker builds
├── .env.example             # Environment variable template
└── alembic.ini              # Alembic configuration
```

## License

MIT License
