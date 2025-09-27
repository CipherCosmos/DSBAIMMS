from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
import json
import redis

from shared.auth import limiter, oauth2_scheme
from slowapi.middleware import SlowAPIMiddleware
from shared.database import get_db
from shared.models import User, AuditLog
from shared.auth import verify_password, create_access_token, create_refresh_token, get_password_hash
from pydantic import BaseModel

app = FastAPI(title="Auth Service", version="1.0.0")

# Initialize the limiter in app state
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
app.add_middleware(SlowAPIMiddleware)

redis_client = redis.from_url("redis://redis:6379")

from shared.schemas import UserLogin as LoginRequest, TokenResponse, UserResponse
from pydantic import BaseModel

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

def log_audit(db: Session, user_id: int, action: str, table_name: str, record_id: int = None,
              old_values: dict = None, new_values: dict = None, request: Request = None):
    audit_log = AuditLog(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_values=json.dumps(old_values) if old_values else None,
        new_values=json.dumps(new_values) if new_values else None,
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get("user-agent") if request else None
    )
    db.add(audit_log)
    db.commit()

@app.post("/login", response_model=TokenResponse)
async def login(login_data: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_data.username).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Use bcrypt verification for all users
    if not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account deactivated")

    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()

    # Create tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    # Cache user data in Redis
    user_data = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "department_id": user.department_id,
        "class_id": user.class_id,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }
    redis_client.setex(f"user:{user.id}", 3600, json.dumps(user_data))

    # Log audit
    log_audit(db, user.id, "LOGIN", "users", user.id, request=request)

    # Set HTTP cookies for authentication
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=False,  # Allow JavaScript access for middleware
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        domain="localhost",  # Set domain to localhost for cross-port access
        max_age=3600  # 1 hour
    )
    response.set_cookie(
        key="refresh_token", 
        value=refresh_token,
        httponly=True,  # Keep refresh token httponly for security
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        domain="localhost",  # Set domain to localhost for cross-port access
        max_age=604800  # 7 days
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_data
    )

@app.post("/token", response_model=TokenResponse)
@limiter.limit("5/minute")
async def get_token(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    """OAuth2 compatible token endpoint with rate limiting"""
    return await login(login_data, request, db)

@app.get("/verify-token")
async def verify_token_endpoint(token: str = Depends(oauth2_scheme)):
    """Verify OAuth2 token"""
    from shared.auth import verify_token
    payload = verify_token(token)
    return {"valid": True, "user_id": payload.get("sub")}

@app.get("/me", response_model=UserResponse)
async def get_current_user(request: Request, db: Session = Depends(get_db)):
    # Extract token from Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    token = auth_header.split(" ")[1]

    from shared.auth import verify_token
    payload = verify_token(token)
    user_id = payload.get("sub")

    # Try to get user from cache first
    user_data = redis_client.get(f"user:{user_id}")
    if user_data:
        return UserResponse(**json.loads(user_data))

    # Get from database if not in cache
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_dict = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "department_id": user.department_id,
        "class_id": user.class_id,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }

    # Cache for future requests
    redis_client.setex(f"user:{user.id}", 3600, json.dumps(user_dict))

    return UserResponse(**user_dict)

@app.post("/logout")
async def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    # Extract user ID from token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            from shared.auth import verify_token
            payload = verify_token(token)
            user_id = payload.get("sub")

            # Remove from cache
            redis_client.delete(f"user:{user_id}")

            # Log audit
            log_audit(db, int(user_id), "LOGOUT", "users", int(user_id), request=request)
        except:
            pass

    # Clear authentication cookies
    response.delete_cookie(key="access_token")
    response.delete_cookie(key="refresh_token")

    return {"message": "Logged out successfully"}

@app.post("/refresh-token", response_model=TokenResponse)
async def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    """Refresh access token using refresh token"""
    # Get refresh token from cookie
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token not found")
    
    try:
        from shared.auth import verify_token
        payload = verify_token(refresh_token)
        
        # Verify it's a refresh token
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")
        
        # Create new access token
        new_access_token = create_access_token(data={"sub": str(user.id)})
        
        # Update user data in cache
        user_data = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "department_id": user.department_id,
            "class_id": user.class_id,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None
        }
        redis_client.setex(f"user:{user.id}", 3600, json.dumps(user_data))
        
        # Set new access token cookie
        response.set_cookie(
            key="access_token",
            value=new_access_token,
            httponly=False,
            secure=False,
            samesite="lax",
            domain="localhost",
            max_age=3600
        )
        
        return TokenResponse(
            access_token=new_access_token,
            refresh_token=refresh_token,  # Keep the same refresh token
            user=user_data
        )
        
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@app.post("/change-password")
async def change_password(
    password_data: PasswordChangeRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    # Extract user ID from token
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    token = auth_header.split(" ")[1]
    from shared.auth import verify_token
    payload = verify_token(token)
    user_id = payload.get("sub")

    # Get user from database
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify current password
    if not verify_password(password_data.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Validate new password
    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long")

    # Update password
    user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()

    # Log audit
    log_audit(db, user.id, "PASSWORD_CHANGE", "users", user.id, request=request)

    return {"message": "Password changed successfully"}

@app.get("/health")
async def health_check():
    # Hot reload test - this comment should trigger auto-restart
    return {"status": "healthy", "service": "auth"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8010)