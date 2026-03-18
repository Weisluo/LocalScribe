# backend/app/api/v1/worldbuilding.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
import uuid

from app.models import WorldTemplate, WorldModule, WorldSubmodule, WorldModuleItem, WorldInstance, Project
from app.schemas.worldbuilding import (
    WorldTemplateCreate, WorldTemplateUpdate, WorldTemplateResponse, WorldTemplateWithModules,
    WorldModuleCreate, WorldModuleUpdate, WorldModuleResponse, WorldModuleWithItems,
    WorldSubmoduleCreate, WorldSubmoduleUpdate, WorldSubmoduleResponse, WorldSubmoduleWithItems,
    WorldModuleItemCreate, WorldModuleItemUpdate, WorldModuleItemResponse,
    WorldInstanceCreate, WorldInstanceUpdate, WorldInstanceResponse,
    WorldTemplateExport, WorldTemplateImport, BatchDeleteRequest, BatchUpdateOrderRequest,
    WorldTemplateFilter
)
from app.core.dependencies import get_db
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()

def load_template_modules_with_selectinload(template_id: str, db: Session):
    """使用selectinload优化加载模板的模块、子模块和项"""
    try:
        # 第一步：加载所有模块及其子模块
        modules = db.query(WorldModule).filter(WorldModule.template_id == template_id).\
            options(selectinload(WorldModule.submodules)).\
            order_by(WorldModule.order_index).all()
        
        if not modules:
            return []
        
        # 第二步：批量加载所有模块的项（不属于子模块的）
        module_ids = [module.id for module in modules]
        module_items = db.query(WorldModuleItem).filter(
            WorldModuleItem.module_id.in_(module_ids),
            WorldModuleItem.submodule_id.is_(None)
        ).all()
        
        # 将模块项分配到对应的模块
        module_items_map = {}
        for item in module_items:
            if item.module_id not in module_items_map:
                module_items_map[item.module_id] = []
            module_items_map[item.module_id].append(item)
        
        # 第三步：批量加载所有子模块的项
        all_submodule_ids = []
        for module in modules:
            if module.submodules:
                all_submodule_ids.extend([submodule.id for submodule in module.submodules])
        
        if all_submodule_ids:
            submodule_items = db.query(WorldModuleItem).filter(
                WorldModuleItem.submodule_id.in_(all_submodule_ids)
            ).all()
            
            # 将子模块项分配到对应的子模块
            submodule_items_map = {}
            for item in submodule_items:
                if item.submodule_id not in submodule_items_map:
                    submodule_items_map[item.submodule_id] = []
                submodule_items_map[item.submodule_id].append(item)
            
            # 为每个子模块设置items
            for module in modules:
                if module.submodules:
                    for submodule in module.submodules:
                        submodule.items = submodule_items_map.get(submodule.id, [])
        
        # 为每个模块设置items（不属于子模块的）
        for module in modules:
            module.items = module_items_map.get(module.id, [])
        
        return modules
    
    except SQLAlchemyError as e:
        logger.error(f"Database error loading template modules: {str(e)}")
        raise
    
    except Exception as e:
        logger.error(f"Unexpected error loading template modules: {str(e)}")
        raise

# --- 世界模板 API ---

@router.post("/templates", response_model=WorldTemplateResponse)
def create_world_template(
    template_data: WorldTemplateCreate,
    db: Session = Depends(get_db)
):
    """创建新的世界模板"""
    logger.info(f"Creating world template: {template_data.name}")
    
    try:
        # 检查名称是否已存在
        existing = db.query(WorldTemplate).filter(WorldTemplate.name == template_data.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="世界模板名称已存在")
        
        template = WorldTemplate(
            id=str(uuid.uuid4()),
            **template_data.model_dump()
        )
        
        db.add(template)
        db.commit()
        db.refresh(template)
        
        logger.info(f"World template created: {template.id}")
        return template
    
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error creating world template: {str(e)}")
        raise HTTPException(status_code=500, detail="创建世界模板时发生数据库错误")
    
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating world template: {str(e)}")
        raise HTTPException(status_code=500, detail="创建世界模板时发生未知错误")

