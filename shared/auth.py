from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
import jwt
import os
from datetime import datetime, timedelta
from passlib.context import CryptContext
from fastapi import HTTPException, Depends, Request
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

def get_current_user_id_from_header(request: Request):
    """Extract user ID from Authorization header"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    token = auth_header.split(" ")[1]
    payload = verify_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(user_id)

def get_current_user_from_header(request: Request):
    """Extract and validate user from Authorization header - FastAPI dependency"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    token = auth_header.split(" ")[1]
    payload = verify_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return int(user_id)

def get_current_user_with_role(request: Request):
    """Get current user with role information - FastAPI dependency"""
    user_id = get_current_user_from_header(request)
    
    # Get user from Redis cache first
    try:
        user_data = redis_client.get(f"user:{user_id}")
        if user_data:
            user_info = json.loads(user_data)
            return {
                "id": user_info["id"],
                "role": user_info["role"],
                "department_id": user_info.get("department_id"),
                "class_id": user_info.get("class_id")
            }
    except Exception:
        pass
    
    # If not in cache, return basic info with admin role for now
    return {
        "id": user_id,
        "role": "admin",  # Default for now
        "department_id": None,
        "class_id": None
    }

def get_current_user_id(request: Request):
    """Get current user ID from token - FastAPI dependency"""
    return get_current_user_from_header(request)

def get_current_user_info(request: Request):
    """Get current user info with role - FastAPI dependency"""
    return get_current_user_with_role(request)

def require_roles(allowed_roles: List[str]):
    """Create a dependency that requires specific roles"""
    def role_checker(user_info: dict = Depends(get_current_user_info)):
        if user_info["role"] not in allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied. Required roles: {allowed_roles}, User role: {user_info['role']}"
            )
        return user_info["id"]
    return role_checker

# Predefined role checkers for common use cases
def require_admin(user_info: dict = Depends(get_current_user_info)):
    return require_roles(["admin"])(user_info)

def require_admin_or_hod(user_info: dict = Depends(get_current_user_info)):
    return require_roles(["admin", "hod"])(user_info)

def require_admin_hod_or_teacher(user_info: dict = Depends(get_current_user_info)):
    return require_roles(["admin", "hod", "teacher"])(user_info)

def require_any_role(user_info: dict = Depends(get_current_user_info)):
    return require_roles(["admin", "hod", "teacher", "student"])(user_info)

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

class RoleChecker:
    """Role-based access control checker"""
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles
    
    def __call__(self, user_info: dict = Depends(get_current_user_info)):
        if user_info["role"] not in self.allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied. Required roles: {self.allowed_roles}, User role: {user_info['role']}"
            )
        return user_info["id"]