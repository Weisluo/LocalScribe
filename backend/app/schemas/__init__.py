# backend/app/schemas/__init__.py
from .project import ProjectCreate, ProjectUpdate, ProjectResponse
from .folder import FolderCreate, FolderUpdate, FolderResponse
from .note import NoteCreate, NoteUpdate, NoteResponse
from .directory import VolumeNode, ActNode, NoteNode, DirectoryTree
from .ai import AIGenerateRequest, AIGenerateResponse
from .analysis import (
    SegmentationRequest, SegmentationResponse, WordItem,
    SegmentedWordItem, RawSegmentationResponse,
    TextStatisticsRequest, TextStatisticsResponse,
    KeywordExtractRequest, KeywordExtractResponse, KeywordItem,
    TextSimilarityRequest, TextSimilarityResponse
)

__all__ = [
    "ProjectCreate", "ProjectUpdate", "ProjectResponse",
    "FolderCreate", "FolderUpdate", "FolderResponse",
    "NoteCreate", "NoteUpdate", "NoteResponse",
    "VolumeNode", "ActNode", "NoteNode", "DirectoryTree",
    "AIGenerateRequest", "AIGenerateResponse",
    "SegmentationRequest", "SegmentationResponse", "WordItem",
    "SegmentedWordItem", "RawSegmentationResponse",
    "TextStatisticsRequest", "TextStatisticsResponse",
    "KeywordExtractRequest", "KeywordExtractResponse", "KeywordItem",
    "TextSimilarityRequest", "TextSimilarityResponse"
]
