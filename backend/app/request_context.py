from ipaddress import ip_address

from fastapi import Request

from app.config import settings


def _is_loopback(host: str) -> bool:
    try:
        return ip_address(host).is_loopback
    except ValueError:
        return host in {"localhost", "testclient"}


def _is_trusted_proxy(host: str) -> bool:
    trusted_hosts = settings.get_trusted_proxy_hosts()
    if "*" in trusted_hosts:
        return True
    if host in trusted_hosts:
        return True
    if "loopback" in trusted_hosts and _is_loopback(host):
        return True
    return False


def get_client_ip(request: Request) -> str:
    """
    Return the canonical client IP for abuse controls.

    Forwarded headers are only trusted when the direct peer is configured as a
    trusted proxy. This prevents clients from bypassing rate limits by sending
    their own X-Forwarded-For value.
    """
    peer_host = request.client.host if request.client else "unknown"
    if not _is_trusted_proxy(peer_host):
        return peer_host

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        candidates = [
            candidate.strip() for candidate in forwarded.split(",") if candidate.strip()
        ]
        if candidates:
            # Use the nearest upstream value, not the leftmost value. Clients
            # can prepend spoofed entries, while trusted proxies append.
            return candidates[-1]

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    return peer_host
