"""Firebase Admin SDK helper — lazy-initialized so we don't crash if creds missing."""
import os
import firebase_admin
from firebase_admin import credentials, auth as fb_auth

_app = None


def get_firebase_app():
    global _app
    if _app is not None:
        return _app
    if firebase_admin._apps:
        _app = list(firebase_admin._apps.values())[0]
        return _app
    path = os.environ.get("FIREBASE_ADMIN_JSON")
    if not path or not os.path.exists(path):
        raise RuntimeError("FIREBASE_ADMIN_JSON not configured")
    cred = credentials.Certificate(path)
    _app = firebase_admin.initialize_app(cred)
    return _app


def verify_id_token(id_token: str) -> dict:
    """Verify a Firebase ID token and return the decoded payload (uid, phone_number, ...)."""
    get_firebase_app()
    return fb_auth.verify_id_token(id_token, check_revoked=False)