@router.get("/templates", response_model=List[WorldTemplateResponse])
def get_world_templates(
    skip: int = 0,
    limit: int = 100,
    name: Optional[str] = None,
    is_public: Optional[bool] = None,
    is_system_template: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """获取世界模板列表"""
    logger.info(f"Getting world templates - skip={skip}, limit={limit}")
    
    query = db.query(WorldTemplate)
    
    if name:
        query = query.filter(WorldTemplate.name.ilike(f"%{name}%"))
    if is_public is not None:
        query = query.filter(WorldTemplate.is_public == is_public)
    if is_system_template is not None:
        query = query.filter(WorldTemplate.is_system_template == is_system_template)
    
    templates = query.offset(skip).limit(limit).all()
    
    # 计算模块和实例数量
    for template in templates:
        template.module_count = db.query(WorldModule).filter(WorldModule.template_id == template.id).count()
        template.instance_count = db.query(WorldInstance).filter(WorldInstance.template_id == template.id).count()
    
    logger.debug(f"Found {len(templates)} templates")
    return templates

@router.post("/templates/search", response_model=List[WorldTemplateResponse])
def search_world_templates(
    filter_data: WorldTemplateFilter,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """高级搜索世界模板"""
    logger.info(f"Searching world templates with filter: {filter_data.model_dump()}")
    
    query = db.query(WorldTemplate)
    
    # 应用筛选条件
    if filter_data.name:
        query = query.filter(WorldTemplate.name.ilike(f"%{filter_data.name}%"))
    
    if filter_data.tags:
        # 支持多标签筛选，使用JSON数组包含查询
        for tag in filter_data.tags:
            query = query.filter(WorldTemplate.tags.contains([tag]))
    
    if filter_data.is_public is not None:
        query = query.filter(WorldTemplate.is_public == filter_data.is_public)
    
    if filter_data.is_system_template is not None:
        query = query.filter(WorldTemplate.is_system_template == filter_data.is_system_template)
    
    if filter_data.created_by:
        query = query.filter(WorldTemplate.created_by == filter_data.created_by)
    
    templates = query.offset(skip).limit(limit).all()
    
    # 计算模块和实例数量
    for template in templates:
        template.module_count = db.query(WorldModule).filter(WorldModule.template_id == template.id).count()
        template.instance_count = db.query(WorldInstance).filter(WorldInstance.template_id == template.id).count()
    
    logger.debug(f"Found {len(templates)} templates matching filter")
    return templates

@router.get("/templates/{template_id}", response_model=WorldTemplateWithModules)
def get_world_template(
    template_id: str,
    include_modules: bool = True,
    db: Session = Depends(get_db)
):
    """获取特定世界模板的详细信息"""
    logger.info(f"Getting world template: {template_id}")
    
    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")
    
    if include_modules:
        try:
            # 使用优化的selectinload加载策略，避免笛卡尔积
            modules = load_template_modules_with_selectinload(template_id, db)
            
            template_modules = []
            for module in modules:
                # 子模块已经通过selectinload加载
                submodules = module.submodules
                
                # 模块项（不属于任何子模块的）
                items = [item for item in module.items if item.submodule_id is None]
                
                # 为子模块添加项
                submodule_with_items = []
                for submodule in submodules:
                    # 子模块的项已经通过批量加载
                    submodule_items = submodule.items
                    
                    submodule_with_items.append(WorldSubmoduleWithItems(
                        id=submodule.id,
                        module_id=submodule.module_id,
                        name=submodule.name,
                        description=submodule.description,
                        order_index=submodule.order_index,
                        color=submodule.color,
                        icon=submodule.icon,
                        created_at=submodule.created_at,
                        updated_at=submodule.updated_at,
                        item_count=len(submodule_items),
                        items=submodule_items
                    ))
                
                template_modules.append(WorldModuleWithItems(
                    id=module.id,
                    template_id=module.template_id,
                    module_type=module.module_type,
                    name=module.name,
                    description=module.description,
                    icon=module.icon,
                    order_index=module.order_index,
                    is_collapsible=module.is_collapsible,
                    is_required=module.is_required,
                    created_at=module.created_at,
                    updated_at=module.updated_at,
                    submodule_count=len(submodules),
                    item_count=len(items),
                    submodules=submodule_with_items,
                    items=items
                ))
            
            return WorldTemplateWithModules(
                id=template.id,
                name=template.name,
                description=template.description,
                cover_image=template.cover_image,
                tags=template.tags,
                is_public=template.is_public,
                is_system_template=template.is_system_template,
                created_at=template.created_at,
                updated_at=template.updated_at,
                created_by=template.created_by,
                module_count=len(modules),
                instance_count=template.instance_count if hasattr(template, 'instance_count') else 0,
                modules=template_modules
            )
        
        except Exception as e:
            logger.error(f"Error loading template modules: {str(e)}")
            # 如果模块加载失败，返回基础模板信息
            return template
    
    return template

@router.put("/templates/{template_id}", response_model=WorldTemplateResponse)
def update_world_template(
    template_id: str,
    template_data: WorldTemplateUpdate,
    db: Session = Depends(get_db)
):
    """更新世界模板"""
    logger.info(f"Updating world template: {template_id}")
    
    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")
    
    # 检查名称是否已存在（如果修改了名称）
    if template_data.name and template_data.name != template.name:
        existing = db.query(WorldTemplate).filter(
            WorldTemplate.name == template_data.name,
            WorldTemplate.id != template_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="世界模板名称已存在")
    
    # 更新字段
    update_data = template_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    db.commit()
    db.refresh(template)
    
    logger.info(f"World template updated: {template_id}")
    return template

@router.delete("/templates/{template_id}")
def delete_world_template(
    template_id: str,
    db: Session = Depends(get_db)
):
    """删除世界模板"""
    logger.info(f"Deleting world template: {template_id}")
    
    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")
    
    # 检查是否有实例在使用此模板
    instance_count = db.query(WorldInstance).filter(WorldInstance.template_id == template_id).count()
    if instance_count > 0:
        raise HTTPException(status_code=400, detail="无法删除正在使用的世界模板")
    
    db.delete(template)
    db.commit()
    
    logger.info(f"World template deleted: {template_id}")
    return {"message": "世界模板删除成功"}

# --- 世界模块 API ---

@router.post("/templates/{template_id}/modules", response_model=WorldModuleResponse)
def create_world_module(
    template_id: str,
    module_data: WorldModuleCreate,
    db: Session = Depends(get_db)
):
    """为世界模板创建模块"""
    logger.info(f"Creating world module for template: {template_id}")
    
    # 检查模板是否存在
    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")
    
    # 检查模块类型是否重复
    existing = db.query(WorldModule).filter(
        WorldModule.template_id == template_id,
        WorldModule.module_type == module_data.module_type
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该模块类型已存在")
    
    module = WorldModule(
        id=str(uuid.uuid4()),
        template_id=template_id,
        **module_data.model_dump()
    )
    
    db.add(module)
    db.commit()
    db.refresh(module)
    
    logger.info(f"World module created: {module.id}")
    return module

@router.get("/templates/{template_id}/modules", response_model=List[WorldModuleResponse])
def get_world_modules(
    template_id: str,
    db: Session = Depends(get_db)
):
    """获取世界模板的所有模块"""
    logger.info(f"Getting world modules for template: {template_id}")
    
    modules = db.query(WorldModule).filter(
        WorldModule.template_id == template_id
    ).order_by(WorldModule.order_index).all()
    
    # 计算子模块和项的数量
    for module in modules:
        module.submodule_count = db.query(WorldSubmodule).filter(WorldSubmodule.module_id == module.id).count()
        module.item_count = db.query(WorldModuleItem).filter(WorldModuleItem.module_id == module.id).count()
    
    logger.debug(f"Found {len(modules)} modules")
    return modules

@router.put("/modules/{module_id}", response_model=WorldModuleResponse)
def update_world_module(
    module_id: str,
    module_data: WorldModuleUpdate,
    db: Session = Depends(get_db)
):
    """更新世界模块"""
    logger.info(f"Updating world module: {module_id}")
    
    module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="世界模块不存在")
    
    # 检查模块类型是否重复（如果修改了类型）
    if module_data.module_type and module_data.module_type != module.module_type:
        existing = db.query(WorldModule).filter(
            WorldModule.template_id == module.template_id,
            WorldModule.module_type == module_data.module_type,
            WorldModule.id != module_id
        ).first()
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
    module_id: str,
    submodule_data: WorldSubmoduleCreate,
    db: Session = Depends(get_db)
):
    """为世界模块创建子模块"""
    logger.info(f"Creating world submodule for module: {module_id}")
    
    # 检查模块是否存在
    module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="世界模块不存在")
    
    submodule = WorldSubmodule(
        id=str(uuid.uuid4()),
        module_id=module_id,
        **submodule_data.model_dump()
    )
    
    db.add(submodule)
    db.commit()
    db.refresh(submodule)
    
    logger.info(f"World submodule created: {submodule.id}")
    return submodule

