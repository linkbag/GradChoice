"""Regression tests for the verification-code distribution flow.

Run from `backend/`:

    python -m pytest tests/test_verification_flow.py -v

These tests run on SQLite (no Postgres required) and never contact AWS: the SES client
is replaced with a stub, so no email leaves the machine. They cover the hardening done
after the bounce investigation:

* a rejected SES send must NOT auto-verify the address (verification bypass)
* a rejected send must roll back so it does not consume the address's send quota
* per-recipient cooldown + daily cap (the IP limiter alone is evadable)
* only the newest code can be verified
* the rate-limit key ignores a client-supplied X-Forwarded-For
* verification codes never appear in logs
"""
import os
import tempfile
from datetime import datetime, timedelta, timezone

import pytest
from botocore.exceptions import ClientError

# Configure the app before importing it: throwaway SQLite DB, throwaway secret, and a
# fake Lambda environment so database.py selects NullPool (SQLite rejects pool_size).
_TMP_DIR = tempfile.mkdtemp(prefix="gc-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_TMP_DIR, 'test.db')}"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["AWS_LAMBDA_FUNCTION_NAME"] = "pytest"

from fastapi.testclient import TestClient  # noqa: E402
from starlette.requests import Request  # noqa: E402

from app.api import auth as auth_module  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.middleware.rate_limit import get_real_ip, limiter  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.verification_code import VerificationCode, VerificationPurpose  # noqa: E402
from app.utils import email as email_module  # noqa: E402

Base.metadata.create_all(bind=engine, tables=[User.__table__, VerificationCode.__table__])

client = TestClient(app)

SIGNUP_URL = "/auth/send-signup-verification"
VERIFY_URL = "/auth/verify-signup-code"
REGISTER_URL = "/auth/register"


class _FakeSES:
    """Stand-in for boto3's SES client that records calls instead of sending mail."""

    def __init__(self, error=None):
        self.error = error
        self.calls = []

    def send_email(self, **kwargs):
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return {"MessageId": "fake-message-id"}


@pytest.fixture
def ses_ok(monkeypatch):
    fake = _FakeSES()
    monkeypatch.setattr(email_module, "_ses_client", lambda: fake)
    return fake


@pytest.fixture
def ses_rejected(monkeypatch):
    error = ClientError(
        {
            "Error": {
                "Code": "MessageRejected",
                "Message": "Email address is on the suppression list",
            }
        },
        "SendEmail",
    )
    fake = _FakeSES(error=error)
    monkeypatch.setattr(email_module, "_ses_client", lambda: fake)
    return fake


@pytest.fixture(autouse=True)
def _reset_state():
    """Keep the in-process rate limiter and the DB clean between tests."""
    limiter.reset()
    yield
    limiter.reset()
    db = SessionLocal()
    try:
        db.query(VerificationCode).delete()
        db.query(User).delete()
        db.commit()
    finally:
        db.close()


def _send(email: str, **kwargs):
    return client.post(SIGNUP_URL, json={"email": email}, **kwargs)


def _rows(email: str):
    db = SessionLocal()
    try:
        return (
            db.query(VerificationCode)
            .filter(VerificationCode.email == email)
            .order_by(VerificationCode.created_at)
            .all()
        )
    finally:
        db.close()


def _register(email: str):
    return client.post(
        REGISTER_URL,
        json={
            "email": email,
            "password": "password123",
            "display_name": "tester",
            "tos_agreed": True,
        },
    )


# --------------------------------------------------------------------------- sending


def test_send_code_stores_unverified_code(ses_ok):
    email = "new.user@example.com"
    resp = _send(email)

    assert resp.status_code == 200, resp.text
    assert len(ses_ok.calls) == 1
    assert ses_ok.calls[0]["Destination"]["ToAddresses"] == [email]

    rows = _rows(email)
    assert len(rows) == 1
    assert rows[0].verified is False
    assert len(rows[0].code) == 6 and rows[0].code.isdigit()


def test_rejected_send_returns_error_and_never_auto_verifies(ses_rejected):
    """The old code marked the address verified when SES refused the send."""
    email = "undeliverable@qq.com"
    resp = _send(email)

    assert resp.status_code == 502, resp.text
    assert "验证码发送失败" in resp.json()["detail"]

    # The failed attempt must not consume the address's send quota.
    assert _rows(email) == []

    # ...and it must not leave the address pre-verified for registration.
    reg = _register(email)
    assert reg.status_code == 201, reg.text
    assert reg.json()["is_email_verified"] is False


def test_resend_within_cooldown_is_rejected(ses_ok):
    email = "cooldown@example.com"
    assert _send(email).status_code == 200

    second = _send(email)
    assert second.status_code == 429
    assert "发送过于频繁" in second.json()["detail"]
    # Only the first send actually went out.
    assert len(ses_ok.calls) == 1


def test_daily_send_cap_is_enforced(ses_ok):
    email = "cap@example.com"
    now = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        for i in range(5):
            db.add(
                VerificationCode(
                    email=email,
                    code="111111",
                    purpose=VerificationPurpose.signup,
                    expires_at=now - timedelta(minutes=1),
                    verified=False,
                    created_at=now - timedelta(minutes=30 - i),
                )
            )
        db.commit()
    finally:
        db.close()

    resp = _send(email)
    assert resp.status_code == 429
    assert "次数过多" in resp.json()["detail"]
    assert len(ses_ok.calls) == 0


def test_only_the_latest_code_verifies(monkeypatch, ses_ok):
    email = "rotate@example.com"
    codes = iter(["111111", "222222"])
    monkeypatch.setattr(auth_module, "_generate_code", lambda: next(codes))

    assert _send(email).status_code == 200

    # Age the first row past the cooldown so a resend is allowed.
    db = SessionLocal()
    try:
        first = db.query(VerificationCode).filter_by(email=email).one()
        first.created_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        db.commit()
    finally:
        db.close()

    assert _send(email).status_code == 200

    rows = _rows(email)
    assert len(rows) == 2
    assert rows[0].verified is False
    assert auth_module._as_utc(rows[0].expires_at) <= datetime.now(timezone.utc)

    # The superseded code is dead, the fresh one works.
    stale = client.post(VERIFY_URL, json={"email": email, "code": "111111"})
    assert stale.status_code == 400
    fresh = client.post(VERIFY_URL, json={"email": email, "code": "222222"})
    assert fresh.status_code == 200, fresh.text


def test_full_signup_flow_marks_email_verified(ses_ok):
    email = "flow@example.com"
    assert _send(email).status_code == 200
    code = _rows(email)[-1].code

    wrong = "000000" if code != "000000" else "111111"
    assert client.post(VERIFY_URL, json={"email": email, "code": wrong}).status_code == 400
    assert client.post(VERIFY_URL, json={"email": email, "code": code}).status_code == 200

    reg = _register(email)
    assert reg.status_code == 201, reg.text
    assert reg.json()["is_email_verified"] is True


def test_code_is_never_written_to_logs(ses_ok, caplog):
    email = "logging@example.com"
    with caplog.at_level("INFO"):
        assert _send(email).status_code == 200

    code = _rows(email)[-1].code
    assert code not in caplog.text
    # The recipient is logged, so a delivery question is answerable from CloudWatch.
    assert email in caplog.text


# ------------------------------------------------------------------------ rate limit


def _request(headers: dict, peer=("203.0.113.9", 443)) -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/",
            "query_string": b"",
            "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
            "client": peer,
        }
    )


