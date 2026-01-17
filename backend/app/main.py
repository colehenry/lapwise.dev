from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

# Create the FastAPI application
app = FastAPI(
    title="lapwise.dev api",
    description="API for F1 telemetry, race result data, and historical statistics",
    version="0.1.0",
    debug=settings.debug,
)

# Configure CORS (Cross-Origin Resource Sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Root endpoint
@app.get("/")
async def root():
    """
    Root endpoint - Returns basic API information.
    """
    return {
        "message": "lapwise.dev api",
        "status": "running",
        "version": "0.1.0",
    }


# Health check endpoint for deployment platforms
@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring and load balancers.
    """
    return {
        "status": "healthy",
        "version": "0.1.0",
    }


from app.routers import season_results, drivers, constructors

app.include_router(season_results.router, prefix="/api/results", tags=["results"])
app.include_router(drivers.router, prefix="/api/drivers", tags=["drivers"])
app.include_router(
    constructors.router, prefix="/api/constructors", tags=["constructors"]
)