@router.get("/modules/{module_id}/submodules", response_model=List[WorldSubmoduleResponse])
def get_world_submodules(
    module_id: str,
    db: Session = Depends(get_db)
):
    """获取世界模块的所有子模块"""
    logger.info(f"Getting world submodules for module: {module_id}")
    
    submodules = db.query(WorldSubmodule).filter(
        WorldSubmodule.module_id == module_id
    ).order_by(WorldSubmodule.order_index).all()
    
    # 计算项的数量
    for submodule in submodules:
        submodule.item_count = db.query(WorldModuleItem).filter(WorldModuleItem.submodule_id == submodule.id).count()
    
    logger.debug(f"Found {len(submodules)} submodules")
    return submodules

# --- 模块项 API ---

@router.post("/modules/{module_id}/items", response_model=WorldModuleItemResponse)
def create_world_module_item(
    module_id: str,
    item_data: WorldModuleItemCreate,
    db: Session = Depends(get_db)
):
    """为世界模块创建项"""
    logger.info(f"Creating world module item for module: {module_id}")
    
    # 检查模块是否存在
    module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="世界模块不存在")
    
    # 如果指定了子模块，检查子模块是否存在
    if item_data.submodule_id:
        submodule = db.query(WorldSubmodule).filter(WorldSubmodule.id == item_data.submodule_id).first()
        if not submodule:
            raise HTTPException(status_code=404, detail="子模块不存在")
    
    item = WorldModuleItem(
        id=str(uuid.uuid4()),
        module_id=module_id,
        **item_data.model_dump()
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
    db: Session = Depends(get_db)
):
    """获取世界模块的项"""
    logger.info(f"Getting world module items for module: {module_id}")
    
    query = db.query(WorldModuleItem).filter(WorldModuleItem.module_id == module_id)
    
    if submodule_id:
        query = query.filter(WorldModuleItem.submodule_id == submodule_id)
    else:
        query = query.filter(WorldModuleItem.submodule_id.is_(None))
    
    items = query.order_by(WorldModuleItem.order_index).all()
    logger.debug(f"Found {len(items)} items")
    return items

