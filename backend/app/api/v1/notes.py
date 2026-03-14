# backend/app/api/v1/notes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from pydantic import BaseModel
import copy

from app.models import Note
from app.schemas import NoteCreate, NoteUpdate, NoteResponse
from app.core.dependencies import get_db

router = APIRouter()

# --- 定义额外的请求 Schema ---

class BatchDeleteRequest(BaseModel):
    ids: List[str]

class MoveNoteRequest(BaseModel):
    target_folder_id: str  # 目标文件夹 ID
    new_order: int         # 新的排序位置

# --- 接口实现 ---

@router.get("/", response_model=List[NoteResponse])
def get_notes(folder_id: str = None, project_id: str = None, db: Session = Depends(get_db)):
    """获取章节列表，支持按文件夹或项目筛选"""
    query = db.query(Note)
    if folder_id:
        query = query.filter(Note.folder_id == folder_id)
    if project_id:
        query = query.filter(Note.project_id == project_id)
    return query.all()

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
    
    # --- 自动排序逻辑 ---
    # 如果前端没有传 order，或者传了 0 (Schema 默认值)，则自动计算
    if note_in.order is None or note_in.order == 0:
        # 统计当前文件夹下的章节数量
        count = db.query(Note).filter(Note.folder_id == note_in.folder_id).count()
        note_in.order = count + 1
    # ------------------------

    db_note = Note(**note_in.model_dump())
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note

@router.put("/{note_id}", response_model=NoteResponse)
def update_note(note_id: str, note_in: NoteUpdate, db: Session = Depends(get_db)):
    """更新章节内容"""
    db_note = db.query(Note).filter(Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    update_data = note_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_note, key, value)
    
    db.commit()
    db.refresh(db_note)
    return db_note

@router.delete("/{note_id}")
def delete_note(note_id: str, db: Session = Depends(get_db)):
    """删除单个章节"""
    db_note = db.query(Note).filter(Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(db_note)
    db.commit()
    return {"success": True}

# --- 进阶功能 ---

@router.post("/batch-delete")
def batch_delete_notes(request: BatchDeleteRequest, db: Session = Depends(get_db)):
    """批量删除章节"""
    if not request.ids:
        return {"success": True, "deleted_count": 0}
        
    deleted_count = db.query(Note).filter(Note.id.in_(request.ids)).delete(synchronize_session=False)
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
