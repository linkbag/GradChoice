from slowapi import Limiter
from slowapi.util import get_remote_address

# Header our own edge sets to the true client IP. The Cloudflare Pages Function
# (frontend/functions/api/[[path]].ts) deletes any inbound copy of it and any
# inbound X-Forwarded-For before adding it, so its value is not client-controlled.
CLIENT_IP_HEADER = "x-gc-client-ip"


def get_real_ip(request):
    """Return the rate-limit key: a client IP we can actually trust.

    Do NOT key on the left-most X-Forwarded-For entry, which is what this used to do:
    that value is supplied by the caller, so rotating it handed out a fresh bucket per
    request and defeated every limit — including the one guarding verification-code
    email. Precedence:

    1. x-gc-client-ip, set by our edge after stripping the caller's copy.
    2. The connection peer. Behind API Gateway (Mangum) this is the gateway's
       sourceIp, which a caller cannot forge, so direct-to-gateway traffic is keyed
       correctly even without the edge header.
    3. X-Forwarded-For, right-most hop only — a last resort for deployments that
       supply no peer information at all.
    """
    trusted = request.headers.get(CLIENT_IP_HEADER)
    if trusted:
        return trusted.strip()

    client = request.client
    if client is not None and getattr(client, "host", None):
        return client.host

    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[-1].strip()

    return get_remote_address(request)


limiter = Limiter(key_func=get_real_ip, default_limits=["200/minute"])