@router.put("/items/{item_id}", response_model=WorldModuleItemResponse)
def update_world_module_item(
    item_id: str,
    item_data: WorldModuleItemUpdate,
    db: Session = Depends(get_db)
):
    """更新模块项"""
    logger.info(f"Updating world module item: {item_id}")
    
    item = db.query(WorldModuleItem).filter(WorldModuleItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="模块项不存在")
    
    # 如果指定了子模块，检查子模块是否存在
    if item_data.submodule_id and item_data.submodule_id != item.submodule_id:
        submodule = db.query(WorldSubmodule).filter(WorldSubmodule.id == item_data.submodule_id).first()
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
def delete_world_module_item(
    item_id: str,
    db: Session = Depends(get_db)
):
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
    db: Session = Depends(get_db)
):
    """更新子模块"""
    logger.info(f"Updating world submodule: {submodule_id}")
    
    submodule = db.query(WorldSubmodule).filter(WorldSubmodule.id == submodule_id).first()
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
def delete_world_submodule(
    submodule_id: str,
    db: Session = Depends(get_db)
):
    """删除子模块"""
    logger.info(f"Deleting world submodule: {submodule_id}")
    
    submodule = db.query(WorldSubmodule).filter(WorldSubmodule.id == submodule_id).first()
    if not submodule:
        raise HTTPException(status_code=404, detail="子模块不存在")
    
    # 检查是否有项关联到此子模块
    item_count = db.query(WorldModuleItem).filter(WorldModuleItem.submodule_id == submodule_id).count()
    if item_count > 0:
        raise HTTPException(status_code=400, detail="无法删除包含项的模块")
    
    db.delete(submodule)
    db.commit()
    
    logger.info(f"World submodule deleted: {submodule_id}")
    return {"message": "子模块删除成功"}

