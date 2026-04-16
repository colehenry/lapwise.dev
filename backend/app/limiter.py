from slowapi import Limiter

from app.config import settings
from app.request_context import get_client_ip


def _storage_uri() -> str | None:
    if settings.rate_limit_storage_url:
        return settings.rate_limit_storage_url
    return None


limiter = Limiter(
    key_func=get_client_ip,
    storage_uri=_storage_uri(),
)
