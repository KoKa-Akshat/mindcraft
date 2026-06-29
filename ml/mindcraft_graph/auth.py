# ml/mindcraft_graph/auth.py
#
# Authentication + authorization for the mindcraft-ml API.
#
# Two trusted caller classes:
#   1. Browser (React app) — sends a Firebase ID token as `Authorization:
#      Bearer <token>`. We verify it and bind the request to the caller's uid,
#      then enforce that a user may only touch their OWN student_id (tutors and
#      admins are exempt, since they read other students' graphs).
#   2. Backend (the Vercel webhook) — sends a private `X-Service-Key`. It runs
#      with no end-user token, so it presents the shared secret and acts as the
#      system (bypasses the per-student ownership check).
#
# Tokens are minted by the Firebase project `mindcraft-93858`, but this service
# runs in a DIFFERENT GCP project, so the Admin SDK must be initialized with the
# Firebase project id explicitly or `verify_id_token` rejects the token's `aud`.
#
# Local dev: set ML_AUTH_ENABLED=false to disable all checks.

import hmac
import os
from dataclasses import dataclass

from fastapi import Header, HTTPException

AUTH_ENABLED = os.getenv("ML_AUTH_ENABLED", "true").lower() not in ("false", "0", "no")
FIREBASE_PROJECT = os.getenv("FIREBASE_PROJECT") or "mindcraft-93858"
SERVICE_SECRET = os.getenv("ML_SERVICE_SECRET")

_PRIVILEGED_ROLES = {"tutor", "admin"}

_fb_ready = False
if AUTH_ENABLED:
    try:
        import firebase_admin

        if not firebase_admin._apps:
            # No credential needed: token verification only fetches Google's
            # public certs. The project id pins the expected `aud`/`iss`.
            firebase_admin.initialize_app(options={"projectId": FIREBASE_PROJECT})
        _fb_ready = True
    except Exception as exc:  # pragma: no cover - depends on runtime env
        print(f"[auth] firebase-admin init failed; token auth disabled: {exc}")
        _fb_ready = False


@dataclass
class AuthContext:
    uid: str | None
    is_service: bool


def _verify_firebase_token(token: str) -> str | None:
    if not _fb_ready:
        return None
    try:
        from firebase_admin import auth as fb_auth

        decoded = fb_auth.verify_id_token(token)
        return decoded.get("uid")
    except Exception:
        return None


async def require_auth(
    authorization: str | None = Header(default=None),
    x_service_key: str | None = Header(default=None, alias="X-Service-Key"),
) -> AuthContext:
    """FastAPI dependency. Returns the authenticated caller or raises 401."""
    if not AUTH_ENABLED:
        return AuthContext(uid=None, is_service=True)

    # Trusted backend (constant-time compare avoids timing leaks).
    if SERVICE_SECRET and x_service_key and hmac.compare_digest(x_service_key, SERVICE_SECRET):
        return AuthContext(uid=None, is_service=True)

    # End user — verified Firebase ID token.
    if authorization and authorization.startswith("Bearer "):
        uid = _verify_firebase_token(authorization[7:])
        if uid:
            return AuthContext(uid=uid, is_service=False)

    raise HTTPException(status_code=401, detail="Unauthorized")


def _role_for(uid: str) -> str | None:
    try:
        from mindcraft_graph.firestore_adapter import db

        snap = db.collection("users").document(uid).get()
        if snap.exists:
            return (snap.to_dict() or {}).get("role")
    except Exception:
        pass
    return None


def authorize_student(auth: AuthContext, student_id: str) -> None:
    """Allow the request only if the caller IS this student, a trusted backend,
    or a tutor/admin. Otherwise raise 403. Fail-closed: an unknown caller or a
    missing/empty student_id is denied."""
    if auth.is_service:
        return
    if auth.uid and student_id and auth.uid == student_id:
        return
    if auth.uid and _role_for(auth.uid) in _PRIVILEGED_ROLES:
        return
    raise HTTPException(status_code=403, detail="Forbidden")
