"""
跨模块引用系统 - Pydantic Schema

定义关联关系的请求/响应数据结构和验证规则。
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ModuleType(str, Enum):
    """世界观模块类型枚举"""

    MAP = "map"  # 地图
    HISTORY = "history"  # 历史
    POLITICS = "politics"  # 政治
    ECONOMY = "economy"  # 经济
    RACES = "races"  # 种族
    SYSTEMS = "systems"  # 体系（修炼/魔法）
    SPECIAL = "special"  # 特殊


class RelationType(str, Enum):
    """关联关系类型枚举"""

    CAUSAL = "causal"  # 因果关系
    TEMPORAL = "temporal"  # 时间关系
    SPATIAL = "spatial"  # 空间关系
    FUNCTIONAL = "functional"  # 功能关系
    HIERARCHICAL = "hierarchical"  # 层级关系
    DEPENDENCY = "dependency"  # 依赖关系


class StrengthType(str, Enum):
    """关联强度枚举"""

    STRONG = "strong"  # 强关联
    MEDIUM = "medium"  # 中等关联
    WEAK = "weak"  # 弱关联


class EntityReference(BaseModel):
    """实体引用信息"""

    module: ModuleType  # 所属模块
    entity_type: str  # 实体类型（如：event, nation, character等）
    entity_id: str  # 实体唯一ID
    entity_name: str  # 实体显示名称


class RelationMetadata(BaseModel):
    """关联元数据"""

    created_by: Optional[str] = None  # 创建者
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)  # 置信度
    description: Optional[str] = None  # 描述说明


class RelationCreate(BaseModel):
    """创建关联请求Schema"""

    # 源实体信息
    source_module: ModuleType
    source_entity_type: str = Field(..., min_length=1, max_length=100)
    source_entity_id: str = Field(..., min_length=1, max_length=36)
    source_entity_name: str = Field(..., min_length=1, max_length=255)

    # 目标实体信息
    target_module: ModuleType
    target_entity_type: str = Field(..., min_length=1, max_length=100)
    target_entity_id: str = Field(..., min_length=1, max_length=36)
    target_entity_name: str = Field(..., min_length=1, max_length=255)

    # 关系属性
    relation_type: RelationType
    bidirectional: bool = True
    strength: StrengthType = StrengthType.MEDIUM
    metadata: Optional[Dict[str, Any]] = None
    project_id: str = Field(..., min_length=1, max_length=36)


class RelationResponse(BaseModel):
    """关联响应Schema"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    source_module: str
    source_entity_type: str
    source_entity_id: str
    source_entity_name: str
    target_module: str
    target_entity_type: str
    target_entity_id: str
    target_entity_name: str
    relation_type: str
    bidirectional: bool
    strength: str
    metadata_json: Optional[Dict[str, Any]] = None
    project_id: str
    created_at: datetime
    updated_at: datetime


class RelationNetworkResponse(BaseModel):
    """实体关联网络响应Schema

    返回指定实体的所有关联关系，按方向分类。
    """

    entity: EntityReference  # 中心实体信息
    incoming: List[RelationResponse]  # 入向关联（其他实体指向该实体）
    outgoing: List[RelationResponse]  # 出向关联（该实体指向其他实体）
    bidirectional: List[RelationResponse]  # 双向关联
    total_count: int  # 关联总数


class RelationDiscoveryRule(BaseModel):
    """关联发现规则Schema"""

    id: str
    name: str
    source_module: ModuleType
    target_module: ModuleType
    relation_type: RelationType
    description: str
    confidence: float


class DiscoveredRelation(BaseModel):
    """发现的潜在关联Schema"""

    source_module: ModuleType
    source_entity_type: str
    source_entity_id: str
    source_entity_name: str
    target_module: ModuleType
    target_entity_type: str
    target_entity_id: str
    target_entity_name: str
    relation_type: RelationType
    strength: StrengthType
    confidence: float  # 推荐置信度
    reason: str  # 推荐理由


class RelationDiscoveryResponse(BaseModel):
    """关联发现响应Schema"""

    entity: EntityReference
    discoveries: List[DiscoveredRelation]
    total_count: int


class RelationFilter(BaseModel):
    """关联查询过滤条件Schema"""

    project_id: str
    source_module: Optional[ModuleType] = None
    target_module: Optional[ModuleType] = None
    relation_type: Optional[RelationType] = None
    entity_id: Optional[str] = None
    strength: Optional[StrengthType] = None


class BatchRelationCreate(BaseModel):
    """批量创建关联请求Schema"""

    relations: List[RelationCreate] = Field(..., min_length=1, max_length=50)


class RelationUpdate(BaseModel):
    """更新关联请求Schema

    所有字段均为可选，只更新提供的字段。
    """

    relation_type: Optional[RelationType] = None
    bidirectional: Optional[bool] = None
    strength: Optional[StrengthType] = None
    metadata: Optional[Dict[str, Any]] = None


class RelationStatistics(BaseModel):
    """关联统计信息Schema"""

    total_relations: int  # 总关联数
    bidirectional_count: int  # 双向关联数
    by_module: Dict[str, int]  # 各模块关联数
    by_relation_type: Dict[str, int]  # 各关系类型数量
    by_strength: Dict[str, int]  # 各强度等级数量
    cross_module_relations: int  # 跨模块关联数
    top_connected_entities: List[Dict[str, Any]]  # 连接最多的实体