def test_trusted_edge_header_wins():
    assert get_real_ip(_request({"x-gc-client-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9"})) == "1.2.3.4"


def test_connection_peer_beats_forwarded_for():
    """A caller must not be able to choose its bucket with a forwarding header."""
    assert get_real_ip(_request({"x-forwarded-for": "9.9.9.9, 10.0.0.7"})) == "203.0.113.9"


def test_forwarded_for_is_the_last_resort():
    request = _request({"x-forwarded-for": "9.9.9.9, 10.0.0.7"}, peer=None)
    assert get_real_ip(request) == "10.0.0.7"


def test_rotating_forwarded_for_cannot_evade_the_limit(ses_ok):
    """Regression: rotating X-Forwarded-For used to hand out a fresh bucket each time."""
    statuses = [
        client.post(
            SIGNUP_URL,
            json={"email": f"abuse{i}@example.com"},
            headers={"X-Forwarded-For": f"203.0.113.{i}"},
        ).status_code
        for i in range(6)
    ]

    assert statuses[:5] == [200] * 5, statuses
    assert statuses[5] == 429, statuses


# ------------------------------------------------------------------- notification mail


def test_notification_email_links_to_production_domain(monkeypatch):
    fake = _FakeSES()
    monkeypatch.setattr(email_module, "_ses_client", lambda: fake)

    assert email_module.send_notification_email("user@example.com", "Bob") is True

    body = fake.calls[0]["Message"]["Body"]
    assert "gradchoice.org/inbox" in body["Text"]["Data"]
    assert "gradchoice.org/inbox" in body["Html"]["Data"]
    assert "pages.dev" not in body["Html"]["Data"]
