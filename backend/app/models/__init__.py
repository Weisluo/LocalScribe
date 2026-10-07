from datetime import datetime

from sqlalchemy import MetaData

from app.core.database import Base

convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=convention)

Base.metadata = metadata

from .character import (
    Character,
    CharacterAlias,
    CharacterArtifact,
    CharacterCard,
    CharacterRelationship,
)
from .folder import Folder
from .note import Note
from .outline import EventConnection, StoryEvent
from .project import Project
from .relation import WorldLink
from .worldbuilding import (
    DEFAULT_MODULE_SPECS,
    World,
    WorldModule,
    WorldModuleItem,
    WorldSubmodule,
)

__all__ = [
    "Base",
    "Project",
    "Folder",
    "Note",
    "World",
    "WorldModule",
    "WorldSubmodule",
    "WorldModuleItem",
    "DEFAULT_MODULE_SPECS",
    "WorldLink",
    "Character",
    "CharacterAlias",
    "CharacterCard",
    "CharacterRelationship",
    "CharacterArtifact",
    "StoryEvent",
    "EventConnection",
]
