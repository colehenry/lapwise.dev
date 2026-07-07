from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from env variables.

    Pydantic will automatically:
    1. Read the .env file
    2. Validate the types (str, bool, etc.)
    3. Raise errors if required variables are missing
    """

    # Database
    database_url: str
    local_database_url: str | None = None
    dev_database_url: str | None = None

    # Application
    debug: bool = False
    secret_key: str
    cors_origins: str = ""
    lapwise_api_key: str
    trusted_proxy_hosts: str = ""

    # Auth / JWT
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    rate_limit_storage_url: str | None = None

    # Email (Resend)
    resend_api_key: str = ""
    email_from: str = "noreply@lapwise.dev"
    frontend_url: str = "http://localhost:3000"

    # OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    oauth_redirect_base_url: str = "http://localhost:8000"

    # Error monitoring
    sentry_dsn: str | None = None
    sentry_environment: str = "production"

    # AI
    ai_daily_query_limit: int = 20
    anthropic_api_key: str = ""

    # FastF1
    fastf1_cache_dir: str = "./cache"

    def get_cors_origins(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        origins: list[str] = []
        if self.frontend_url:
            origins.append(self.frontend_url.strip())
            if self.frontend_url.startswith("http://localhost"):
                origins.append("http://127.0.0.1:3000")
            if self.frontend_url.startswith("http://127.0.0.1"):
                origins.append("http://localhost:3000")

        if self.cors_origins:
            origins.extend(
                [
                    origin.strip()
                    for origin in self.cors_origins.split(",")
                    if origin.strip()
                ]
            )

        deduped: list[str] = []
        for origin in origins:
            if origin and origin not in deduped:
                deduped.append(origin)
        return deduped

    def get_trusted_proxy_hosts(self) -> list[str]:
        """Parse comma-separated proxy hosts allowed to set forwarding headers."""
        if not self.trusted_proxy_hosts:
            return []
        return [
            host.strip() for host in self.trusted_proxy_hosts.split(",") if host.strip()
        ]

    class Config:
        # Tell Pydantic where to find the .env file
        env_file = ".env"
        # Make it case-insensitive (DATABASE_URL = database_url)
        case_sensitive = False


# Create a single instance to use throughout the app
settings = Settings()
