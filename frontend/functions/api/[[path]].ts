/**
 * Same-origin proxy for /api/* → AWS API Gateway, with edge caching.
 *
 * Why this exists
 * ---------------
 * In the previous setup the SPA called API Gateway directly
 * (cross-origin, CORS enabled). That bypassed Cloudflare's edge cache, so
 * every read — including ones the backend marks as `Cache-Control:
 * public, s-maxage=...` — round-tripped to the Lambda + Neon DB.
 *
 * Routing /api/* through this Pages Function makes the requests
 * same-origin AND lets us serve cacheable responses from Cloudflare's
 * edge for `s-maxage` seconds (population-wide, not per-browser).
 *
 * Caching rules
 * -------------
 * - Cache only GET / HEAD.
 * - Cache only requests WITHOUT an `Authorization` header. We never want
 *   a personalized response to leak across users; the backend already
 *   returns `private, no-store` for authed callers, but we double-gate
 *   here so an authed request can't accidentally serve an anon-cached
 *   response.
 * - Cache only when the origin response carries `public` AND `s-maxage`.
 *   The TTL is honored by Cloudflare's edge cache (Workers Cache API).
 */

const UPSTREAM = "https://pe360p9tga.execute-api.ap-southeast-1.amazonaws.com/prod";

// Headers Cloudflare adds that we don't want to forward upstream.
const STRIPPED_REQUEST_HEADERS = [
  "host",
  "cf-connecting-ip",
  "cf-ray",
  "cf-visitor",
  "cf-ipcountry",
  "cf-ew-via",
  "x-forwarded-host",
  "x-forwarded-proto",
];

export const onRequest = async (context: {
  request: Request;
  waitUntil: (p: Promise<unknown>) => void;
}): Promise<Response> => {
  const { request, waitUntil } = context;
  const url = new URL(request.url);

  // /api/foo?x=1  →  <UPSTREAM>/foo?x=1
  const upstreamUrl =
    UPSTREAM + url.pathname.replace(/^\/api/, "") + url.search;

  const isCacheableMethod =
    request.method === "GET" || request.method === "HEAD";
  const isAuthed = request.headers.has("authorization");
  const useEdgeCache = isCacheableMethod && !isAuthed;

  // @ts-expect-error — `caches` is a Cloudflare Workers global
  const cache: Cache = caches.default;

  // Stable cache key: same URL, no auth header, normalized to GET.
  const cacheKey = new Request(url.toString(), { method: "GET" });

  if (useEdgeCache) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const resp = new Response(hit.body, hit);
      resp.headers.set("x-edge-cache", "HIT");
      return resp;
    }
  }

  // Build forwarded request. Preserve method, headers, body.
  const upstreamHeaders = new Headers(request.headers);
  for (const h of STRIPPED_REQUEST_HEADERS) upstreamHeaders.delete(h);

  const upstreamReq = new Request(upstreamUrl, {
    method: request.method,
    headers: upstreamHeaders,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
    redirect: "manual",
  });

  const upstream = await fetch(upstreamReq);
  const response = new Response(upstream.body, upstream);
  response.headers.set("x-edge-cache", useEdgeCache ? "MISS" : "BYPASS");

  if (useEdgeCache && upstream.ok) {
    const cc = upstream.headers.get("cache-control") ?? "";
    if (/\bpublic\b/.test(cc) && /\bs-maxage=\d+/.test(cc)) {
      // Don't block the response; populate the edge cache asynchronously.
      waitUntil(cache.put(cacheKey, response.clone()));
    }
  }

  return response;
};
