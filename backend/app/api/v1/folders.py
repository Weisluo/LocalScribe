# backend/app/api/v1/folders.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from pydantic import BaseModel

from app.models import Folder
from app.schemas import FolderCreate, FolderUpdate, FolderResponse
from app.core.dependencies import get_db

router = APIRouter()

# --- 移动/排序请求 Schema ---
class MoveFolderRequest(BaseModel):
    target_parent_id: Optional[str] = None  # 目标父文件夹 ID，None 表示移动到根目录
    new_order: int                         # 新的排序位置

# --- 获取项目下所有文件夹 ---
@router.get("/", response_model=List[FolderResponse])
def get_folders(project_id: str, db: Session = Depends(get_db)):
    """获取指定项目下的所有文件夹"""
    return db.query(Folder).filter(Folder.project_id == project_id).all()

# --- 创建文件夹 ---
@router.post("/", response_model=FolderResponse, status_code=201)
def create_folder(folder_in: FolderCreate, db: Session = Depends(get_db)):
    """创建文件夹"""
    # 如果没有传 order，默认放到最后
    if folder_in.order is None or folder_in.order == 0:
        count = db.query(Folder).filter(
            Folder.project_id == folder_in.project_id,
            Folder.parent_id == folder_in.parent_id
        ).count()
        folder_in.order = count + 1

    db_folder = Folder(**folder_in.model_dump())
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

# --- 更新文件夹信息（重命名等） ---
@router.put("/{folder_id}", response_model=FolderResponse)
def update_folder(folder_id: str, folder_in: FolderUpdate, db: Session = Depends(get_db)):
    """更新文件夹基本信息"""
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    update_data = folder_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_folder, key, value)
    
    db.commit()
    db.refresh(db_folder)
    return db_folder

# --- 移动/排序文件夹 ---
@router.put("/{folder_id}/move")
def move_folder(folder_id: str, request: MoveFolderRequest, db: Session = Depends(get_db)):
    """
    移动文件夹或调整顺序
    - target_parent_id: 新的父级ID (移动操作)
    - new_order: 新的排序位置 (排序操作)
    """
    # 1. 获取当前文件夹
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    old_parent_id = folder.parent_id
    new_parent_id = request.target_parent_id
    
    # 2. 校验移动逻辑 (业务规则)
    # 不能把卷移动到卷下面 (根据设计，卷只能在根目录)
    if folder.type == "volume" and new_parent_id is not None:
        raise HTTPException(status_code=400, detail="卷(Volume)只能位于根目录下，不能作为子文件夹")
    
    # 不能把自己移动到自己下面（防止死循环）
    if folder.id == new_parent_id:
        raise HTTPException(status_code=400, detail="不能将文件夹移动到自己内部")

    # 3. 更新父级 ID (如果是移动操作)
    if old_parent_id != new_parent_id:
        folder.parent_id = new_parent_id

    # 4. 处理排序逻辑
    # 简单策略：
    # 将目标位置及之后的同级文件夹 order + 1，腾出空位
    # 注意：这里需要根据新的父级ID来筛选同级
    
    # 构建查询同级文件夹的条件
    # 如果 new_parent_id 是 None，查询 parent_id IS NULL
    query = db.query(Folder).filter(Folder.project_id == folder.project_id)
    if new_parent_id:
        query = query.filter(Folder.parent_id == new_parent_id)
    else:
        query = query.filter(Folder.parent_id == None)

    # 排除自己
    siblings = query.filter(Folder.id != folder.id).all()
    
    # 简单的重排算法：
    # 找到所有 order >= new_order 的同级，将他们的 order + 1
    # 注意：这里为了简化，采用“腾出空位”法，实际生产中可能需要更严谨的 gap 锁或重算
    
    # 这里我们在内存中处理列表，以避免复杂的 SQL 更新
    # 实际上 SQLAlchemy 批量更新会更高效，这里演示逻辑
    affected_siblings = query.filter(Folder.order >= request.new_order).all()
    for sib in affected_siblings:
        sib.order += 1
    
    # 设置当前文件夹的新顺序
    folder.order = request.new_order

    db.commit()
    return {"success": True, "message": "移动成功"}

# --- 删除文件夹 ---
@router.delete("/{folder_id}")
def delete_folder(folder_id: str, db: Session = Depends(get_db)):
    """删除文件夹"""
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # 注意：级联删除由数据库模型定义中的 ondelete="CASCADE" 自动处理
    db.delete(db_folder)
    db.commit()
    return {"success": True}
