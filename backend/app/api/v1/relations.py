"""
跨模块引用系统 - API路由

提供关联关系的RESTful API端点，包括创建、查询、发现和删除功能。
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.logging import get_logger
from app.models import Project
from app.schemas.relation import (
    BatchRelationCreate,
    ModuleType,
    RelationCreate,
    RelationDiscoveryResponse,
    RelationNetworkResponse,
    RelationResponse,
    RelationStatistics,
    RelationUpdate,
)
from app.services.relation_service import RelationService

logger = get_logger(__name__)
router = APIRouter()


def verify_project_exists(db: Session, project_id: str) -> Project:
    """
    验证项目是否存在

    Args:
        db: 数据库会话
        project_id: 项目ID

    Returns:
        项目对象

    Raises:
        HTTPException: 项目不存在时返回404
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return project


@router.post("", response_model=RelationResponse, status_code=201)
def create_relation(
    relation_data: RelationCreate,
    db: Session = Depends(get_db),
):
    """
    创建双向关联

    创建两个实体之间的关联关系。如果关联已存在，则返回已存在的关联。

    Args:
        relation_data: 关联创建数据

    Returns:
        创建的关联对象
    """
    verify_project_exists(db, relation_data.project_id)

    # 验证实体是否存在
    valid, error_msg = RelationService.validate_relation_entities(db, relation_data)
    if not valid:
        raise HTTPException(status_code=400, detail=error_msg)

    relation = RelationService.create_relation(db, relation_data)
    return RelationResponse(
        id=relation.id,
        source_module=relation.source_module,
        source_entity_type=relation.source_entity_type,
        source_entity_id=relation.source_entity_id,
        source_entity_name=relation.source_entity_name,
        target_module=relation.target_module,
        target_entity_type=relation.target_entity_type,
        target_entity_id=relation.target_entity_id,
        target_entity_name=relation.target_entity_name,
        relation_type=relation.relation_type,
        bidirectional=relation.bidirectional,
        strength=relation.strength,
        metadata_json=relation.metadata_json,
        project_id=relation.project_id,
        created_at=relation.created_at,
        updated_at=relation.updated_at,
    )


@router.post("/batch", response_model=list[RelationResponse], status_code=201)
def batch_create_relations(
    batch_data: BatchRelationCreate,
    db: Session = Depends(get_db),
):
    """
    批量创建关联

    一次性创建多个关联关系，使用事务确保原子性。

    Args:
        batch_data: 批量关联创建数据

    Returns:
        创建的关联对象列表
    """
    # 验证所有关联是否属于同一项目
    if batch_data.relations:
        project_ids = {r.project_id for r in batch_data.relations}
        if len(project_ids) > 1:
            raise HTTPException(
                status_code=400,
                detail="All relations in a batch must belong to the same project",
            )
        verify_project_exists(db, batch_data.relations[0].project_id)

    relations = RelationService.batch_create_relations(db, batch_data.relations)
    return [
        RelationResponse(
            id=rel.id,
            source_module=rel.source_module,
            source_entity_type=rel.source_entity_type,
            source_entity_id=rel.source_entity_id,
            source_entity_name=rel.source_entity_name,
            target_module=rel.target_module,
            target_entity_type=rel.target_entity_type,
            target_entity_id=rel.target_entity_id,
            target_entity_name=rel.target_entity_name,
            relation_type=rel.relation_type,
            bidirectional=rel.bidirectional,
            strength=rel.strength,
            metadata_json=rel.metadata_json,
            project_id=rel.project_id,
            created_at=rel.created_at,
            updated_at=rel.updated_at,
        )
        for rel in relations
    ]


@router.get("/project/{project_id}", response_model=list[RelationResponse])
def get_project_relations(
    project_id: str,
    source_module: Optional[str] = Query(None, description="Filter by source module"),
    target_module: Optional[str] = Query(None, description="Filter by target module"),
    relation_type: Optional[str] = Query(None, description="Filter by relation type"),
    db: Session = Depends(get_db),
):
    """
    获取项目的所有关联

    支持按源模块、目标模块、关系类型过滤。

    Args:
        project_id: 项目ID
        source_module: 源模块过滤
        target_module: 目标模块过滤
        relation_type: 关系类型过滤

    Returns:
        关联列表
    """
    verify_project_exists(db, project_id)
    relations = RelationService.get_project_relations(
        db,
        project_id,
        source_module=source_module,
        target_module=target_module,
        relation_type=relation_type,
    )
    return relations


