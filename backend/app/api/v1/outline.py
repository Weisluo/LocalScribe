import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.core.dependencies import get_db
from app.models.folder import Folder, FolderType
from app.models.note import Note
from app.models.outline import StoryEvent, EventConnection
from app.schemas.outline import (
    ProjectOutlineResponse, VolumeOutlineTreeResponse, ActOutlineResponse,
    ChapterOutlineResponse, VolumeOutlineUpdate, VolumeOutlineResponse,
    ChapterOutlineUpdate, ChapterOutlineResponse,
    StoryEventCreate, StoryEventUpdate, StoryEventResponse,
    EventConnectionCreate, EventConnectionUpdate, EventConnectionResponse,
    ActEventsResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ======== Project Outline Tree ========

@router.get("/projects/{project_id}/outline", response_model=ProjectOutlineResponse)
def get_project_outline(project_id: str, db: Session = Depends(get_db)):
    """获取项目的完整大纲数据（卷-幕-章层级）"""
    volumes = (
        db.query(Folder)
        .filter(Folder.project_id == project_id, Folder.type == FolderType.volume)
        .order_by(Folder.order)
        .all()
    )

    result_volumes = []
    for volume in volumes:
        acts = (
            db.query(Folder)
            .filter(Folder.parent_id == volume.id, Folder.type == FolderType.act)
            .order_by(Folder.order)
            .all()
        )

        result_acts = []
        for act in acts:
            chapters = (
                db.query(Note)
                .filter(Note.folder_id == act.id, Note.deleted_at.is_(None))
                .order_by(Note.order)
                .all()
            )
            result_acts.append(ActOutlineResponse(
                id=act.id,
                name=act.name,
                order=act.order,
                chapters=[ChapterOutlineResponse(
                    id=ch.id,
                    title=ch.title,
                    folder_id=ch.folder_id,
                    order=ch.order,
                    outline_content=ch.outline_content,
                    word_count=ch.word_count,
                    scene_count=ch.scene_count or 0,
                    outline_characters=ch.outline_characters,
                    updated_at=ch.updated_at,
                ) for ch in chapters],
            ))

        result_volumes.append(VolumeOutlineTreeResponse(
            id=volume.id,
            name=volume.name,
            order=volume.order,
            outline_content=volume.outline_content,
            acts=result_acts,
        ))

    return ProjectOutlineResponse(volumes=result_volumes)


# ======== Volume Outline ========

@router.put("/volumes/{volume_id}/outline", response_model=VolumeOutlineResponse)
def update_volume_outline(volume_id: str, data: VolumeOutlineUpdate, db: Session = Depends(get_db)):
    """更新卷大纲内容"""
    volume = db.query(Folder).filter(Folder.id == volume_id, Folder.type == FolderType.volume).first()
    if not volume:
        raise HTTPException(status_code=404, detail="卷不存在")

    if data.outline_content is not None:
        volume.outline_content = data.outline_content

    db.commit()
    db.refresh(volume)
    logger.info(f"已更新卷大纲: {volume.name} (ID: {volume_id})")

    return VolumeOutlineResponse(
        id=volume.id,
        name=volume.name,
        order=volume.order,
        outline_content=volume.outline_content,
        updated_at=volume.updated_at,
    )


# ======== Chapter Outline ========

@router.put("/notes/{note_id}/outline", response_model=ChapterOutlineResponse)
def update_chapter_outline(note_id: str, data: ChapterOutlineUpdate, db: Session = Depends(get_db)):
    """更新章节大纲内容"""
    note = db.query(Note).filter(Note.id == note_id, Note.deleted_at.is_(None)).first()
    if not note:
        raise HTTPException(status_code=404, detail="章节不存在")

    if data.outline_content is not None:
        note.outline_content = data.outline_content
    if data.scene_count is not None:
        note.scene_count = data.scene_count
    if data.outline_characters is not None:
        note.outline_characters = data.outline_characters

    db.commit()
    db.refresh(note)
    logger.info(f"已更新章节大纲: {note.title} (ID: {note_id})")

    return ChapterOutlineResponse(
        id=note.id,
        title=note.title,
        folder_id=note.folder_id,
        order=note.order,
        outline_content=note.outline_content,
        word_count=note.word_count,
        scene_count=note.scene_count or 0,
        outline_characters=note.outline_characters,
        updated_at=note.updated_at,
    )


# ======== Story Events ========

@router.get("/acts/{act_id}/events", response_model=ActEventsResponse)
def get_act_events(act_id: str, db: Session = Depends(get_db)):
    """获取幕下的所有事件及连接"""
    act = db.query(Folder).filter(Folder.id == act_id, Folder.type == FolderType.act).first()
    if not act:
        raise HTTPException(status_code=404, detail="幕不存在")

    events = (
        db.query(StoryEvent)
        .filter(StoryEvent.act_id == act_id)
        .options(joinedload(StoryEvent.outgoing_connections))
        .order_by(StoryEvent.order)
        .all()
    )

    # 收集所有事件ID
    event_ids = [e.id for e in events]

    # 获取所有相关连接
    connections = (
        db.query(EventConnection)
        .filter(
            EventConnection.from_event_id.in_(event_ids),
            EventConnection.to_event_id.in_(event_ids),
        )
        .all()
    ) if event_ids else []

    return ActEventsResponse(
        act_id=act.id,
        act_name=act.name,
        volume_id=act.parent_id or "",
        events=[StoryEventResponse.model_validate(e) for e in events],
        connections=[EventConnectionResponse.model_validate(c) for c in connections],
    )


@router.post("/acts/{act_id}/events", response_model=StoryEventResponse)
def create_event(act_id: str, data: StoryEventCreate, db: Session = Depends(get_db)):
    """创建事件"""
    act = db.query(Folder).filter(Folder.id == act_id, Folder.type == FolderType.act).first()
    if not act:
        raise HTTPException(status_code=404, detail="幕不存在")

    # 自动计算排序
    if data.order is None:
        max_order = db.query(StoryEvent).filter(StoryEvent.act_id == act_id).count()
        data.order = max_order

    event = StoryEvent(
        act_id=act_id,
        project_id=data.project_id,
        title=data.title,
        content=data.content,
        event_type=data.event_type,
        characters=data.characters,
        location=data.location,
        timestamp=data.timestamp,
        order=data.order,
        position_x=data.position_x,
        position_y=data.position_y,
        lane=data.lane,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    logger.info(f"已创建事件: {event.title} (ID: {event.id}, 幕: {act_id})")

    return StoryEventResponse.model_validate(event)


@router.put("/events/{event_id}", response_model=StoryEventResponse)
def update_event(event_id: str, data: StoryEventUpdate, db: Session = Depends(get_db)):
    """更新事件"""
    event = db.query(StoryEvent).filter(StoryEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="事件不存在")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(event, key, value)

    db.commit()
    db.refresh(event)
    logger.info(f"已更新事件: {event.title} (ID: {event_id})")

    return StoryEventResponse.model_validate(event)


@router.delete("/events/{event_id}")
def delete_event(event_id: str, db: Session = Depends(get_db)):
    """删除事件（同时删除相关连接）"""
    event = db.query(StoryEvent).filter(StoryEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="事件不存在")

    db.delete(event)
    db.commit()
    logger.info(f"已删除事件: {event.title} (ID: {event_id})")

    return {"message": "事件已删除"}


# ======== Event Connections ========

@router.post("/connections", response_model=EventConnectionResponse)
def create_connection(data: EventConnectionCreate, db: Session = Depends(get_db)):
    """创建事件连接"""
    # 验证事件存在
    from_event = db.query(StoryEvent).filter(StoryEvent.id == data.from_event_id).first()
    to_event = db.query(StoryEvent).filter(StoryEvent.id == data.to_event_id).first()
    if not from_event or not to_event:
        raise HTTPException(status_code=404, detail="源事件或目标事件不存在")

    connection = EventConnection(
        from_event_id=data.from_event_id,
        to_event_id=data.to_event_id,
        connection_type=data.connection_type,
        label=data.label,
        condition=data.condition,
        color=data.color,
        dashed=data.dashed,
        thickness=data.thickness,
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)
    logger.info(f"已创建连接: {data.from_event_id} -> {data.to_event_id}")

    return EventConnectionResponse.model_validate(connection)


@router.put("/connections/{connection_id}", response_model=EventConnectionResponse)
def update_connection(connection_id: str, data: EventConnectionUpdate, db: Session = Depends(get_db)):
    """更新连接"""
    connection = db.query(EventConnection).filter(EventConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="连接不存在")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(connection, key, value)

    db.commit()
    db.refresh(connection)
    return EventConnectionResponse.model_validate(connection)


@router.delete("/connections/{connection_id}")
def delete_connection(connection_id: str, db: Session = Depends(get_db)):
    """删除连接"""
    connection = db.query(EventConnection).filter(EventConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="连接不存在")

    db.delete(connection)
    db.commit()
    return {"message": "连接已删除"}
