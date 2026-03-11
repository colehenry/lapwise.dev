from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.limiter import limiter

# Create the FastAPI application
app = FastAPI(
    title="lapwise.dev api",
    description="API for F1 telemetry, race result data, and historical statistics",
    version="0.1.0",
    debug=settings.debug,
    redirect_slashes=False,
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please try again later."},
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


from app.routers import (
    season_results,
    drivers,
    constructors,
    events,
    circuits,
    auth,
    posts,
    tags,
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(season_results.router, prefix="/api/results", tags=["results"])
app.include_router(drivers.router, prefix="/api/drivers", tags=["drivers"])
app.include_router(
    constructors.router, prefix="/api/constructors", tags=["constructors"]
)
app.include_router(events.router, prefix="/api/events", tags=["events"])
app.include_router(circuits.router, prefix="/api/circuits", tags=["circuits"])
app.include_router(posts.router, prefix="/api/posts", tags=["posts"])
app.include_router(tags.router, prefix="/api/tags", tags=["tags"])
