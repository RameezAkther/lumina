from fastapi import APIRouter, HTTPException, status, Depends, Response
from app.schemas.user import UserCreate, UserResponse, Token, PasswordChange, DeleteAccountRequest
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user
from app.db.mongodb import get_database
from fastapi.security import OAuth2PasswordRequestForm
import random
from app.core.config import settings

router = APIRouter()

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(user: UserCreate, db=Depends(get_database)):
    # Check if user already exists
    existing_user = await db["users"].find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_dict = user.dict()
    user_dict["password"] = get_password_hash(user.password)
    # attach a random default profile picture
    user_dict["profil_pic"] = random.choice(settings.PROFILE_PICS)
    
    new_user = await db["users"].insert_one(user_dict)
    created_user = await db["users"].find_one({"_id": new_user.inserted_id})
    
    # Format _id to string for Pydantic response
    created_user["id"] = str(created_user["_id"])
    return created_user

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db=Depends(get_database)):
    # Note: OAuth2PasswordRequestForm expects 'username' field, even if you use email
    user = await db["users"].find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def read_current_user(current_user: dict = Depends(get_current_user)):
    """Return profile of the currently authenticated user."""
    current_user["id"] = str(current_user["_id"])
    return current_user


@router.put("/me/password")
async def change_password(payload: PasswordChange, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    """Change password for the authenticated user (requires current password)."""
    if not verify_password(payload.current_password, current_user["password"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    hashed = get_password_hash(payload.new_password)
    await db["users"].update_one({"_id": current_user["_id"]}, {"$set": {"password": hashed}})
    return {"msg": "password updated"}


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(payload: DeleteAccountRequest, current_user: dict = Depends(get_current_user), db=Depends(get_database)):
    """Delete authenticated user's account (requires password confirmation)."""
    if not verify_password(payload.password, current_user["password"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is incorrect")
    await db["users"].delete_one({"_id": current_user["_id"]})
    return Response(status_code=status.HTTP_204_NO_CONTENT)