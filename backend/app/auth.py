import json

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings

security = HTTPBearer()


def _get_jwt_key():
    """Return the JWT verification key. Supports both ES256 (JWK) and HS256 (plain string)."""
    secret = settings.supabase_jwt_secret
    if secret.strip().startswith("{"):
        return json.loads(secret)
    return secret


def _get_jwt_algorithm():
    secret = settings.supabase_jwt_secret
    if secret.strip().startswith("{"):
        jwk = json.loads(secret)
        return jwk.get("alg", "ES256")
    return "HS256"


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Validate Supabase JWT and return user_id."""
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            _get_jwt_key(),
            algorithms=[_get_jwt_algorithm()],
            audience="authenticated",
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject",
            )
        return user_id
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
