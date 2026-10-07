# backend/app/api/v1/worldbuilding.py
"""世界模块 / 子模块 / 模块项 API（契约 §2.2/§2.3/§2.4）

Phase 6 P6-T10：旧 /templates、/instances、/worldviews 路由与旧模型全部下架（404），
本文件只保留世界内部结构的读写：
- PUT    /modules/{module_id}
- GET    /modules/{module_id}/submodules
- POST   /modules/{module_id}/submodules
- GET    /modules/{module_id}/items
- POST   /modules/{module_id}/items
- PUT    /items/{item_id}
- DELETE /items/{item_id}
- PUT    /submodules/{submodule_id}
- DELETE /submodules/{submodule_id}

世界本身的 CRUD / 导出 / 恢复在 /worlds（worlds.py），关联在 /worlds/{id}/links。
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.logging import get_logger
from app.models import WorldModule, WorldModuleItem, WorldSubmodule
from app.schemas.worldbuilding import (
    WorldModuleItemCreate,
    WorldModuleItemResponse,
    WorldModuleItemUpdate,
    WorldModuleResponse,
    WorldModuleUpdate,
    WorldSubmoduleCreate,
    WorldSubmoduleResponse,
    WorldSubmoduleUpdate,
)

logger = get_logger(__name__)
router = APIRouter()

# --- 世界模块 API ---


@router.put("/modules/{module_id}", response_model=WorldModuleResponse)
def update_world_module(
    module_id: str, module_data: WorldModuleUpdate, db: Session = Depends(get_db)
):
    """更新世界模块"""
    logger.info(f"Updating world module: {module_id}")

    module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="世界模块不存在")

    # 检查模块类型是否重复（如果修改了类型）
    if module_data.module_type and module_data.module_type != module.module_type:
        existing = (
            db.query(WorldModule)
            .filter(
                WorldModule.world_id == module.world_id,
                WorldModule.module_type == module_data.module_type,
                WorldModule.id != module_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="该模块类型已存在")

    update_data = module_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(module, field, value)

    db.commit()
    db.refresh(module)

    logger.info(f"World module updated: {module_id}")
    return module


# --- 子模块 API ---


@router.post("/modules/{module_id}/submodules", response_model=WorldSubmoduleResponse)
def create_world_submodule(
    module_id: str, submodule_data: WorldSubmoduleCreate, db: Session = Depends(get_db)
):
    """为世界模块创建子模块"""
    logger.info(f"Creating world submodule for module: {module_id}")

    # 检查模块是否存在
    module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="世界模块不存在")

    submodule = WorldSubmodule(
        id=str(uuid.uuid4()), module_id=module_id, **submodule_data.model_dump()
    )

    db.add(submodule)
    db.commit()
    db.refresh(submodule)

    logger.info(f"World submodule created: {submodule.id}")
    return submodule


@router.get(
    "/modules/{module_id}/submodules", response_model=List[WorldSubmoduleResponse]
)
def get_world_submodules(
    module_id: str,
    parent_id: Optional[str] = Query(
        None, description="父级子模块ID，用于过滤特定父级的子模块"
    ),
    db: Session = Depends(get_db),
):
    """获取世界模块的所有子模块"""
    logger.info(
        f"Getting world submodules for module: {module_id}, parent_id: {parent_id}"
    )

    query = db.query(WorldSubmodule).filter(WorldSubmodule.module_id == module_id)

    if parent_id is not None:
        query = query.filter(WorldSubmodule.parent_id == parent_id)

    submodules = query.order_by(WorldSubmodule.order_index).all()

    for submodule in submodules:
        submodule.item_count = (
            db.query(WorldModuleItem)
            .filter(WorldModuleItem.submodule_id == submodule.id)
            .count()
        )

    logger.debug(f"Found {len(submodules)} submodules")
    return submodules


# --- 模块项 API ---


@router.post("/modules/{module_id}/items", response_model=WorldModuleItemResponse)
def create_world_module_item(
    module_id: str, item_data: WorldModuleItemCreate, db: Session = Depends(get_db)
):
    """为世界模块创建项"""
    logger.info(f"Creating world module item for module: {module_id}")

    # 检查模块是否存在
    module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="世界模块不存在")

    # 如果指定了子模块，检查子模块是否存在
    if item_data.submodule_id:
        submodule = (
            db.query(WorldSubmodule)
            .filter(WorldSubmodule.id == item_data.submodule_id)
            .first()
        )
        if not submodule:
            raise HTTPException(status_code=404, detail="子模块不存在")

    item = WorldModuleItem(
        id=str(uuid.uuid4()), module_id=module_id, **item_data.model_dump()
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    logger.info(f"World module item created: {item.id}")
    return item


@router.get("/modules/{module_id}/items", response_model=List[WorldModuleItemResponse])
def get_world_module_items(
    module_id: str,
    submodule_id: Optional[str] = None,
    include_all: bool = False,
    db: Session = Depends(get_db),
):
    """获取世界模块的项"""
    logger.info(f"Getting world module items for module: {module_id}")

    query = db.query(WorldModuleItem).filter(WorldModuleItem.module_id == module_id)

    if not include_all:
        if submodule_id:
            query = query.filter(WorldModuleItem.submodule_id == submodule_id)
        else:
            query = query.filter(WorldModuleItem.submodule_id.is_(None))

    items = query.order_by(WorldModuleItem.order_index).all()
    logger.debug(f"Found {len(items)} items")
    return items


@router.put("/items/{item_id}", response_model=WorldModuleItemResponse)
def update_world_module_item(
    item_id: str, item_data: WorldModuleItemUpdate, db: Session = Depends(get_db)
):
    """更新模块项"""
    logger.info(f"Updating world module item: {item_id}")

    item = db.query(WorldModuleItem).filter(WorldModuleItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="模块项不存在")

    # 如果指定了子模块，检查子模块是否存在
    if item_data.submodule_id and item_data.submodule_id != item.submodule_id:
        submodule = (
            db.query(WorldSubmodule)
            .filter(WorldSubmodule.id == item_data.submodule_id)
            .first()
        )
        if not submodule:
            raise HTTPException(status_code=404, detail="子模块不存在")

    update_data = item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    logger.info(f"World module item updated: {item_id}")
    return item


@router.delete("/items/{item_id}")
def delete_world_module_item(item_id: str, db: Session = Depends(get_db)):
    """删除模块项"""
    logger.info(f"Deleting world module item: {item_id}")

    item = db.query(WorldModuleItem).filter(WorldModuleItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="模块项不存在")

    db.delete(item)
    db.commit()

    logger.info(f"World module item deleted: {item_id}")
    return {"message": "模块项删除成功"}


@router.put("/submodules/{submodule_id}", response_model=WorldSubmoduleResponse)
def update_world_submodule(
    submodule_id: str,
    submodule_data: WorldSubmoduleUpdate,
    db: Session = Depends(get_db),
):
    """更新子模块"""
    logger.info(f"Updating world submodule: {submodule_id}")

    submodule = (
        db.query(WorldSubmodule).filter(WorldSubmodule.id == submodule_id).first()
    )
    if not submodule:
        raise HTTPException(status_code=404, detail="子模块不存在")

    update_data = submodule_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(submodule, field, value)

    db.commit()
    db.refresh(submodule)

    logger.info(f"World submodule updated: {submodule_id}")
    return submodule


@router.delete("/submodules/{submodule_id}")
def delete_world_submodule(submodule_id: str, db: Session = Depends(get_db)):
    """删除子模块（级联删除关联的项）"""
    logger.info(f"Deleting world submodule: {submodule_id}")

    submodule = (
        db.query(WorldSubmodule).filter(WorldSubmodule.id == submodule_id).first()
    )
    if not submodule:
        raise HTTPException(status_code=404, detail="子模块不存在")

    db.delete(submodule)
    db.commit()

    logger.info(f"World submodule deleted: {submodule_id}")
    return {"message": "子模块删除成功"}
