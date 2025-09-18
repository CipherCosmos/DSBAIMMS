from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
import jwt
import os
from datetime import datetime, timedelta
from passlib.context import CryptContext
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer
import redis
import json
from typing import Optional, List
from .permissions import PermissionChecker, Permission

JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-jwt-key")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Redis client for session management
redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user_id(token: str = Depends(security)):
    payload = verify_token(token.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(user_id)

class RoleChecker:
    def __init__(self, allowed_roles):
        self.allowed_roles = allowed_roles

    def __call__(self, user_id: int = Depends(get_current_user_id)):
        # For now, allow all authenticated users to access stats
        # In a production system, you would check the user's role from the database
        return user_id

class PermissionChecker:
    def __init__(self, required_permission: Permission, resource_type: str = None):
        self.required_permission = required_permission
        self.resource_type = resource_type

    def __call__(self, user_id: int = Depends(get_current_user_id)):
        # This would need to be enhanced to check actual user role from database
        # For now, return the user_id
        return user_id

def get_current_user_role(user_id: int) -> str:
    """Get current user's role from database"""
    # This would query the database for the user's role
    # For now, return admin as default
    return "admin"

def check_permission(user_role: str, permission: Permission, resource_department_id: int = None, user_department_id: int = None) -> bool:
    """Check if user has permission for specific action"""
    return PermissionChecker.has_permission(user_role, permission)

# Rate limiting
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

# OAuth2 setup
from fastapi.security import OAuth2PasswordBearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")