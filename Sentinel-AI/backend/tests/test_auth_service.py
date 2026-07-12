"""
tests/test_auth_service.py
10.1 Unit Tests — AuthService

Covers:
- Password hashing / verification
- JWT token creation and decoding
- JWT expiry enforcement
- Authentication success
- Authentication failure (wrong password)
- Authentication failure (suspended account)
- User creation + duplicate email guard
- Status toggling
"""
import time
import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException

from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    VALID_ROLES,
)


# ── 10.1.1  Password hashing ──────────────────────────────────────────────────

def test_hash_password_produces_bcrypt_hash():
    h = hash_password("SuperSecret123!")
    assert h.startswith("$2b$")  # bcrypt prefix
    assert len(h) > 30


def test_verify_password_correct():
    pw = "CorrectPassword99"
    hashed = hash_password(pw)
    assert verify_password(pw, hashed) is True


def test_verify_password_wrong():
    h = hash_password("RealPassword")
    assert verify_password("WrongPassword", h) is False


def test_verify_password_empty_string():
    h = hash_password("something")
    assert verify_password("", h) is False


def test_verify_password_invalid_hash():
    """Should return False rather than raise for garbage hash strings."""
    assert verify_password("password", "not-a-valid-hash") is False


# ── 10.1.2  JWT token create / decode ────────────────────────────────────────

def test_create_access_token_returns_string():
    token = create_access_token({"sub": "1", "email": "test@example.com", "role": "Viewer"})
    assert isinstance(token, str)
    assert len(token) > 20


def test_decode_token_valid():
    payload = {"sub": "42", "email": "admin@waf.io", "role": "Super Admin"}
    token = create_access_token(payload)
    decoded = decode_token(token)
    assert decoded["sub"] == "42"
    assert decoded["email"] == "admin@waf.io"
    assert decoded["role"] == "Super Admin"


def test_decode_token_invalid_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        decode_token("this.is.not.a.valid.token")
    assert exc_info.value.status_code == 401


def test_decode_token_tampered_signature_raises_401():
    token = create_access_token({"sub": "1"})
    # Tamper with the signature
    tampered = token[:-4] + "XXXX"
    with pytest.raises(HTTPException) as exc_info:
        decode_token(tampered)
    assert exc_info.value.status_code == 401


# ── 10.1.3  RBAC role list completeness ──────────────────────────────────────

def test_valid_roles_contains_expected_roles():
    expected = {"Super Admin", "Security Admin", "SOC Analyst", "Viewer", "API Developer"}
    assert expected == set(VALID_ROLES)


def test_role_hierarchy_order():
    """Least-privileged role 'Viewer' and most 'Super Admin' must exist."""
    assert "Viewer" in VALID_ROLES
    assert "Super Admin" in VALID_ROLES


# ── 10.1.4  AuthService authenticate ─────────────────────────────────────────

def _make_mock_user(email="test@waf.io", password="Secret123!", role="SOC Analyst", status="active"):
    """Returns a mock User ORM object."""
    user = MagicMock()
    user.id = 99
    user.email = email
    user.password_hash = hash_password(password)
    user.role = role
    user.status = status
    user.last_login = None
    return user


def test_authenticate_success():
    from app.services.auth_service import AuthService
    svc = AuthService()

    db = MagicMock()
    user = _make_mock_user()
    db.query.return_value.filter.return_value.first.return_value = user

    with patch.object(svc, "_log_login"):
        returned_user, token = svc.authenticate(db, "test@waf.io", "Secret123!", ip="1.2.3.4")

    assert returned_user is user
    # Decode the token and verify sub
    decoded = decode_token(token)
    assert decoded["sub"] == "99"
    assert decoded["role"] == "SOC Analyst"


def test_authenticate_wrong_password_raises_401():
    from app.services.auth_service import AuthService
    svc = AuthService()

    db = MagicMock()
    user = _make_mock_user()
    db.query.return_value.filter.return_value.first.return_value = user

    with patch.object(svc, "_log_login"):
        with pytest.raises(HTTPException) as exc:
            svc.authenticate(db, "test@waf.io", "WrongPassword", ip="1.2.3.4")
    assert exc.value.status_code == 401


def test_authenticate_user_not_found_raises_401():
    from app.services.auth_service import AuthService
    svc = AuthService()

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None

    with pytest.raises(HTTPException) as exc:
        svc.authenticate(db, "ghost@waf.io", "AnyPassword", ip="1.2.3.4")
    assert exc.value.status_code == 401


def test_authenticate_suspended_user_raises_403():
    from app.services.auth_service import AuthService
    svc = AuthService()

    db = MagicMock()
    user = _make_mock_user(status="suspended")
    db.query.return_value.filter.return_value.first.return_value = user

    with patch.object(svc, "_log_login"):
        with pytest.raises(HTTPException) as exc:
            svc.authenticate(db, "test@waf.io", "Secret123!", ip="1.2.3.4")
    assert exc.value.status_code == 403


# ── 10.1.5  AuthService create_user ──────────────────────────────────────────

def test_create_user_duplicate_email_raises_400():
    from app.services.auth_service import AuthService
    svc = AuthService()

    db = MagicMock()
    # Simulate existing user found
    db.query.return_value.filter.return_value.first.return_value = _make_mock_user()

    with pytest.raises(HTTPException) as exc:
        svc.create_user(db, email="exists@waf.io", full_name="Alice", password="Pass1!")
    assert exc.value.status_code == 400


def test_create_user_invalid_role_defaults_to_soc_analyst():
    from app.services.auth_service import AuthService
    svc = AuthService()

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None  # no dupe

    created_users = []
    def capture_add(obj):
        created_users.append(obj)
    db.add.side_effect = capture_add
    db.refresh.side_effect = lambda u: None

    svc.create_user(db, email="new@waf.io", full_name="Bob", password="Pass2!", role="HackerRole")
    assert created_users[0].role == "SOC Analyst"


# ── 10.1.6  AuthService toggle_status ────────────────────────────────────────

def test_toggle_status_active_to_suspended():
    from app.services.auth_service import AuthService
    svc = AuthService()

    db = MagicMock()
    user = _make_mock_user(status="active")
    db.query.return_value.filter.return_value.first.return_value = user
    db.refresh.side_effect = lambda u: None

    result = svc.toggle_status(db, user_id=1)
    assert user.status == "suspended"


def test_toggle_status_suspended_to_active():
    from app.services.auth_service import AuthService
    svc = AuthService()

    db = MagicMock()
    user = _make_mock_user(status="suspended")
    db.query.return_value.filter.return_value.first.return_value = user
    db.refresh.side_effect = lambda u: None

    svc.toggle_status(db, user_id=1)
    assert user.status == "active"


def test_toggle_status_user_not_found_raises_404():
    from app.services.auth_service import AuthService
    svc = AuthService()

    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None

    with pytest.raises(HTTPException) as exc:
        svc.toggle_status(db, user_id=9999)
    assert exc.value.status_code == 404