@router.delete("/modules/{module_id}")
def delete_world_module(
    module_id: str,
    db: Session = Depends(get_db)
):
    """删除世界模块"""
    logger.info(f"Deleting world module: {module_id}")
    
    module = db.query(WorldModule).filter(WorldModule.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="世界模块不存在")
    
    # 检查是否有子模块或项关联到此模块
    submodule_count = db.query(WorldSubmodule).filter(WorldSubmodule.module_id == module_id).count()
    item_count = db.query(WorldModuleItem).filter(WorldModuleItem.module_id == module_id).count()
    
    if submodule_count > 0 or item_count > 0:
        raise HTTPException(status_code=400, detail="无法删除包含子模块或项的模块")
    
    db.delete(module)
    db.commit()
    
    logger.info(f"World module deleted: {module_id}")
    return {"message": "世界模块删除成功"}

# --- 世界实例 API ---

@router.post("/instances", response_model=WorldInstanceResponse)
def create_world_instance(
    instance_data: WorldInstanceCreate,
    db: Session = Depends(get_db)
):
    """基于模板创建世界实例"""
    logger.info(f"Creating world instance from template: {instance_data.template_id}")
    
    try:
        # 检查模板是否存在
        template = db.query(WorldTemplate).filter(WorldTemplate.id == instance_data.template_id).first()
        if not template:
            raise HTTPException(status_code=404, detail="世界模板不存在")
        
        # 检查项目是否存在
        project = db.query(Project).filter(Project.id == instance_data.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")
        
        instance = WorldInstance(
            id=str(uuid.uuid4()),
            **instance_data.model_dump()
        )
        
        db.add(instance)
        db.commit()
        db.refresh(instance)
        
        logger.info(f"World instance created: {instance.id}")
        return instance
    
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error creating world instance: {str(e)}")
        raise HTTPException(status_code=500, detail="创建世界实例时发生数据库错误")
    
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error creating world instance: {str(e)}")
        raise HTTPException(status_code=500, detail="创建世界实例时发生未知错误")

@router.get("/projects/{project_id}/instances", response_model=List[WorldInstanceResponse])
def get_project_world_instances(
    project_id: str,
    db: Session = Depends(get_db)
):
    """获取项目的所有世界实例"""
    logger.info(f"Getting world instances for project: {project_id}")
    
    instances = db.query(WorldInstance).filter(
        WorldInstance.project_id == project_id
    ).order_by(WorldInstance.created_at.desc()).all()
    
    logger.debug(f"Found {len(instances)} instances")
    return instances

@router.put("/instances/{instance_id}", response_model=WorldInstanceResponse)
def update_world_instance(
    instance_id: str,
    instance_data: WorldInstanceUpdate,
    db: Session = Depends(get_db)
):
    """更新世界实例"""
    logger.info(f"Updating world instance: {instance_id}")
    
    instance = db.query(WorldInstance).filter(WorldInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="世界实例不存在")
    
    update_data = instance_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(instance, field, value)
    
    db.commit()
    db.refresh(instance)
    
    logger.info(f"World instance updated: {instance_id}")
    return instance

@router.delete("/instances/{instance_id}")
def delete_world_instance(
    instance_id: str,
    db: Session = Depends(get_db)
):
    """删除世界实例"""
    logger.info(f"Deleting world instance: {instance_id}")
    
    instance = db.query(WorldInstance).filter(WorldInstance.id == instance_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="世界实例不存在")
    
    db.delete(instance)
    db.commit()
    
    logger.info(f"World instance deleted: {instance_id}")
    return {"message": "世界实例删除成功"}

# --- 导入/导出 API ---

@router.get("/templates/{template_id}/export", response_model=WorldTemplateExport)
def export_world_template(
    template_id: str,
    db: Session = Depends(get_db)
):
    """导出世界模板"""
    logger.info(f"Exporting world template: {template_id}")
    
    template = db.query(WorldTemplate).filter(WorldTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="世界模板不存在")
    
    try:
        # 使用优化的selectinload加载策略，避免笛卡尔积
        modules = load_template_modules_with_selectinload(template_id, db)
        
        template_modules = []
        for module in modules:
            # 子模块已经通过selectinload加载
            submodules = module.submodules
            
            # 模块项（不属于任何子模块的）
            items = [item for item in module.items if item.submodule_id is None]
            
            # 为子模块添加项
            submodule_with_items = []
            for submodule in submodules:
                # 子模块的项已经通过批量加载
                submodule_items = submodule.items
                
                submodule_with_items.append(WorldSubmoduleWithItems(
                    id=submodule.id,
                    module_id=submodule.module_id,
                    name=submodule.name,
                    description=submodule.description,
                    order_index=submodule.order_index,
                    color=submodule.color,
                    icon=submodule.icon,
                    created_at=submodule.created_at,
                    updated_at=submodule.updated_at,
                    item_count=len(submodule_items),
                    items=submodule_items
                ))
            
            template_modules.append(WorldModuleWithItems(
                id=module.id,
                template_id=module.template_id,
                module_type=module.module_type,
                name=module.name,
                description=module.description,
                icon=module.icon,
                order_index=module.order_index,
                is_collapsible=module.is_collapsible,
                is_required=module.is_required,
                created_at=module.created_at,
                updated_at=module.updated_at,
                submodule_count=len(submodules),
                item_count=len(items),
                submodules=submodule_with_items,
                items=items
            ))
        
        return WorldTemplateExport(
            template=template,
            modules=template_modules
        )
    
    except Exception as e:
        logger.error(f"Error loading template modules for export: {str(e)}")
        raise HTTPException(status_code=500, detail="加载模板数据时发生错误")

@router.post("/templates/import", response_model=WorldTemplateResponse)
def import_world_template(
    import_data: WorldTemplateImport,
    db: Session = Depends(get_db)
):
    """导入世界模板"""
    logger.info(f"Importing world template: {import_data.name}")
    
    try:
        # 检查名称是否已存在
        existing = db.query(WorldTemplate).filter(WorldTemplate.name == import_data.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="世界模板名称已存在")
        
        # 创建新模板
        template = WorldTemplate(
            id=str(uuid.uuid4()),
            name=import_data.name,
            description=import_data.description,
            is_public=False,
            is_system_template=False
        )
        
        db.add(template)
        db.flush()  # 获取模板ID
        
        # 导入模块
        for module_data in import_data.modules:
            module = WorldModule(
                id=str(uuid.uuid4()),
                template_id=template.id,
                **module_data.model_dump(exclude={"submodules", "items"})
            )
            db.add(module)
            db.flush()
            
            # 导入子模块
            for submodule_data in module_data.submodules:
                submodule = WorldSubmodule(
                    id=str(uuid.uuid4()),
                    module_id=module.id,
                    **submodule_data.model_dump(exclude={"items"})
                )
                db.add(submodule)
                db.flush()
                
                # 导入子模块项
                for item_data in submodule_data.items:
                    item = WorldModuleItem(
                        id=str(uuid.uuid4()),
                        module_id=module.id,
                        submodule_id=submodule.id,
                        **item_data.model_dump()
                    )
                    db.add(item)
            
            # 导入模块项
            for item_data in module_data.items:
                item = WorldModuleItem(
                    id=str(uuid.uuid4()),
                    module_id=module.id,
                    **item_data.model_dump()
                )
                db.add(item)
        
        db.commit()
        db.refresh(template)
        
        logger.info(f"World template imported: {template.id}")
        return template
    
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error importing world template: {str(e)}")
        raise HTTPException(status_code=500, detail="导入世界模板时发生数据库错误")
    
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error importing world template: {str(e)}")
        raise HTTPException(status_code=500, detail="导入世界模板时发生未知错误")

# --- 批量操作 API ---

@router.post("/batch/delete")
def batch_delete_world_items(
    delete_request: BatchDeleteRequest,
    db: Session = Depends(get_db)
):
    """批量删除世界项"""
    logger.info(f"Batch deleting {len(delete_request.ids)} items")
    
    try:
        deleted_count = 0
        
        for item_id in delete_request.ids:
            # 尝试删除模板
            template = db.query(WorldTemplate).filter(WorldTemplate.id == item_id).first()
            if template:
                # 检查是否有实例在使用此模板
                instance_count = db.query(WorldInstance).filter(WorldInstance.template_id == item_id).count()
                if instance_count > 0:
                    logger.warning(f"Cannot delete template {item_id}: has {instance_count} instances")
                    continue
                
                db.delete(template)
                deleted_count += 1
                continue
            
            # 尝试删除模块
            module = db.query(WorldModule).filter(WorldModule.id == item_id).first()
            if module:
                # 检查是否有子模块或项关联到此模块
                submodule_count = db.query(WorldSubmodule).filter(WorldSubmodule.module_id == item_id).count()
                item_count = db.query(WorldModuleItem).filter(WorldModuleItem.module_id == item_id).count()
                
                if submodule_count > 0 or item_count > 0:
                    logger.warning(f"Cannot delete module {item_id}: has {submodule_count} submodules and {item_count} items")
                    continue
                
                db.delete(module)
                deleted_count += 1
                continue
            
            # 尝试删除子模块
            submodule = db.query(WorldSubmodule).filter(WorldSubmodule.id == item_id).first()
            if submodule:
                # 检查是否有项关联到此子模块
                item_count = db.query(WorldModuleItem).filter(WorldModuleItem.submodule_id == item_id).count()
                
                if item_count > 0:
                    logger.warning(f"Cannot delete submodule {item_id}: has {item_count} items")
                    continue
                
                db.delete(submodule)
                deleted_count += 1
                continue
            
            # 尝试删除模块项
            item = db.query(WorldModuleItem).filter(WorldModuleItem.id == item_id).first()
            if item:
                db.delete(item)
                deleted_count += 1
                continue
            
            logger.warning(f"Item not found: {item_id}")
        
        db.commit()
        
        logger.info(f"Batch delete completed: {deleted_count}/{len(delete_request.ids)} items deleted")
        return {"message": f"成功删除 {deleted_count} 个项", "deleted_count": deleted_count}
    
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during batch delete: {str(e)}")
        raise HTTPException(status_code=500, detail="批量删除时发生数据库错误")
    
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during batch delete: {str(e)}")
        raise HTTPException(status_code=500, detail="批量删除时发生未知错误")

@router.post("/batch/order")
def batch_update_order(
    order_request: BatchUpdateOrderRequest,
    db: Session = Depends(get_db)
):
    """批量更新排序"""
    logger.info(f"Batch updating order for {len(order_request.items)} items")
    
    try:
        updated_count = 0
        
        for item_data in order_request.items:
            item_id = item_data.get('id')
            order_index = item_data.get('order_index')
            
            if not item_id or order_index is None:
                logger.warning(f"Invalid item data: {item_data}")
                continue
            
            # 尝试更新模板排序
            template = db.query(WorldTemplate).filter(WorldTemplate.id == item_id).first()
            if template:
                template.order_index = order_index
                updated_count += 1
                continue
            
            # 尝试更新模块排序
            module = db.query(WorldModule).filter(WorldModule.id == item_id).first()
            if module:
                module.order_index = order_index
                updated_count += 1
                continue
            
            # 尝试更新子模块排序
            submodule = db.query(WorldSubmodule).filter(WorldSubmodule.id == item_id).first()
            if submodule:
                submodule.order_index = order_index
                updated_count += 1
                continue
            
            # 尝试更新模块项排序
            item = db.query(WorldModuleItem).filter(WorldModuleItem.id == item_id).first()
            if item:
                item.order_index = order_index
                updated_count += 1
                continue
            
            logger.warning(f"Item not found for ordering: {item_id}")
        
        db.commit()
        
        logger.info(f"Batch order update completed: {updated_count}/{len(order_request.items)} items updated")
        return {"message": f"排序更新成功，更新了 {updated_count} 个项", "updated_count": updated_count}
    
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during batch order update: {str(e)}")
        raise HTTPException(status_code=500, detail="批量排序更新时发生数据库错误")
    
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during batch order update: {str(e)}")
        raise HTTPException(status_code=500, detail="批量排序更新时发生未知错误")