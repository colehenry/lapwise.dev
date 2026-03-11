from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings


def _storage_uri() -> str | None:
    if settings.rate_limit_storage_url:
        return settings.rate_limit_storage_url
    return None


limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_storage_uri(),
)
