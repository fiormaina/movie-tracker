from fastapi import APIRouter

from app.api.routes import auth, library

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(library.router, prefix="/library", tags=["library"])
