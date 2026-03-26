from datetime import datetime
from sqlalchemy import MetaData

from app.core.database import Base

convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

metadata = MetaData(naming_convention=convention)

Base.metadata = metadata

from .project import Project
from .folder import Folder
from .note import Note
from .worldbuilding import WorldTemplate, WorldModule, WorldSubmodule, WorldModuleItem, WorldInstance, CustomWorldviewConfig
from .relation import BidirectionalRelation
from .character import Character, CharacterAlias, CharacterCard, CharacterRelationship, CharacterArtifact

__all__ = [
    "Base",
    "Project",
    "Folder",
    "Note",
    "WorldTemplate",
    "WorldModule",
    "WorldSubmodule",
    "WorldModuleItem",
    "WorldInstance",
    "CustomWorldviewConfig",
    "BidirectionalRelation",
    "Character",
    "CharacterAlias",
    "CharacterCard",
    "CharacterRelationship",
    "CharacterArtifact",
]
