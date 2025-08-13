"""
Authentication router
"""
from fastapi import APIRouter, HTTPException, Depends, status
from ..db import execute_one
from ..security import verify_password, create_access_token, get_current_user
from ..schemas import LoginRequest, TokenResponse, UserResponse

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Authenticate user and return JWT token"""
    
    # Query user with their grower details
    query = """
        SELECT u.id, u.email, u.role, u.tenant_id, u.grower_id, u.password,
               g.name as grower_name
        FROM users u
        LEFT JOIN growers g ON u.grower_id = g.id
        WHERE u.email = $1
    """
    
    user = await execute_one(query, request.email)
    
    if not user or not verify_password(request.password, user['password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Create JWT token with user information
    token_data = {
        "sub": str(user['id']),
        "email": user['email'],
        "role": user['role'],
        "tenant_id": str(user['tenant_id']),
        "grower_id": str(user['grower_id']) if user['grower_id'] else None,
        "grower_name": user['grower_name']
    }
    
    token = create_access_token(token_data)
    
    return TokenResponse(access_token=token)

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(
        id=current_user["sub"],
        email=current_user["email"],
        role=current_user["role"],
        tenant_id=current_user["tenant_id"],
        grower_id=current_user.get("grower_id")
    )