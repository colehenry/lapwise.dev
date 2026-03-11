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
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    lapwise_api_key: str

    # Auth / JWT
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    # Email (Resend)
    resend_api_key: str = ""
    email_from: str = "noreply@lapwise.dev"
    frontend_url: str = "http://localhost:3000"

    # FastF1
    fastf1_cache_dir: str = "./cache"

    def get_cors_origins(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        # Tell Pydantic where to find the .env file
        env_file = ".env"
        # Make it case-insensitive (DATABASE_URL = database_url)
        case_sensitive = False


# Create a single instance to use throughout the app
settings = Settings()
