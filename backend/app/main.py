import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.middleware.sessions import SessionMiddleware

from app.cache_policy import NO_STORE, add_vary_header, cache_control_for
from app.config import settings
from app.limiter import limiter
from app.services.driver_identity_service import AmbiguousLegacyDriverError

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        traces_sample_rate=0.1,
        send_default_pii=False,
    )

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


@app.exception_handler(AmbiguousLegacyDriverError)
async def ambiguous_driver_handler(request: Request, exc: AmbiguousLegacyDriverError):
    return JSONResponse(
        status_code=409,
        content={
            "detail": f"Legacy driver code '{exc.code}' is ambiguous; use a canonical slug",
            "candidate_slugs": exc.candidates,
        },
    )


@app.middleware("http")
async def apply_cache_policy(request: Request, call_next):
    """
    Attach the freshness directive for the requested path.

    Only successful reads are cacheable. A route that sets its own
    Cache-Control keeps it, so binary blobs can declare their own lifetime.
    """
    response = await call_next(request)

    if "cache-control" in response.headers:
        return response

    if request.method not in ("GET", "HEAD") or response.status_code != 200:
        response.headers["Cache-Control"] = NO_STORE
        return response

    directive = cache_control_for(request.url.path)
    response.headers["Cache-Control"] = directive

    # Keying public entries on the API key keeps the gate intact at a shared
    # cache: a keyless request cannot be served an entry stored for a keyed one.
    if directive != NO_STORE:
        add_vary_header(response, "X-API-Key")

    return response


# Configure CORS (Cross-Origin Resource Sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
)

# Session middleware — required by Authlib's OAuth client to store state/nonce
# during the OAuth dance. Cookie is httponly and short-lived.
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    session_cookie="lapwise_oauth_session",
    max_age=600,  # 10 minutes — only needs to outlive the OAuth round-trip
    same_site="lax",
    https_only=settings.frontend_url.startswith("https://"),
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
    admin,
    auth,
    circuits,
    comments,
    constructors,
    drivers,
    events,
    oauth,
    replay,
    season_results,
    users,
    weekend,
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(oauth.router, prefix="/auth/oauth", tags=["oauth"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(season_results.router, prefix="/api/results", tags=["results"])
app.include_router(weekend.router, prefix="/api/results", tags=["results"])
app.include_router(drivers.router, prefix="/api/drivers", tags=["drivers"])
app.include_router(
    constructors.router, prefix="/api/constructors", tags=["constructors"]
)
app.include_router(events.router, prefix="/api/events", tags=["events"])
app.include_router(circuits.router, prefix="/api/circuits", tags=["circuits"])
app.include_router(comments.router, prefix="/api/comments", tags=["comments"])
app.include_router(replay.router, prefix="/api/replay", tags=["replay"])
