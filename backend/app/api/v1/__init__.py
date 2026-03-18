# backend/app/api/v1/__init__.py
from fastapi import APIRouter
from .projects import router as projects_router
from .folders import router as folders_router
from .notes import router as notes_router
from .ai import router as ai_router
from .analysis import router as analysis_router
from .worldbuilding import router as worldbuilding_router
from .upload import router as upload_router

api_router = APIRouter()

api_router.include_router(projects_router, prefix="/projects", tags=["Projects"])
api_router.include_router(folders_router, prefix="/folders", tags=["Folders"])
api_router.include_router(notes_router, prefix="/notes", tags=["Notes"])
api_router.include_router(ai_router, prefix="/ai", tags=["AI Assistant"])
api_router.include_router(analysis_router, prefix="/analysis", tags=["Text Analysis"])
api_router.include_router(worldbuilding_router, prefix="/worldbuilding", tags=["World Building"])
api_router.include_router(upload_router, prefix="/upload", tags=["File Upload"])