@router.get("/entity/{entity_id}", response_model=RelationNetworkResponse)
def get_entity_relation_network(
    entity_id: str,
    project_id: str = Query(..., description="Project ID"),
    module: Optional[str] = Query(None, description="Module type filter"),
    db: Session = Depends(get_db),
):
    """
    获取实体的关联网络

    返回指定实体的所有关联关系，按方向分类（入向、出向、双向）。

    Args:
        entity_id: 实体ID
        project_id: 项目ID
        module: 模块类型过滤

    Returns:
        实体关联网络
    """
    verify_project_exists(db, project_id)
    network = RelationService.get_entity_relation_network(
        db, project_id, entity_id, module_filter=module
    )
    return network


@router.get("/discover/{entity_id}", response_model=RelationDiscoveryResponse)
def discover_relations(
    entity_id: str,
    project_id: str = Query(..., description="Project ID"),
    module: ModuleType = Query(..., description="Entity module type"),
    entity_type: str = Query(..., description="Entity type"),
    entity_name: str = Query(..., description="Entity name"),
    db: Session = Depends(get_db),
):
    """
    关联发现

    基于预置规则，从项目现有实体中推荐可能存在的关联。
    排除已存在的关联。

    Args:
        entity_id: 实体ID
        project_id: 项目ID
        module: 实体所属模块
        entity_type: 实体类型
        entity_name: 实体名称

    Returns:
        关联发现结果，包含推荐列表
    """
    verify_project_exists(db, project_id)
    discovery = RelationService.discover_relations(
        db, project_id, entity_id, module, entity_type, entity_name
    )
    return discovery


@router.patch("/{relation_id}", response_model=RelationResponse)
def update_relation(
    relation_id: str,
    update_data: RelationUpdate,
    project_id: str = Query(..., description="Project ID for validation"),
    db: Session = Depends(get_db),
):
    """
    更新关联

    更新指定关联的部分字段（关系类型、双向状态、强度、元数据）。

    Args:
        relation_id: 关联ID
        update_data: 更新数据
        project_id: 项目ID（用于验证）

    Returns:
        更新后的关联对象
    """
    verify_project_exists(db, project_id)
    logger.info(f"Updating relation {relation_id} in project {project_id}")

    relation = RelationService.update_relation(
        db, relation_id, update_data, project_id=project_id
    )
    if not relation:
        raise HTTPException(
            status_code=404,
            detail=f"Relation {relation_id} not found in project {project_id}",
        )

    logger.info(f"Successfully updated relation {relation_id}")
    return RelationResponse(
        id=relation.id,
        source_module=relation.source_module,
        source_entity_type=relation.source_entity_type,
        source_entity_id=relation.source_entity_id,
        source_entity_name=relation.source_entity_name,
        target_module=relation.target_module,
        target_entity_type=relation.target_entity_type,
        target_entity_id=relation.target_entity_id,
        target_entity_name=relation.target_entity_name,
        relation_type=relation.relation_type,
        bidirectional=relation.bidirectional,
        strength=relation.strength,
        metadata_json=relation.metadata_json,
        project_id=relation.project_id,
        created_at=relation.created_at,
        updated_at=relation.updated_at,
    )


@router.get("/project/{project_id}/statistics", response_model=RelationStatistics)
def get_project_relation_statistics(
    project_id: str,
    db: Session = Depends(get_db),
):
    """
    获取项目关联统计

    返回项目的关联统计信息，包括总数、各模块分布、关系类型分布等。

    Args:
        project_id: 项目ID

    Returns:
        关联统计信息
    """
    verify_project_exists(db, project_id)
    logger.info(f"Getting relation statistics for project {project_id}")
    return RelationService.get_relation_statistics(db, project_id)


@router.delete("/{relation_id}", status_code=204, response_model=None)
def delete_relation(
    relation_id: str,
    project_id: str = Query(..., description="Project ID for validation"),
    db: Session = Depends(get_db),
):
    """
    删除关联

    删除指定的关联关系。

    Args:
        relation_id: 关联ID
        project_id: 项目ID（用于验证）

    Returns:
        无内容（204）
    """
    verify_project_exists(db, project_id)
    logger.info(f"Deleting relation {relation_id} in project {project_id}")
    success = RelationService.delete_relation(db, relation_id, project_id=project_id)
    if not success:
        logger.warning(f"Relation {relation_id} not found in project {project_id}")
        raise HTTPException(
            status_code=404,
            detail=f"Relation {relation_id} not found in project {project_id}",
        )
    logger.info(f"Successfully deleted relation {relation_id}")
    return None
