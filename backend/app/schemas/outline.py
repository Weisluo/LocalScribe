from datetime import datetime
from typing import List, Optional
from enum import Enum
from pydantic import BaseModel, ConfigDict


class EventType(str, Enum):
    normal = "normal"
    decision = "decision"
    milestone = "milestone"
    flashback = "flashback"
    flashforward = "flashforward"


class ConnectionType(str, Enum):
    direct = "direct"
    branch = "branch"
    parallel = "parallel"
    merge = "merge"
    loop = "loop"
    jump = "jump"


# ======== Event Connection Schemas ========

class EventConnectionBase(BaseModel):
    from_event_id: str
    to_event_id: str
    connection_type: ConnectionType = ConnectionType.direct
    label: Optional[str] = None
    condition: Optional[str] = None
    color: Optional[str] = None
    dashed: bool = False
    thickness: Optional[float] = None


class EventConnectionCreate(EventConnectionBase):
    pass


class EventConnectionUpdate(BaseModel):
    connection_type: Optional[ConnectionType] = None
    label: Optional[str] = None
    condition: Optional[str] = None
    color: Optional[str] = None
    dashed: Optional[bool] = None
    thickness: Optional[float] = None


class EventConnectionResponse(EventConnectionBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ======== Story Event Schemas ========

class StoryEventBase(BaseModel):
    title: str = ""
    content: str = ""
    event_type: EventType = EventType.normal
    characters: Optional[List[str]] = None
    location: Optional[str] = None
    timestamp: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    lane: Optional[int] = None


class StoryEventCreate(StoryEventBase):
    act_id: str
    project_id: str
    order: Optional[int] = None


class StoryEventUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    event_type: Optional[EventType] = None
    characters: Optional[List[str]] = None
    location: Optional[str] = None
    timestamp: Optional[str] = None
    order: Optional[int] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    lane: Optional[int] = None


class StoryEventResponse(StoryEventBase):
    id: str
    act_id: str
    project_id: str
    order: int
    created_at: datetime
    updated_at: datetime
    outgoing_connections: List[EventConnectionResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ======== Outline Data Schemas ========

class VolumeOutlineUpdate(BaseModel):
    outline_content: Optional[str] = None


class ChapterOutlineUpdate(BaseModel):
    outline_content: Optional[str] = None
    scene_count: Optional[int] = None
    outline_characters: Optional[List[str]] = None


class VolumeOutlineResponse(BaseModel):
    id: str
    name: str
    order: int
    outline_content: Optional[str] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChapterOutlineResponse(BaseModel):
    id: str
    title: str
    folder_id: str
    order: int
    outline_content: Optional[str] = None
    word_count: Optional[int] = 0
    scene_count: Optional[int] = 0
    outline_characters: Optional[List[str]] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActOutlineResponse(BaseModel):
    id: str
    name: str
    order: int
    chapters: List[ChapterOutlineResponse] = []

    model_config = ConfigDict(from_attributes=True)


class VolumeOutlineTreeResponse(BaseModel):
    id: str
    name: str
    order: int
    outline_content: Optional[str] = None
    acts: List[ActOutlineResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ProjectOutlineResponse(BaseModel):
    volumes: List[VolumeOutlineTreeResponse] = []


# ======== Act Events Response ========

class ActEventsResponse(BaseModel):
    act_id: str
    act_name: str
    volume_id: str
    events: List[StoryEventResponse] = []
    connections: List[EventConnectionResponse] = []


class ProjectEventsResponse(BaseModel):
    project_id: str
    events: List[StoryEventResponse] = []
