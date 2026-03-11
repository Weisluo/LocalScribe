# backend/app/api/v1/projects.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

# 导入模型、Schema 和依赖
from app.models import Project
from app.schemas import ProjectCreate, ProjectUpdate, ProjectResponse
from app.schemas import DirectoryTree 
from app.core.dependencies import get_db
from app.services.directory_service import DirectoryService


router = APIRouter()

# --- 获取项目列表 ---
@router.get("/", response_model=List[ProjectResponse])
def get_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()

# --- 创建新项目 ---
@router.post("/", response_model=ProjectResponse, status_code=201)
def create_project(project_in: ProjectCreate, db: Session = Depends(get_db)):
    # 创建数据库对象
    db_project = Project(**project_in.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

# --- 获取单个项目 ---
@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db_project

# --- 更新项目 ---
@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, project_in: ProjectUpdate, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 更新字段（只更新传入的字段）
    update_data = project_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_project, key, value)
    
    db.commit()
    db.refresh(db_project)
    return db_project

# --- 删除项目 ---
@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(db_project)
    db.commit()
    return {"success": True}

# 获取项目的目录树
@router.get("/{project_id}/tree", response_model=DirectoryTree)
def get_project_tree(project_id: str, db: Session = Depends(get_db)):
    """获取项目的目录树结构"""
    tree = DirectoryService.build_tree(project_id, db)
    return tree