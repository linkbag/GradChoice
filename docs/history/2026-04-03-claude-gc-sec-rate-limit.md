# Work Log: gc-sec-rate-limit

## Session: 2026-04-03

### What Changed

1. **`backend/requirements.txt`** — Added `slowapi==0.1.9`
2. **`backend/requirements-lambda.txt`** — Added `slowapi==0.1.9`
3. **`backend/app/middleware/__init__.py`** — Created (empty, makes middleware a package)
4. **`backend/app/middleware/rate_limit.py`** — Created Limiter with `get_real_ip` (reads X-Forwarded-For for Lambda/CloudFront), default 200/minute
5. **`backend/app/main.py`** — Added SlowAPIMiddleware, limiter state, and RateLimitExceeded handler
6. **`backend/app/api/supervisors.py`** — Added `request: Request` param + `@limiter.limit()` to 4 endpoints
7. **`backend/app/api/auth.py`** — Added `request: Request` param + `@limiter.limit()` to 3 endpoints

### Rate Limits Applied

| Endpoint | Limit |
|---|---|
| `GET /supervisors/search` | 30/minute |
| `GET /supervisors` (list) | 30/minute |
| `GET /supervisors/{id}` | 60/minute |
| `GET /supervisors/school/{code}` | 30/minute |
| `POST /auth/send-signup-verification` | 5/minute |
| `POST /auth/send-reset-verification` | 5/minute |
| `POST /auth/login` | 10/minute |
| All other routes | 200/minute (default) |

### How to Verify

```bash
# Verify slowapi imports (no venv needed)
python3 -c "from slowapi import Limiter, _rate_limit_exceeded_handler; print('OK')"

# Full app import (requires SECRET_KEY + boto3)
cd backend && SECRET_KEY=xxx python3 -c "from app.main import app; print('OK')"

# Test rate limiting (hit /auth/login 11 times in 1 minute, 11th should return 429)
for i in $(seq 1 11); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/auth/login -d "username=x&password=y"; done
```

### Known Issues / Notes

- slowapi uses in-memory storage by default → each Lambda container rate-limits independently. Acceptable without Redis for this scale.
- Pre-existing: `boto3` not in system Python, so local `python3 -c "from app.main import app"` fails unless inside Docker. Unrelated to this change.
- X-Forwarded-For parsing strips the first IP (client IP) from comma-separated chain — correct for AWS ALB/CloudFront.

### Decisions Made

- Used `get_real_ip()` instead of default `get_remote_address` to correctly handle Lambda's proxy headers
- `request: Request` added as first positional param (required by slowapi decorator)
- Did not rate-limit `/supervisors/schools`, `/supervisors/provinces`, `/supervisors/school-names`, `/supervisors/departments` — these are low-frequency dropdown/list endpoints covered by the default 200/minute

### Build Status

All code changes syntactically valid. slowapi imports confirmed working. App import blocked only by missing boto3 in system Python (pre-existing, unrelated).

### Review Round 1
- Verdict: Review passed — reviewer fixed issues (commit: 6913dcb docs: auto-update ESR + persist worklog for claude-gc-sec-quick-fixes)
