"""HTTP cache-header helpers.

Used to mark read-only endpoints as cacheable at the edge (Cloudflare).
The CDN respects `Cache-Control: public, s-maxage=...` and treats `private`
or missing public directives as uncacheable, so we can safely vary by
auth state inside a single endpoint.
"""

from fastapi import Response


def set_public_cache(response: Response, seconds: int) -> None:
    """Mark a response as publicly cacheable for `seconds` at the edge.

    `s-maxage` controls shared/CDN caches; `max-age` controls the browser.
    `stale-while-revalidate` lets the CDN serve a stale copy for an extra
    window while it refreshes in the background.
    """
    response.headers["Cache-Control"] = (
        f"public, s-maxage={seconds}, max-age={min(seconds, 60)}, "
        f"stale-while-revalidate={seconds}"
    )


def set_private_cache(response: Response) -> None:
    """Mark a response as user-specific. CDN must not cache it."""
    response.headers["Cache-Control"] = "private, no-store"
