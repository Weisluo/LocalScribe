# backend/app/api/__init__.py
from fastapi import APIRouter
from .v1 import api_router

# 这一层是为了未来可能有 v2 版本预留
router = APIRouter()
router.include_router(api_router, prefix="/v1")
