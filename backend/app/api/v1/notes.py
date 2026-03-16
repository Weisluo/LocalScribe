# backend/app/api/v1/notes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from pydantic import BaseModel
import copy
from datetime import datetime

from app.models import Note
from app.schemas import NoteCreate, NoteUpdate, NoteResponse
from app.core.dependencies import get_db
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()

# --- 定义额外的请求 Schema ---

class BatchDeleteRequest(BaseModel):
    ids: List[str]

class MoveNoteRequest(BaseModel):
    target_folder_id: str  # 目标文件夹 ID
    new_order: int         # 新的排序位置

class RestoreNoteRequest(BaseModel):
    folder_id: Optional[str] = None  # 恢复时指定的目标文件夹，不传则使用原文件夹

# --- 接口实现 ---

@router.get("/", response_model=List[NoteResponse])
def get_notes(folder_id: str = None, project_id: str = None, include_deleted: bool = False, db: Session = Depends(get_db)):
    """获取章节列表，支持按文件夹或项目筛选"""
    logger.info(f"Getting notes - folder_id={folder_id}, project_id={project_id}, include_deleted={include_deleted}")
    query = db.query(Note)
    
    if not include_deleted:
        query = query.filter(Note.deleted_at.is_(None))
    
    if folder_id:
        query = query.filter(Note.folder_id == folder_id)
    if project_id:
        query = query.filter(Note.project_id == project_id)
    result = query.all()
    logger.debug(f"Found {len(result)} notes")
    return result

@router.get("/deleted", response_model=List[NoteResponse])
def get_deleted_notes(project_id: str, db: Session = Depends(get_db)):
    """获取回收站中的笔记列表（按项目筛选）"""
    return db.query(Note).filter(
        and_(
            Note.deleted_at.isnot(None),
            Note.project_id == project_id
        )
    ).all()

@router.get("/{note_id}", response_model=NoteResponse)
def get_note(note_id: str, db: Session = Depends(get_db)):
    """获取单个章节详情"""
    db_note = db.query(Note).filter(Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    return db_note

@router.post("/", response_model=NoteResponse, status_code=201)
def create_note(note_in: NoteCreate, db: Session = Depends(get_db)):
    """创建章节"""
    logger.info(f"Creating note: {note_in.title} in folder {note_in.folder_id}")
    
    if note_in.order is None or note_in.order == 0:
        count = db.query(Note).filter(Note.folder_id == note_in.folder_id).count()
        note_in.order = count + 1

    db_note = Note(**note_in.model_dump())
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    logger.info(f"Note created successfully: id={db_note.id}, title={db_note.title}")
    return db_note

@router.put("/{note_id}", response_model=NoteResponse)
def update_note(note_id: str, note_in: NoteUpdate, db: Session = Depends(get_db)):
    """更新章节内容"""
    logger.info(f"Updating note: {note_id}")
    db_note = db.query(Note).filter(Note.id == note_id).first()
    if not db_note:
        logger.warning(f"Note not found: {note_id}")
        raise HTTPException(status_code=404, detail="Note not found")

    update_data = note_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_note, key, value)

    if "content" in update_data and update_data["content"] is not None:
        import re
        text = re.sub(r'<[^>]+>', '', update_data["content"])
        db_note.word_count = len(text)

    db.commit()
    db.refresh(db_note)
    logger.info(f"Note updated: {note_id}, word_count={db_note.word_count}")
    return db_note

@router.delete("/{note_id}")
def delete_note(note_id: str, permanent: bool = False, db: Session = Depends(get_db)):
    """删除单个章节（软删除或永久删除）"""
    logger.info(f"Deleting note: {note_id}, permanent={permanent}")
    db_note = db.query(Note).filter(Note.id == note_id).first()
    if not db_note:
        logger.warning(f"Note not found for deletion: {note_id}")
        raise HTTPException(status_code=404, detail="Note not found")
    
    if permanent:
        db.delete(db_note)
        logger.info(f"Note permanently deleted: {note_id}")
    else:
        if db_note.deleted_at is None:
            db_note.deleted_at = datetime.utcnow()
            logger.info(f"Note soft deleted: {note_id}")
    
    db.commit()
    return {"success": True}

# --- 进阶功能 ---

@router.post("/batch-delete")
def batch_delete_notes(request: BatchDeleteRequest, permanent: bool = False, db: Session = Depends(get_db)):
    """批量删除章节（软删除或永久删除）"""
    if not request.ids:
        return {"success": True, "deleted_count": 0}
    
    if permanent:
        # 永久删除
        deleted_count = db.query(Note).filter(Note.id.in_(request.ids)).delete(synchronize_session=False)
    else:
        # 软删除：只处理未删除的记录
        result = db.query(Note).filter(
            Note.id.in_(request.ids),
            Note.deleted_at.is_(None)
        ).update({
            "deleted_at": datetime.utcnow()
        }, synchronize_session=False)
        deleted_count = result.rowcount
    
    db.commit()
    return {"success": True, "deleted_count": deleted_count}

@router.post("/{note_id}/copy", response_model=NoteResponse, status_code=201)
def copy_note(note_id: str, db: Session = Depends(get_db)):
    """复制章节"""
    original = db.query(Note).filter(Note.id == note_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # 创建新对象，复制属性，排除 ID 和时间戳
    new_note_data = {
        "title": f"{original.title} (副本)",
        "content": original.content,
        "folder_id": original.folder_id,
        "project_id": original.project_id,
        "order": original.order + 1, # 简单处理：排在原文之后
        "tags": copy.deepcopy(original.tags),
        "status": original.status
    }
    
    new_note = Note(**new_note_data)
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return new_note

@router.put("/{note_id}/move")
def move_note(note_id: str, request: MoveNoteRequest, db: Session = Depends(get_db)):
    """移动章节到新文件夹或调整顺序（排序）"""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # 1. 更新文件夹 ID (移动逻辑)
    note.folder_id = request.target_folder_id
    
    # 2. 排序逻辑
    # 将目标位置及之后的同级章节 order + 1，腾出空位
    db.query(Note).filter(
        Note.folder_id == request.target_folder_id,
        Note.order >= request.new_order,
        Note.id != note_id  # 排除自己
    ).update({"order": Note.order + 1})
    
    # 3. 设置当前章节的新顺序
    note.order = request.new_order
    
    db.commit()
    return {"success": True, "message": "移动/排序成功"}

@router.post("/{note_id}/restore", response_model=NoteResponse)
def restore_note(note_id: str, request: Optional[RestoreNoteRequest] = None, db: Session = Depends(get_db)):
    """恢复已删除的笔记"""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if not note.deleted_at:
        raise HTTPException(status_code=400, detail="Note is not deleted")
    
    # 清除删除标记
    note.deleted_at = None
    
    # 如果指定了新的文件夹，更新文件夹 ID
    if request and request.folder_id:
        note.folder_id = request.folder_id
    
    db.commit()
    db.refresh(note)
    return note

@router.post("/batch-restore")
def batch_restore_notes(request: BatchDeleteRequest, db: Session = Depends(get_db)):
    """批量恢复已删除的笔记"""
    if not request.ids:
        return {"success": True, "restored_count": 0}
    
    restored_count = db.query(Note).filter(
        Note.id.in_(request.ids),
        Note.deleted_at.isnot(None)
    ).update({
        "deleted_at": None
    }, synchronize_session=False)
    
    db.commit()
    return {"success": True, "restored_count": restored_count}
